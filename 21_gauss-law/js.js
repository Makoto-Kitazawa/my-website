// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a1a);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(15, 12, 15);
camera.lookAt(0, 0, 0);

const canvas = document.getElementById('canvas');
const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(10, 10, 5);
scene.add(directionalLight);

// Coordinate axes
const axesHelper = new THREE.AxesHelper(10);
scene.add(axesHelper);

// Grid
const gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x222222);
scene.add(gridHelper);

// State
let currentChargeType = null;
let fieldLinesVisible = false;
let closedSurfaceVisible = false;
let isUnfolding = false;
let unfoldProgress = 0;
let isAnimating = false;
let chargeObject = null;

// Camera spherical coordinates (always looking at origin)
let cameraRadius = 24;
let cameraPhi = Math.PI / 4;
let cameraTheta = Math.PI / 4;

// Update camera position from spherical coordinates
function updateCameraPosition() {
  const x = cameraRadius * Math.sin(cameraPhi) * Math.cos(cameraTheta);
  const y = cameraRadius * Math.cos(cameraPhi);
  const z = cameraRadius * Math.sin(cameraPhi) * Math.sin(cameraTheta);
  
  camera.position.set(x, y, z);
  camera.lookAt(0, 0, 0);
}

// Initialize camera position
updateCameraPosition();

// Groups
const chargeGroup = new THREE.Group();
scene.add(chargeGroup);

const fieldLinesGroup = new THREE.Group();
scene.add(fieldLinesGroup);

const closedSurfaceGroup = new THREE.Group();
scene.add(closedSurfaceGroup);

const penetrationPointsGroup = new THREE.Group();
scene.add(penetrationPointsGroup);

const descriptions = {
  line: '直線電荷: 無限に長い直線に均等に分布した正電荷。\n電気力線は直線の中心軸から放射状に広がります。',
  plane: '平面電荷: 無限に広い平面に均等に分布した正電荷。\n電気力線は平面に垂直に両側に広がります。',
  sphere: '導体球: 半径Rの導体球に帯電した正電荷。\n電気力線は球面から放射状に広がります。'
};

// Create line charge
function createLineCharge() {
  chargeGroup.clear();
  
  const lineGeometry = new THREE.CylinderGeometry(0.3, 0.3, 12, 16);
  const lineMaterial = new THREE.MeshStandardMaterial({ color: 0xffaa00 });
  const line = new THREE.Mesh(lineGeometry, lineMaterial);
  chargeGroup.add(line);
  
  chargeObject = line;
}

// Create plane charge
function createPlaneCharge() {
  chargeGroup.clear();
  
  const planeGeometry = new THREE.PlaneGeometry(10, 10);
  const planeMaterial = new THREE.MeshStandardMaterial({ color: 0xffaa00, side: THREE.DoubleSide });
  const plane = new THREE.Mesh(planeGeometry, planeMaterial);
  plane.position.z = 0;
  chargeGroup.add(plane);
  
  chargeObject = plane;
}

// Create conducting sphere
function createConductingSphere() {
  chargeGroup.clear();
  
  const sphereGeometry = new THREE.IcosahedronGeometry(2, 4);
  const sphereMaterial = new THREE.MeshStandardMaterial({ color: 0xffaa00, metalness: 0.8, roughness: 0.2 });
  const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
  chargeGroup.add(sphere);
  
  chargeObject = sphere;
}

// Generate field lines from line charge (radial from axis)
function generateLineChargeFieldLines() {
  fieldLinesGroup.clear();
  
  const radius = 8;
  const numAngular = 16;
  const numHeights = 5;
  const lineLength = 6;
  
  for (let h = 0; h < numHeights; h++) {
    const y = -6 + (h / (numHeights - 1)) * 12;
    
    for (let i = 0; i < numAngular; i++) {
      const angle = (i / numAngular) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      
      const direction = new THREE.Vector3(x, 0, z).normalize();
      const startPos = new THREE.Vector3(x * 0.3, y, z * 0.3);
      
      const arrowHelper = new THREE.ArrowHelper(direction, startPos, lineLength, 0x00dd00, 0.6, 0.35);
      fieldLinesGroup.add(arrowHelper);
    }
  }
}

