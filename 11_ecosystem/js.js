// Canvas setup
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// Set canvas size (fixed for iPad)
canvas.width = 900;
canvas.height = 500;

// Control elements
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const stopBtn = document.getElementById('stopBtn');
const resetBtn = document.getElementById('resetBtn');
const algaeSplitCountSlider = document.getElementById('algaeSplitCount');
const algaeSplitValue = document.getElementById('algaeSplitValue');
const initialAlgaeSlider = document.getElementById('initialAlgae');
const initialAlgaeValue = document.getElementById('initialAlgaeValue');
const initialFishSlider = document.getElementById('initialFish');
const initialFishValue = document.getElementById('initialFishValue');
const initialShrimpSlider = document.getElementById('initialShrimp');
const initialShrimpValue = document.getElementById('initialShrimpValue');
const fishAppetiteSlider = document.getElementById('fishAppetite');
const fishAppetiteValue = document.getElementById('fishAppetiteValue');
const shrimpAppetiteSlider = document.getElementById('shrimpAppetite');
const shrimpAppetiteValue = document.getElementById('shrimpAppetiteValue');
const moveSpeedSlider = document.getElementById('moveSpeed');
const moveSpeedValue = document.getElementById('moveSpeedValue');
const fishReproductionSlider = document.getElementById('fishReproduction');
const fishReproductionValue = document.getElementById('fishReproductionValue');
const shrimpReproductionSlider = document.getElementById('shrimpReproduction');
const shrimpReproductionValue = document.getElementById('shrimpReproductionValue');
const instructionBanner = document.getElementById('instructionBanner');

// Game state
let isRunning = false;
let animationId = null;
let creatures = [];
let lastHpDecreaseTime = 0;
const hpDecreaseInterval = 1000; // 1秒ごとにHP減少

// Settings
let algaeSplitCount = 2; // 藻の分裂個数
let initialAlgaeCount = 5; // 初期藻個数
let initialFishCount = 3; // 初期小魚個数
let initialShrimpCount = 2; // 初期エビ個数
let fishAppetite = 50; // 小魚の食欲（食べる確率%）
let shrimpAppetite = 50; // エビの食欲（食べる確率%）
let moveSpeed = 1.0; // 移動速度
let fishReproduction = 1; // 小魚の繁殖力（増殖個体数）
let shrimpReproduction = 1; // エビの繁殖力（増殖個体数）

// 生き物のタイプ
const CreatureType = {
    ALGAE: 'algae',    // 藻
    FISH: 'fish',      // 小魚
    SHRIMP: 'shrimp'   // エビ
};

// 生き物のクラス
class Creature {
    constructor(type, x, y) {
        this.type = type;
        this.x = x;
        this.y = y;
        // エビのHPは2倍
        this.maxHp = (type === CreatureType.SHRIMP) ? 200 : 100;
        this.hp = this.maxHp; // 初期HP
        this.baseSpeed = (Math.random() - 0.5) * 2; // 左右ランダム移動
        this.vx = this.baseSpeed * moveSpeed;
        this.size = this.getSize();
        this.color = this.getColor();
        this.eatDistance = 30; // 食べる距離
        this.eaten = false; // 食べられたかどうか
        this.lastTurnTime = Date.now(); // 最後にターンした時刻
        this.readyToReproduce = false; // 繁殖準備フラグ
        this.hasEatenThisTurn = false; // このターンで食事したか
    }
    
    getSize() {
        switch(this.type) {
            case CreatureType.ALGAE: return 8;
            case CreatureType.FISH: return 12;
            case CreatureType.SHRIMP: return 15;
            default: return 10;
        }
    }
    
    getColor() {
        switch(this.type) {
            case CreatureType.ALGAE: return '#27ae60';  // 緑
            case CreatureType.FISH: return '#3498db';   // 青
            case CreatureType.SHRIMP: return '#e74c3c'; // 赤
            default: return '#ffffff';
        }
    }
    
