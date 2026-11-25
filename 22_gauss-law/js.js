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
let surfaceOnlyVisible = false;
let arrowsVisible = false;
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
  
  const lineRadius = 1;  // Start from line charge surface
  const numAngular = 16;
  const numHeights = 5;
  const lineLength = 10;  // Extend beyond closed surface (radius 8) for visual effect
  
  // Field lines start from the line charge (Y-axis) and radiate outward
  for (let h = 0; h < numHeights; h++) {
    const y = -5 + (h / (numHeights - 1)) * 10;  // y range [-5, 5]
    
    for (let i = 0; i < numAngular; i++) {
      const angle = (i / numAngular) * Math.PI * 2;
      
      // Start from line charge surface
      const startX = Math.cos(angle) * lineRadius;
      const startZ = Math.sin(angle) * lineRadius;
      const startPos = new THREE.Vector3(startX, y, startZ);
      
      // Direction: radially outward from Y-axis
      const direction = new THREE.Vector3(startX, 0, startZ).normalize();
      const endPos = startPos.clone().addScaledVector(direction, lineLength);
      
      // Create line
      const lineGeometry = new THREE.BufferGeometry();
      lineGeometry.setAttribute('position', new THREE.BufferAttribute(
        new Float32Array([startPos.x, startPos.y, startPos.z, endPos.x, endPos.y, endPos.z]),
        3
      ));
      const lineMaterial = new THREE.LineBasicMaterial({ color: 0x00dd00, linewidth: 2 });
      const line = new THREE.Line(lineGeometry, lineMaterial);
      fieldLinesGroup.add(line);
      
      // Add arrow if enabled
      if (arrowsVisible) {
        const arrowHelper = new THREE.ArrowHelper(direction, startPos, lineLength, 0x00dd00, 0.6, 0.35);
        fieldLinesGroup.add(arrowHelper);
      }
    }
  }
}

// Generate field lines from plane (perpendicular to plane)
function generatePlaneChargeFieldLines() {
  fieldLinesGroup.clear();
  
  const spacing = 2;
  const range = 4;
  const lineLength = 7;  // Extend beyond closed surface (z=±4) for visual effect
  
  // Positive side (z = 0.5 starts, goes to z = 7.5)
  for (let x = -range; x <= range; x += spacing) {
    for (let y = -range; y <= range; y += spacing) {
      const startPos = new THREE.Vector3(x, y, 0.5);
      const direction = new THREE.Vector3(0, 0, 1);
      const endPos = startPos.clone().addScaledVector(direction, lineLength);
      
      // Create line
      const lineGeometry = new THREE.BufferGeometry();
      lineGeometry.setAttribute('position', new THREE.BufferAttribute(
        new Float32Array([startPos.x, startPos.y, startPos.z, endPos.x, endPos.y, endPos.z]),
        3
      ));
      const lineMaterial = new THREE.LineBasicMaterial({ color: 0x00dd00, linewidth: 2 });
      const line = new THREE.Line(lineGeometry, lineMaterial);
      fieldLinesGroup.add(line);
      
      // Add arrow if enabled
      if (arrowsVisible) {
        const arrowHelper = new THREE.ArrowHelper(direction, startPos, lineLength, 0x00dd00, 0.5, 0.25);
        fieldLinesGroup.add(arrowHelper);
      }
    }
  }
  
  // Negative side (z = -0.5 starts, goes to z = -5.5)
  for (let x = -range; x <= range; x += spacing) {
    for (let y = -range; y <= range; y += spacing) {
      const startPos = new THREE.Vector3(x, y, -0.5);
      const direction = new THREE.Vector3(0, 0, -1);
      const endPos = startPos.clone().addScaledVector(direction, lineLength);
      
      // Create line
      const lineGeometry = new THREE.BufferGeometry();
      lineGeometry.setAttribute('position', new THREE.BufferAttribute(
        new Float32Array([startPos.x, startPos.y, startPos.z, endPos.x, endPos.y, endPos.z]),
        3
      ));
      const lineMaterial = new THREE.LineBasicMaterial({ color: 0x00dd00, linewidth: 2 });
      const line = new THREE.Line(lineGeometry, lineMaterial);
      fieldLinesGroup.add(line);
      
      // Add arrow if enabled
      if (arrowsVisible) {
        const arrowHelper = new THREE.ArrowHelper(direction, startPos, lineLength, 0x00dd00, 0.5, 0.25);
        fieldLinesGroup.add(arrowHelper);
      }
    }
  }
}