// Generate field lines from plane (perpendicular to plane)
function generatePlaneChargeFieldLines() {
  fieldLinesGroup.clear();
  
  const spacing = 2;
  const range = 8;
  const lineLength = 5;
  
  // Positive side
  for (let x = -range; x <= range; x += spacing) {
    for (let y = -range; y <= range; y += spacing) {
      const startPos = new THREE.Vector3(x, y, 0.3);
      const direction = new THREE.Vector3(0, 0, 1);
      const arrowHelper = new THREE.ArrowHelper(direction, startPos, lineLength, 0x00dd00, 0.5, 0.25);
      fieldLinesGroup.add(arrowHelper);
    }
  }
  
  // Negative side
  for (let x = -range; x <= range; x += spacing) {
    for (let y = -range; y <= range; y += spacing) {
      const startPos = new THREE.Vector3(x, y, -0.3);
      const direction = new THREE.Vector3(0, 0, -1);
      const arrowHelper = new THREE.ArrowHelper(direction, startPos, lineLength, 0x00dd00, 0.5, 0.25);
      fieldLinesGroup.add(arrowHelper);
    }
  }
}

// Generate field lines from sphere surface (radial)
function generateSphereChargeFieldLines() {
  fieldLinesGroup.clear();
  
  const radius = 2;
  const numPhi = 10;
  const numTheta = 10;
  const lineLength = 5;
  
  for (let i = 0; i < numTheta; i++) {
    for (let j = 0; j < numPhi; j++) {
      const theta = (i / numTheta) * Math.PI * 2;
      const phi = (j / (numPhi - 1)) * Math.PI;
      
      const x = Math.sin(phi) * Math.cos(theta) * radius;
      const y = Math.cos(phi) * radius;
      const z = Math.sin(phi) * Math.sin(theta) * radius;
      
      const direction = new THREE.Vector3(x, y, z).normalize();
      const startPos = new THREE.Vector3(x, y, z).multiplyScalar(1.15);
      
      const arrowHelper = new THREE.ArrowHelper(direction, startPos, lineLength, 0x00dd00, 0.5, 0.25);
      fieldLinesGroup.add(arrowHelper);
    }
  }
}

// Store original surface geometry for unfolding
let originalSurfaceGeometry = null;
let unfoldedSurfaces = [];

// Generate closed surface (cylinder for line, box for plane, sphere for sphere)
function generateClosedSurface() {
  closedSurfaceGroup.clear();
  penetrationPointsGroup.clear();
  unfoldedSurfaces = [];
  
  if (currentChargeType === 'line') {
    // Cylindrical surface
    const cylinderGeometry = new THREE.CylinderGeometry(5, 5, 10, 32);
    const cylinderMaterial = new THREE.MeshBasicMaterial({
      color: 0x4a90e2,
      transparent: true,
      opacity: 0.15,
      wireframe: false,
      side: THREE.DoubleSide
    });
    const cylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial);
    closedSurfaceGroup.add(cylinder);
    
    // Top and bottom caps
    const capGeometry = new THREE.CircleGeometry(5, 32);
    const capMaterial = new THREE.MeshBasicMaterial({
      color: 0x4a90e2,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide
    });
    const topCap = new THREE.Mesh(capGeometry, capMaterial);
    topCap.position.y = 5;
    closedSurfaceGroup.add(topCap);
    
    const bottomCap = new THREE.Mesh(capGeometry, capMaterial);
    bottomCap.position.y = -5;
    closedSurfaceGroup.add(bottomCap);
    
    originalSurfaceGeometry = { type: 'cylinder', radius: 5, height: 10 };
  } else if (currentChargeType === 'plane') {
    // Cubic surface
    const boxGeometry = new THREE.BoxGeometry(8, 8, 8);
    const boxMaterial = new THREE.MeshBasicMaterial({
      color: 0x4a90e2,
      transparent: true,
      opacity: 0.15,
      wireframe: false,
      side: THREE.DoubleSide
    });
    const box = new THREE.Mesh(boxGeometry, boxMaterial);
    closedSurfaceGroup.add(box);
    
    originalSurfaceGeometry = { type: 'box', size: 8 };
  } else if (currentChargeType === 'sphere') {
    // Spherical surface
    const sphereGeometry = new THREE.SphereGeometry(6, 32, 32);
    const sphereMaterial = new THREE.MeshBasicMaterial({
      color: 0x4a90e2,
      transparent: true,
      opacity: 0.1,
      wireframe: false,
      side: THREE.DoubleSide
    });
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    closedSurfaceGroup.add(sphere);
    
    originalSurfaceGeometry = { type: 'sphere', radius: 6 };
  }
}