    update() {
        // 藻は移動しない
        if (this.type === CreatureType.ALGAE) {
            return;
        }
        
        // 移動速度を更新
        this.vx = this.baseSpeed * moveSpeed;
        
        // 左右に移動
        this.x += this.vx;
        
        // 壁で反転
        if (this.x < this.size || this.x > canvas.width - this.size) {
            this.baseSpeed *= -1;
            this.vx = this.baseSpeed * moveSpeed;
            this.x = Math.max(this.size, Math.min(canvas.width - this.size, this.x));
        }
        
        // 1秒ごとに10%の確率で方向転換
        const currentTime = Date.now();
        if (currentTime - this.lastTurnTime >= 1000) {
            this.lastTurnTime = currentTime;
            if (Math.random() < 0.1) {
                this.baseSpeed *= -1;
            }
        }
    }
    
    draw() {
        // 本体を描画
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        
        // HPバーを描画
        const barWidth = 30;
        const barHeight = 4;
        const barX = this.x - barWidth / 2;
        const barY = this.y - this.size - 10;
        
        // 背景（赤）
        ctx.fillStyle = '#555';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        
        // HP（緑）
        const hpWidth = (this.hp / this.maxHp) * barWidth;
        ctx.fillStyle = this.hp > 30 ? '#27ae60' : '#e74c3c';
        ctx.fillRect(barX, barY, hpWidth, barHeight);
    }
    
    decreaseHp(amount) {
        this.hp -= amount;
        if (this.hp < 0) this.hp = 0;
    }
    
    increaseHp(amount) {
        this.hp += amount;
        if (this.hp > this.maxHp) this.hp = this.maxHp;
    }
    
    isDead() {
        return this.hp <= 0;
    }
    
    isFullHp() {
        return this.hp >= this.maxHp;
    }
}

// 初期化
function init() {
    creatures = [];
    
    // 初期生物を配置
    const bottomY = canvas.height - 50; // 水槽の底
    
    // 藻を配置
    for (let i = 0; i < initialAlgaeCount; i++) {
        const x = 50 + (canvas.width - 100) * i / Math.max(1, initialAlgaeCount - 1);
        creatures.push(new Creature(CreatureType.ALGAE, x, bottomY));
    }
    
    // 小魚を配置
    for (let i = 0; i < initialFishCount; i++) {
        const x = 50 + (canvas.width - 100) * i / Math.max(1, initialFishCount - 1);
        creatures.push(new Creature(CreatureType.FISH, x, bottomY));
    }
    
    // エビを配置
    for (let i = 0; i < initialShrimpCount; i++) {
        const x = 50 + (canvas.width - 100) * i / Math.max(1, initialShrimpCount - 1);
        creatures.push(new Creature(CreatureType.SHRIMP, x, bottomY));
    }
}

// リセット
function reset() {
    stop();
    init();
    draw();
}

// 開始
function start() {
    if (!isRunning) {
        isRunning = true;
        startBtn.style.display = 'none';
        pauseBtn.style.display = 'inline-block';
        lastHpDecreaseTime = Date.now();
        gameLoop();
    }
}

// 一時停止
function pause() {
    isRunning = false;
    startBtn.style.display = 'inline-block';
    pauseBtn.style.display = 'none';
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
}

// 停止
function stop() {
    isRunning = false;
    startBtn.style.display = 'inline-block';
    pauseBtn.style.display = 'none';
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
}