// Generate field lines from sphere surface (radial)
function generateSphereChargeFieldLines() {
  fieldLinesGroup.clear();
  
  const radius = 2;
  const numLines = 100;  // Total number of field lines
  const lineLength = 6;  // Extend beyond closed surface (radius 6) for visual effect
  
  // Use golden angle for even distribution over sphere
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));  // ≈ 2.39996 rad
  
  for (let i = 0; i < numLines; i++) {
    const y = 1 - (i / (numLines - 1)) * 2;  // y from 1 to -1
    const radiusAtY = Math.sqrt(1 - y * y);  // Radius at this height
    const theta = goldenAngle * i;  // Golden angle rotation
    
    const x = Math.cos(theta) * radiusAtY * radius;
    const z = Math.sin(theta) * radiusAtY * radius;
    const posY = y * radius;
    
    const direction = new THREE.Vector3(x, posY, z).normalize();
    const startPos = new THREE.Vector3(x, posY, z);  // Start from sphere surface
    const endPos = startPos.clone().addScaledVector(direction, lineLength);
    
    // Create line
    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute('position', new THREE.BufferAttribute(
      new Float32Array([startPos.x, startPos.y, startPos.z, endPos.x, endPos.y, endPos.z]),
      3
    ));
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x00dd00, linewidth: 2 });
    const line = new THREE.Line(lineGeometry, lineMaterial);
    fieldLinesGroup.add(line);
    
    // Add arrow if enabled
    if (arrowsVisible) {
      const arrowHelper = new THREE.ArrowHelper(direction, startPos, lineLength, 0x00dd00, 0.5, 0.25);
      fieldLinesGroup.add(arrowHelper);
    }
  }
}

// Generate closed surface (cylinder for line, box for plane, sphere for sphere)
function generateClosedSurface() {
  closedSurfaceGroup.clear();
  
  if (currentChargeType === 'line') {
    // Cylindrical surface
    const cylinderGeometry = new THREE.CylinderGeometry(5, 5, 11, 32);
    const cylinderMaterial = new THREE.MeshBasicMaterial({
      color: 0x4a90e2,
      transparent: true,
      opacity: 0.15,
      wireframe: false,
      side: THREE.DoubleSide
    });
    const cylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial);
    closedSurfaceGroup.add(cylinder);
    
    // Top cap (rotate to face +Y direction)
    const topCapGeometry = new THREE.CircleGeometry(5, 32);
    const capMaterial = new THREE.MeshBasicMaterial({
      color: 0x4a90e2,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide
    });
    const topCap = new THREE.Mesh(topCapGeometry, capMaterial);
    topCap.position.y = 5.5;
    topCap.rotation.x = Math.PI / 2;
    closedSurfaceGroup.add(topCap);
    
    // Bottom cap (rotate to face -Y direction)
    const bottomCap = new THREE.Mesh(topCapGeometry, capMaterial);
    bottomCap.position.y = -5.5;
    bottomCap.rotation.x = -Math.PI / 2;
    closedSurfaceGroup.add(bottomCap);
    
  } else if (currentChargeType === 'plane') {
    // Cubic surface - base increased by 10%
    const boxGeometry = new THREE.BoxGeometry(8.8, 8.8, 8);
    const boxMaterial = new THREE.MeshBasicMaterial({
      color: 0x4a90e2,
      transparent: true,
      opacity: 0.15,
      wireframe: false,
      side: THREE.DoubleSide
    });
    const box = new THREE.Mesh(boxGeometry, boxMaterial);
    closedSurfaceGroup.add(box);
    
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
  }
}