// Unfold closed surface with animation
function unfoldClosedSurface(progress) {
  if (!currentChargeType || !originalSurfaceGeometry) return;
  
  closedSurfaceGroup.clear();
  
  // Hide charge object and field lines during unfolding
  chargeGroup.visible = progress > 0;
  fieldLinesGroup.visible = progress > 0;
  
  if (currentChargeType === 'line') {
    // Cylindrical unfolding - like a toilet paper roll
    const { radius, height } = originalSurfaceGeometry;
    
    // Top cap (opens upward)
    const topCapGeometry = new THREE.CircleGeometry(radius, 32);
    const capMaterial = new THREE.MeshBasicMaterial({
      color: 0x4a90e2,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide
    });
    const topCap = new THREE.Mesh(topCapGeometry, capMaterial);
    topCap.position.y = height / 2 + progress * 3;
    closedSurfaceGroup.add(topCap);
    
    // Bottom cap (opens downward)
    const bottomCap = new THREE.Mesh(topCapGeometry, capMaterial);
    bottomCap.position.y = -height / 2 - progress * 3;
    closedSurfaceGroup.add(bottomCap);
    
    // Side unrolls left and right (opens like a book)
    const circumference = Math.PI * 2 * radius;
    const sideLeftGeometry = new THREE.PlaneGeometry(circumference / 2, height);
    const sideMaterial = new THREE.MeshBasicMaterial({
      color: 0x4a90e2,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide
    });
    
    const sideLeft = new THREE.Mesh(sideLeftGeometry, sideMaterial);
    sideLeft.position.x = -radius - progress * 4;
    closedSurfaceGroup.add(sideLeft);
    
    const sideRight = new THREE.Mesh(sideLeftGeometry, sideMaterial);
    sideRight.position.x = radius + progress * 4;
    closedSurfaceGroup.add(sideRight);
    
  } else if (currentChargeType === 'plane') {
    // Box unfolding - open like a flower (flat cross pattern)
    const { size } = originalSurfaceGeometry;
    const half = size / 2;
    
    const faceMaterial = new THREE.MeshBasicMaterial({
      color: 0x4a90e2,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide
    });
    
    // Center face stays in place
    const centerGeometry = new THREE.PlaneGeometry(size, size);
    const center = new THREE.Mesh(centerGeometry, faceMaterial);
    closedSurfaceGroup.add(center);
    
    // Top face
    const topGeometry = new THREE.PlaneGeometry(size, size);
    const top = new THREE.Mesh(topGeometry, faceMaterial);
    top.position.y = size / 2 + progress * size;
    top.rotation.x = -Math.PI / 2 * progress;
    closedSurfaceGroup.add(top);
    
    // Bottom face
    const bottomGeometry = new THREE.PlaneGeometry(size, size);
    const bottom = new THREE.Mesh(bottomGeometry, faceMaterial);
    bottom.position.y = -size / 2 - progress * size;
    bottom.rotation.x = Math.PI / 2 * progress;
    closedSurfaceGroup.add(bottom);
    
    // Right face
    const rightGeometry = new THREE.PlaneGeometry(size, size);
    const right = new THREE.Mesh(rightGeometry, faceMaterial);
    right.position.x = size / 2 + progress * size;
    right.rotation.z = -Math.PI / 2 * progress;
    closedSurfaceGroup.add(right);
    
    // Left face
    const leftGeometry = new THREE.PlaneGeometry(size, size);
    const left = new THREE.Mesh(leftGeometry, faceMaterial);
    left.position.x = -size / 2 - progress * size;
    left.rotation.z = Math.PI / 2 * progress;
    closedSurfaceGroup.add(left);
    
    // Front face
    const frontGeometry = new THREE.PlaneGeometry(size, size);
    const front = new THREE.Mesh(frontGeometry, faceMaterial);
    front.position.z = size / 2 + progress * size;
    front.rotation.y = Math.PI * progress;
    closedSurfaceGroup.add(front);
    
    // Back face
    const backGeometry = new THREE.PlaneGeometry(size, size);
    const back = new THREE.Mesh(backGeometry, faceMaterial);
    back.position.z = -size / 2 - progress * size;
    back.rotation.y = -Math.PI * progress;
    closedSurfaceGroup.add(back);
    
  } else if (currentChargeType === 'sphere') {
    // Sphere unfolding - like peeling an orange with flat strips
    const { radius } = originalSurfaceGeometry;
    const numSegments = 16;
    
    // Create vertical strips from top to bottom
    for (let i = 0; i < numSegments; i++) {
      const angle = (i / numSegments) * Math.PI * 2;
      const nextAngle = ((i + 1) / numSegments) * Math.PI * 2;
      
      // Create latitude strip geometry
      const stripGeometry = new THREE.SphereGeometry(
        radius, 
        2,           // width segments
        32,          // height segments
        angle, 
        nextAngle - angle,
        0,
        Math.PI
      );
      
      const stripMaterial = new THREE.MeshBasicMaterial({
        color: 0x4a90e2,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide
      });
      
      const strip = new THREE.Mesh(stripGeometry, stripMaterial);
      
      // Position strips in a fan pattern around the bottom
      const stripAngle = angle + (nextAngle - angle) / 2;
      const posDistance = radius + progress * 8;
      
      strip.position.x = Math.cos(stripAngle) * posDistance;
      strip.position.z = Math.sin(stripAngle) * posDistance;
      strip.position.y = -radius * Math.cos(progress * Math.PI / 2);
      
      closedSurfaceGroup.add(strip);
    }
  }
}