// 距離計算
function distance(x1, y1, x2, y2) {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

// 食べる処理
function processEating() {
    const newCreatures = [];
    
    for (let i = 0; i < creatures.length; i++) {
        const creature = creatures[i];
        
        // 小魚が藻を食べる（1ターンに1回まで）
        if (creature.type === CreatureType.FISH && !creature.eaten && !creature.hasEatenThisTurn && Math.random() * 100 < fishAppetite) {
            const nearbyAlgae = creatures.filter(c => 
                c.type === CreatureType.ALGAE && 
                !c.isDead() && 
                !c.eaten &&
                Math.abs(creature.x - c.x) < creature.eatDistance
            );
            
            if (nearbyAlgae.length > 0) {
                const target = nearbyAlgae[0];
                target.eaten = true; // 食べられたフラグを立てる
                target.hp = 0; // HPも0にする
                creature.increaseHp(creature.maxHp * 0.3); // HP30%回復                creature.hasEatenThisTurn = true; // このターンで食事した                
                // HPが満タンになったら増殖（指定された個体数だけ生成）
                if (creature.isFullHp()) {
                    for (let i = 0; i < fishReproduction; i++) {
                        const angle = (Math.random() * Math.PI * 2);
                        const dist = 20 + Math.random() * 30;
                        const newX = creature.x + Math.cos(angle) * dist;
                        const newY = creature.y + Math.sin(angle) * dist;
                        const newFish = new Creature(
                            CreatureType.FISH, 
                            Math.max(20, Math.min(canvas.width - 20, newX)), 
                            Math.max(20, Math.min(canvas.height - 20, newY))
                        );
                        newCreatures.push(newFish);
                    }
                    // 繁殖後HPを最大HPの30%にリセット
                    creature.hp = creature.maxHp * 0.3;
                }
            }
        }
        
        // エビが小魚を食べる（1ターンに1回まで）
        if (creature.type === CreatureType.SHRIMP && !creature.eaten && !creature.hasEatenThisTurn && Math.random() * 100 < shrimpAppetite) {
            const nearbyFish = creatures.filter(c => 
                c.type === CreatureType.FISH && 
                !c.isDead() && 
                !c.eaten &&
                Math.abs(creature.x - c.x) < creature.eatDistance
            );
            
            if (nearbyFish.length > 0) {
                const target = nearbyFish[0];
                target.eaten = true; // 食べられたフラグを立てる
                target.hp = 0; // HPを0にする
                creature.increaseHp(creature.maxHp * 0.3); // HP30%回復
                creature.hasEatenThisTurn = true; // このターンで食事した
                
                // HPが満タンになったら繁殖準備フラグを立てる
                if (creature.isFullHp()) {
                    creature.readyToReproduce = true;
                }
            }
        }
    }
    
    // 新しい生き物を追加
    creatures.push(...newCreatures);
}

// HP減少と藻の分裂処理
function processHpDecrease() {
    const currentTime = Date.now();
    if (currentTime - lastHpDecreaseTime >= hpDecreaseInterval) {
        lastHpDecreaseTime = currentTime;
        
        const newCreatures = [];
        
        for (let creature of creatures) {
            // 食事フラグをリセット（新しいターン）
            creature.hasEatenThisTurn = false;
            
            // HPを減少
            creature.decreaseHp(10);
            
            // 繁殖準備ができている小魚やエビを繁殖させる
            if (creature.readyToReproduce && !creature.eaten) {
                if (creature.type === CreatureType.FISH) {
                    for (let i = 0; i < fishReproduction; i++) {
                        const angle = (Math.random() * Math.PI * 2);
                        const dist = 20 + Math.random() * 30;
                        const newX = creature.x + Math.cos(angle) * dist;
                        const newY = creature.y + Math.sin(angle) * dist;
                        const newFish = new Creature(
                            CreatureType.FISH,
                            Math.max(20, Math.min(canvas.width - 20, newX)),
                            Math.max(20, Math.min(canvas.height - 20, newY))
                        );
                        newCreatures.push(newFish);
                    }
                    creature.hp = creature.maxHp * 0.3;
                    creature.readyToReproduce = false;
                } else if (creature.type === CreatureType.SHRIMP) {
                    for (let i = 0; i < shrimpReproduction; i++) {
                        const angle = (Math.random() * Math.PI * 2);
                        const dist = 20 + Math.random() * 30;
                        const newX = creature.x + Math.cos(angle) * dist;
                        const newY = creature.y + Math.sin(angle) * dist;
                        const newShrimp = new Creature(
                            CreatureType.SHRIMP,
                            Math.max(20, Math.min(canvas.width - 20, newX)),
                            Math.max(20, Math.min(canvas.height - 20, newY))
                        );
                        newCreatures.push(newShrimp);
                    }
                    creature.hp = creature.maxHp * 0.3;
                    creature.readyToReproduce = false;
                }
            }
            
            // 藻がHPが0になったら分裂
            if (creature.type === CreatureType.ALGAE && creature.isDead()) {
                for (let i = 0; i < algaeSplitCount; i++) {
                    const angle = (Math.PI * 2 / algaeSplitCount) * i;
                    const distance = 30;
                    const newX = creature.x + Math.cos(angle) * distance;
                    const newY = creature.y + Math.sin(angle) * distance;
                    
                    const newAlgae = new Creature(
                        CreatureType.ALGAE,
                        Math.max(20, Math.min(canvas.width - 20, newX)),
                        Math.max(20, Math.min(canvas.height - 20, newY))
                    );
                    newCreatures.push(newAlgae);
                }
            }
        }
        
        // 死んだ生き物を除去（藻以外）
        creatures = creatures.filter(c => (!c.isDead() && !c.eaten) || c.type === CreatureType.ALGAE);
        
        // 藻も死んでいたり食べられていたら除去して新しい藻を追加
        creatures = creatures.filter(c => c.type !== CreatureType.ALGAE || (!c.isDead() && !c.eaten));
        creatures.push(...newCreatures);
    }
}

// 描画
function draw() {
    // 背景をクリア
    ctx.fillStyle = 'rgba(26, 77, 109, 0.3)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 水槽の底を描画
    const bottomY = canvas.height - 30;
    ctx.fillStyle = '#8B7355';
    ctx.fillRect(0, bottomY, canvas.width, canvas.height - bottomY);
    
    // 生き物を描画
    for (let creature of creatures) {
        creature.draw();
    }
    
    // 統計情報を表示
    const algaeCount = creatures.filter(c => c.type === CreatureType.ALGAE).length;
    const fishCount = creatures.filter(c => c.type === CreatureType.FISH).length;
    const shrimpCount = creatures.filter(c => c.type === CreatureType.SHRIMP).length;
    
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px Arial';
    ctx.fillText(`🟢 藻: ${algaeCount}`, 10, 30);
    ctx.fillText(`🔵 小魚: ${fishCount}`, 10, 55);
    ctx.fillText(`🔴 エビ: ${shrimpCount}`, 10, 80);
}

// ゲームループ
function gameLoop() {
    if (!isRunning) return;
    
    // HP減少処理
    processHpDecrease();
    
    // 食べる処理
    processEating();
    
    // 生き物を更新
    for (let creature of creatures) {
        creature.update();
    }
    
    // 描画
    draw();
    
    // 生物数が2000を超えたらシミュレーション終了
    const algaeCount = creatures.filter(c => c.type === CreatureType.ALGAE).length;
    const fishCount = creatures.filter(c => c.type === CreatureType.FISH).length;
    const shrimpCount = creatures.filter(c => c.type === CreatureType.SHRIMP).length;
    
    if (algaeCount > 2000 || fishCount > 2000 || shrimpCount > 2000) {
        stop();
        alert(`シミュレーション終了\n藻: ${algaeCount}\n小魚: ${fishCount}\nエビ: ${shrimpCount}\n\nいずれかの生物が2000を超えました。`);
        return;
    }
    
    animationId = requestAnimationFrame(gameLoop);
}

// イベントリスナー
startBtn.addEventListener('click', start);
pauseBtn.addEventListener('click', pause);
stopBtn.addEventListener('click', stop);
resetBtn.addEventListener('click', reset);

algaeSplitCountSlider.addEventListener('input', (e) => {
    algaeSplitCount = parseInt(e.target.value);
    algaeSplitValue.textContent = algaeSplitCount;
});

initialAlgaeSlider.addEventListener('input', (e) => {
    initialAlgaeCount = parseInt(e.target.value);
    initialAlgaeValue.textContent = initialAlgaeCount;
});

initialFishSlider.addEventListener('input', (e) => {
    initialFishCount = parseInt(e.target.value);
    initialFishValue.textContent = initialFishCount;
});

initialShrimpSlider.addEventListener('input', (e) => {
    initialShrimpCount = parseInt(e.target.value);
    initialShrimpValue.textContent = initialShrimpCount;
});

fishAppetiteSlider.addEventListener('input', (e) => {
    fishAppetite = parseInt(e.target.value);
    fishAppetiteValue.textContent = fishAppetite;
});

shrimpAppetiteSlider.addEventListener('input', (e) => {
    shrimpAppetite = parseInt(e.target.value);
    shrimpAppetiteValue.textContent = shrimpAppetite;
});

moveSpeedSlider.addEventListener('input', (e) => {
    moveSpeed = parseFloat(e.target.value);
    moveSpeedValue.textContent = moveSpeed.toFixed(1);
});

fishReproductionSlider.addEventListener('input', (e) => {
    fishReproduction = parseInt(e.target.value);
    fishReproductionValue.textContent = fishReproduction;
});

shrimpReproductionSlider.addEventListener('input', (e) => {
    shrimpReproduction = parseInt(e.target.value);
    shrimpReproductionValue.textContent = shrimpReproduction;
});

// 初期化
init();
draw();