// Show field line penetration points on closed surface
function showPenetrationPoints() {
  penetrationPointsGroup.clear();
  
  // Only show when surface-only mode is active
  if (!surfaceOnlyVisible || !currentChargeType) return;
  
  const pointGeometry = new THREE.SphereGeometry(0.3, 8, 8);
  const pointMaterial = new THREE.MeshBasicMaterial({ color: 0xff3333, emissive: 0xff3333 });
  
  if (currentChargeType === 'line') {
    // For line charge: points on cylinder surface (closed surface at radius 5)
    // Field lines span y ∈ [-5, 5], same as generateLineChargeFieldLines
    const closedRadius = 5;
    const numAngular = 16;
    const numHeights = 5;
    
    for (let h = 0; h < numHeights; h++) {
      const y = -5 + (h / (numHeights - 1)) * 10;  // y ∈ [-5, 5]
      
      for (let i = 0; i < numAngular; i++) {
        const angle = (i / numAngular) * Math.PI * 2;
        const x = Math.cos(angle) * closedRadius;
        const z = Math.sin(angle) * closedRadius;
        
        const point = new THREE.Mesh(pointGeometry, pointMaterial);
        point.position.set(x, y, z);
        penetrationPointsGroup.add(point);
      }
    }
    
  } else if (currentChargeType === 'plane') {
    // For plane charge: field lines penetrate at z = ±4 (closed surface boundary)
    // Field lines span x,y ∈ [-4, 4] with spacing 2
    const spacing = 2;
    const range = 4;
    
    // Positive side (z = 4)
    for (let x = -range; x <= range; x += spacing) {
      for (let y = -range; y <= range; y += spacing) {
        const point = new THREE.Mesh(pointGeometry, pointMaterial);
        point.position.set(x, y, 4);
        penetrationPointsGroup.add(point);
      }
    }
    
    // Negative side (z = -4)
    for (let x = -range; x <= range; x += spacing) {
      for (let y = -range; y <= range; y += spacing) {
        const point = new THREE.Mesh(pointGeometry, pointMaterial);
        point.position.set(x, y, -4);
        penetrationPointsGroup.add(point);
      }
    }
    
  } else if (currentChargeType === 'sphere') {
    // For sphere: points on closed surface (radius 6) where field lines exit
    // Field lines start at radius 2 and extend 4 units to radius 6
    const exitRadius = 6;
    const numLines = 100;
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    
    for (let i = 0; i < numLines; i++) {
      const y = 1 - (i / (numLines - 1)) * 2;  // y from 1 to -1
      const radiusAtY = Math.sqrt(1 - y * y);  // Radius at this height
      const theta = goldenAngle * i;  // Golden angle rotation
      
      const x = Math.cos(theta) * radiusAtY * exitRadius;
      const z = Math.sin(theta) * radiusAtY * exitRadius;
      const posY = y * exitRadius;
      
      const point = new THREE.Mesh(pointGeometry, pointMaterial);
      point.position.set(x, posY, z);
      penetrationPointsGroup.add(point);
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
  
  if (closedSurfaceVisible || surfaceOnlyVisible) {
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

// Toggle closed surface display
document.getElementById('toggleClosedSurface').addEventListener('click', (e) => {
  closedSurfaceVisible = !closedSurfaceVisible;
  surfaceOnlyVisible = false;
  e.target.classList.toggle('active');
  document.getElementById('toggleSurfaceOnly').classList.remove('active');
  chargeGroup.visible = true;
  fieldLinesGroup.visible = fieldLinesVisible;
  updateClosedSurface();
  penetrationPointsGroup.clear();
});

// Toggle surface only view (hide charge object and field lines)
document.getElementById('toggleSurfaceOnly').addEventListener('click', (e) => {
  surfaceOnlyVisible = !surfaceOnlyVisible;
  closedSurfaceVisible = false;
  e.target.classList.toggle('active');
  document.getElementById('toggleClosedSurface').classList.remove('active');
  
  if (surfaceOnlyVisible) {
    chargeGroup.visible = false;
    fieldLinesGroup.visible = false;
    updateClosedSurface();
    showPenetrationPoints();
  } else {
    chargeGroup.visible = true;
    fieldLinesGroup.visible = fieldLinesVisible;
    closedSurfaceGroup.clear();
    penetrationPointsGroup.clear();
  }
});

// Toggle arrows display
document.getElementById('toggleArrows').addEventListener('change', (e) => {
  arrowsVisible = e.target.checked;
  if (fieldLinesVisible) {
    updateFieldLines();
  }
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
  surfaceOnlyVisible = false;
  
  document.querySelectorAll('.charge-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('toggleFieldLines').classList.remove('active');
  document.getElementById('toggleClosedSurface').classList.remove('active');
  document.getElementById('toggleSurfaceOnly').classList.remove('active');
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