// Show field line penetration points on closed surface
function showPenetrationPoints() {
  penetrationPointsGroup.clear();
  
  if (!fieldLinesVisible || unfoldProgress < 0.1) return;
  
  const pointGeometry = new THREE.SphereGeometry(0.25, 8, 8);
  const pointMaterial = new THREE.MeshBasicMaterial({ color: 0xff3333, emissive: 0xff3333 });
  
  if (currentChargeType === 'line') {
    // Penetration points on cylinder surface
    const radius = 5;
    const numAngular = 16;
    const numHeights = 5;
    
    for (let h = 0; h < numHeights; h++) {
      const y = -6 + (h / (numHeights - 1)) * 12;
      
      for (let i = 0; i < numAngular; i++) {
        const angle = (i / numAngular) * Math.PI * 2;
        
        // During unfolding, map cylinder surface to unfolded position
        if (unfoldProgress >= 0.1) {
          // Which side (left or right half)?
          const side = angle < Math.PI ? -1 : 1;
          const circumference = Math.PI * 2 * radius;
          
          // Position along unfolded rectangle
          const x = -circumference / 4 + (angle % Math.PI) / Math.PI * (circumference / 2);
          const posX = x + side * (radius + unfoldProgress * 4);
          
          const point = new THREE.Mesh(pointGeometry, pointMaterial);
          point.position.set(posX, y, 0);
          penetrationPointsGroup.add(point);
        }
      }
    }
  } else if (currentChargeType === 'plane') {
    // Penetration points on box faces
    const size = 8;
    const spacing = 2;
    const range = 4;
    
    // Generate penetration points for all 6 faces
    const faceData = [
      { z: 4, x: null, y: null },   // front
      { z: -4, x: null, y: null },  // back
      { x: 4, y: null, z: null },   // right
      { x: -4, y: null, z: null },  // left
      { y: 4, x: null, z: null },   // top
      { y: -4, x: null, z: null }   // bottom
    ];
    
    faceData.forEach((face) => {
      for (let u = -range; u <= range; u += spacing) {
        for (let v = -range; v <= range; v += spacing) {
          const point = new THREE.Mesh(pointGeometry, pointMaterial);
          
          if (face.z !== null) {
            point.position.set(u, v, face.z + unfoldProgress * size);
          } else if (face.x !== null) {
            point.position.set(face.x + unfoldProgress * size, u, v);
          } else if (face.y !== null) {
            point.position.set(u, face.y + unfoldProgress * size, v);
          }
          
          penetrationPointsGroup.add(point);
        }
      }
    });
    
  } else if (currentChargeType === 'sphere') {
    // Penetration points on sphere - arranged in fan pattern when unfolded
    const radius = 6;
    const numPhi = 10;
    const numTheta = 10;
    
    for (let i = 0; i < numTheta; i++) {
      for (let j = 0; j < numPhi; j++) {
        const theta = (i / numTheta) * Math.PI * 2;
        const phi = (j / (numPhi - 1)) * Math.PI;
        
        const x = Math.sin(phi) * Math.cos(theta) * radius;
        const y = Math.cos(phi) * radius;
        const z = Math.sin(phi) * Math.sin(theta) * radius;
        
        // Map to unfolded position
        const stripAngle = theta;
        const posDistance = radius + unfoldProgress * 8;
        const unfoldedX = Math.cos(stripAngle) * posDistance;
        const unfoldedZ = Math.sin(stripAngle) * posDistance;
        const unfoldedY = -radius * Math.cos(unfoldProgress * Math.PI / 2) + phi * 2;
        
        const point = new THREE.Mesh(pointGeometry, pointMaterial);
        point.position.set(unfoldedX, unfoldedY, unfoldedZ);
        penetrationPointsGroup.add(point);
      }
    }
  }
}

// Update all visualizations
function updateFieldLines() {
  if (!currentChargeType) return;
  
  if (fieldLinesVisible) {
    if (currentChargeType === 'line') {
      generateLineChargeFieldLines();
    } else if (currentChargeType === 'plane') {
      generatePlaneChargeFieldLines();
    } else if (currentChargeType === 'sphere') {
      generateSphereChargeFieldLines();
    }
  } else {
    fieldLinesGroup.clear();
  }
  
  document.getElementById('fieldLineCount').textContent = fieldLinesGroup.children.length;
}

function updateClosedSurface() {
  if (!currentChargeType) return;
  
  if (closedSurfaceVisible) {
    generateClosedSurface();
  } else {
    closedSurfaceGroup.clear();
    penetrationPointsGroup.clear();
  }
}

// Charge button handlers
document.querySelectorAll('.charge-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const type = e.target.dataset.type;
    
    document.querySelectorAll('.charge-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    
    currentChargeType = type;
    unfoldProgress = 0;
    isUnfolding = false;
    
    if (type === 'line') {
      createLineCharge();
    } else if (type === 'plane') {
      createPlaneCharge();
    } else if (type === 'sphere') {
      createConductingSphere();
    }
    
    updateFieldLines();
    updateClosedSurface();
    document.getElementById('chargeDesc').textContent = descriptions[type];
  });
});

// Toggle field lines
document.getElementById('toggleFieldLines').addEventListener('click', (e) => {
  fieldLinesVisible = !fieldLinesVisible;
  e.target.classList.toggle('active');
  updateFieldLines();
  showPenetrationPoints();
});

// Toggle closed surface
document.getElementById('toggleClosedSurface').addEventListener('click', (e) => {
  closedSurfaceVisible = !closedSurfaceVisible;
  e.target.classList.toggle('active');
  updateClosedSurface();
  unfoldProgress = 0;
  isUnfolding = false;
  document.getElementById('toggleUnfold').classList.remove('active');
});

// Unfold closed surface
document.getElementById('toggleUnfold').addEventListener('click', (e) => {
  if (!closedSurfaceVisible) {
    alert('先に「電場が等しい閉曲面を表示」をONにしてください');
    return;
  }
  
  isUnfolding = !isUnfolding;
  e.target.classList.toggle('active');
});

// Reset button
document.getElementById('resetBtn').addEventListener('click', () => {
  chargeGroup.clear();
  fieldLinesGroup.clear();
  closedSurfaceGroup.clear();
  penetrationPointsGroup.clear();
  currentChargeType = null;
  fieldLinesVisible = false;
  closedSurfaceVisible = false;
  isUnfolding = false;
  unfoldProgress = 0;
  
  document.querySelectorAll('.charge-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('toggleFieldLines').classList.remove('active');
  document.getElementById('toggleClosedSurface').classList.remove('active');
  document.getElementById('toggleUnfold').classList.remove('active');
  document.getElementById('chargeDesc').textContent = '';
  document.getElementById('fieldLineCount').textContent = '0';
  
  cameraRadius = 24;
  cameraPhi = Math.PI / 4;
  cameraTheta = Math.PI / 4;
  updateCameraPosition();
});

// Animation toggle
document.getElementById('toggleAnimBtn').addEventListener('click', (e) => {
  isAnimating = !isAnimating;
  e.target.textContent = isAnimating ? '一時停止' : '再生';
});

// Camera rotation controls (without moving origin)
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };

document.addEventListener('mousedown', (e) => {
  isDragging = true;
  previousMousePosition = { x: e.clientX, y: e.clientY };
});

document.addEventListener('mousemove', (e) => {
  if (isDragging) {
    const deltaX = e.clientX - previousMousePosition.x;
    const deltaY = e.clientY - previousMousePosition.y;
    
    cameraTheta -= deltaX * 0.01;
    cameraPhi -= deltaY * 0.01;
    
    // Clamp phi to avoid gimbal lock
    cameraPhi = Math.max(0.1, Math.min(Math.PI - 0.1, cameraPhi));
    
    updateCameraPosition();
    previousMousePosition = { x: e.clientX, y: e.clientY };
  }
});

document.addEventListener('mouseup', () => {
  isDragging = false;
});

// Zoom with mouse wheel
document.addEventListener('wheel', (e) => {
  e.preventDefault();
  cameraRadius += e.deltaY * 0.02;
  cameraRadius = Math.max(5, Math.min(100, cameraRadius));
  updateCameraPosition();
}, { passive: false });

// Touch controls
let touchStart = { x: 0, y: 0 };

document.addEventListener('touchstart', (e) => {
  if (e.touches.length === 1) {
    touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
});

document.addEventListener('touchmove', (e) => {
  if (e.touches.length === 1) {
    const deltaX = e.touches[0].clientX - touchStart.x;
    const deltaY = e.touches[0].clientY - touchStart.y;
    
    cameraTheta -= deltaX * 0.01;
    cameraPhi -= deltaY * 0.01;
    
    cameraPhi = Math.max(0.1, Math.min(Math.PI - 0.1, cameraPhi));
    
    updateCameraPosition();
    touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  } else if (e.touches.length === 2) {
    const touch1 = e.touches[0];
    const touch2 = e.touches[1];
    const dist = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);
    
    if (!window.lastPinchDist) window.lastPinchDist = dist;
    const delta = dist - window.lastPinchDist;
    cameraRadius += delta * 0.02;
    cameraRadius = Math.max(5, Math.min(100, cameraRadius));
    updateCameraPosition();
    window.lastPinchDist = dist;
  }
}, { passive: false });

document.addEventListener('touchend', () => {
  window.lastPinchDist = null;
});

// Handle window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  
  if (isAnimating && chargeObject) {
    chargeObject.rotation.y += 0.005;
  }
  
  // Handle unfolding animation
  if (isUnfolding) {
    unfoldProgress = Math.min(unfoldProgress + 0.02, 1.0);
    unfoldClosedSurface(unfoldProgress);
    
    if (unfoldProgress >= 0.1) {
      showPenetrationPoints();
    }
  } else {
    if (unfoldProgress > 0) {
      unfoldProgress = Math.max(unfoldProgress - 0.02, 0);
      unfoldClosedSurface(unfoldProgress);
    } else {
      chargeGroup.visible = true;
      fieldLinesGroup.visible = fieldLinesVisible;
      penetrationPointsGroup.clear();
    }
  }
  
  renderer.render(scene, camera);
}

animate();

// Update last modified
const updated = new Date(document.lastModified);
const yyyy = updated.getFullYear();
const mm = String(updated.getMonth() + 1).padStart(2, '0');
const dd = String(updated.getDate()).padStart(2, '0');
const hh = String(updated.getHours()).padStart(2, '0');
const min = String(updated.getMinutes()).padStart(2, '0');
document.getElementById('lastUpdated').textContent = `最終更新：${yyyy}/${mm}/${dd} ${hh}:${min}`;
