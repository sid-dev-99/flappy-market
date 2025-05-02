const config = {
    initialPortfolioValue: 2000,
    baseGameSpeed: 6.2,
    speedIncreaseFactor: 0.07,
    maxSpeedMultiplier: 3.2,
    gravity: 0.45,
    flapStrength: -7.0,
    candleSpawnRate: 1400,
    minCandleHeight: 100,
    maxCandleHeight: 270,
    candleWidth: 30,
    minCandleGap: 200,
    playerX: window.innerWidth * 0.25,
    trailLength: 100,
    volatilityFactor: 1.1,
    marketMemory: 150,
    noiseScale: 0.11,
    noiseAmplitude: 22,
    spikeProbability: 0.06,
    spikeAmplitude: 25,
    curveSegments: 5,
    wavyFactor: 3.0,
    pointSpacing: 2,
    soundEnabled: true,
    scorePopupDuration: 60,
    scorePopupFadeSpeed: 0.03,
};

const sounds = {
    flap: null,
    score: null, 
    crash: null,
    ambient: null
};

let portfolioValue = config.initialPortfolioValue;
let highScore = 0;
let gameRunning = false;
let gameStarted = false; // Track if the game has started
let gameCanvas, ctx;
let player = {
    x: config.playerX,
    y: 300,
    velocity: 0,
    radius: Math.max(5, window.innerWidth * 0.005),
    positions: []
};
let candles = [];
let marketData = [];
let curvePoints = [];
let score = 0;
let frameCount = 0;
let percentChange = 0;
let lastUpdateTime = 0;
let candleLabels = ['PEAK', 'CRASH', 'BEAR', 'RISK', 'BULL', 'DUMP', 'PUMP', 'SHORT', 'LOSS'];
let noiseOffsetX = Math.random() * 1000;
let noiseOffsetY = Math.random() * 1000;
let waveSeed = Math.random() * 10000;
let scorePopups = [];

const portfolioValueElement = document.getElementById('portfolio-value');
const percentChangeElement = document.getElementById('percent-change');
const scoreElement = document.getElementById('score');
const gameOverElement = document.getElementById('game-over');
const finalValueElement = document.getElementById('final-value');
const highScoreValueElement = document.getElementById('high-score-value');
const restartButton = document.getElementById('restart-button');
const soundToggle = document.getElementById('sound-toggle');
const startScreen = document.getElementById('start-screen');

function initSounds() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const audioCtx = new AudioContext();
    
    function createFlapSound() {
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = 880;
        gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.01);
        gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.08);
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.1);
    }
    
    function createScoreSound() {
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = 1760;
        gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 0.01);
        gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.15);
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.2);
    }
    
    function createCrashSound() {
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(440, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(55, audioCtx.currentTime + 0.5);
        gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.05);
        gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.6);
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.7);
    }
    
    function createAmbientSound() {
        const lfo = audioCtx.createOscillator();
        const lfoGain = audioCtx.createGain();
        lfo.type = 'sine';
        lfo.frequency.value = 0.1;
        lfoGain.gain.value = 0.02;
        lfo.connect(lfoGain);
        
        const osc1 = audioCtx.createOscillator();
        const osc2 = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        osc1.type = 'sine';
        osc1.frequency.value = 55;
        osc2.type = 'triangle';
        osc2.frequency.value = 110;
        
        lfoGain.connect(osc1.frequency);
        lfoGain.connect(osc2.frequency);
        
        gainNode.gain.value = 0.03;
        
        osc1.connect(gainNode);
        osc2.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        lfo.start();
        osc1.start();
        osc2.start();
        
        return {
            stop: function() {
                lfo.stop();
                osc1.stop();
                osc2.stop();
            }
        };
    }
    
    sounds.flap = createFlapSound;
    sounds.score = createScoreSound;
    sounds.crash = createCrashSound;
    sounds.ambient = createAmbientSound;
    
    let ambientSound = null;
    
    soundToggle.addEventListener('click', function() {
        config.soundEnabled = !config.soundEnabled;
        soundToggle.textContent = config.soundEnabled ? '🔊 Sound ON' : '🔇 Sound OFF';
        
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        
        if (config.soundEnabled && gameRunning && !ambientSound) {
            ambientSound = sounds.ambient();
        } else if (!config.soundEnabled && ambientSound) {
            ambientSound.stop();
            ambientSound = null;
        }
    });
    
    document.addEventListener('visibilitychange', function() {
        if (document.hidden && ambientSound) {
            ambientSound.stop();
            ambientSound = null;
        } else if (!document.hidden && config.soundEnabled && gameRunning && !ambientSound) {
            ambientSound = sounds.ambient();
        }
    });
    
    window.addEventListener('beforeunload', function() {
        if (ambientSound) {
            ambientSound.stop();
        }
    });
}

function noise(x, y) {
    const X = Math.floor(x);
    const Y = Math.floor(y);
    const xf = x - X;
    const yf = y - Y;
    const topLeft = pseudoRandom(X, Y);
    const topRight = pseudoRandom(X + 1, Y);
    const bottomLeft = pseudoRandom(X, Y + 1);
    const bottomRight = pseudoRandom(X + 1, Y + 1);
    const top = lerp(topLeft, topRight, smoothStep(xf));
    const bottom = lerp(bottomLeft, bottomRight, smoothStep(xf));
    return lerp(top, bottom, smoothStep(yf));
}

function improvedNoise(x) {
    return Math.sin(x * 0.3) * 12 + 
           Math.sin(x * 0.9) * 7 +
           Math.sin(x * 1.7) * 4;
}

function marketNoise(x, time) {
    const baseFreq = 0.14;
    const freqMod = 0.07 * Math.sin(time * 0.002);
    const wave1 = Math.sin((x * (baseFreq + freqMod) + time * 0.003)) * 10;
    const wave2 = Math.sin((x * (baseFreq * 3.2 - freqMod * 0.6) + time * 0.004)) * 6;
    const wave3 = Math.sin((x * (baseFreq * 6.5 + freqMod * 0.4) + time * 0.007)) * 3;
    const spike = Math.random() < config.spikeProbability ? 
        (Math.random() - 0.5) * config.spikeAmplitude * 2.5 : 0;
    return wave1 + wave2 + wave3 + spike;
}

function generateWavePoint(x, baseY, time) {
    const baseWave = marketNoise(x * 0.07, time);
    const microDetail = noise(x * 0.15 + noiseOffsetX, noiseOffsetY) * 8;
    let spikeValue = 0;
    if (Math.random() < config.spikeProbability * 1.5) {
        const spikeHeight = (Math.random() - 0.5) * config.spikeAmplitude * 2.5;
        const spikeLength = Math.floor(2 + Math.random() * 4);
        for (let i = 0; i < spikeLength; i++) {
            spikeValue = spikeHeight * (1 - i/spikeLength);
        }
    }
    return baseY + baseWave + microDetail + spikeValue;
}

function pseudoRandom(x, y) {
    const dot = x * 12.9898 + y * 78.233;
    return Math.abs(Math.sin(dot) * 43758.5453) % 1;
}

function lerp(a, b, t) {
    return a + t * (b - a);
}

function smoothStep(x) {
    return x * x * (3 - 2 * x);
}

function getCurrentGameSpeed() {
    const speedMultiplier = Math.min(
        1 + (score * config.speedIncreaseFactor),
        config.maxSpeedMultiplier
    );
    return config.baseGameSpeed * speedMultiplier;
}

function initGame() {
    gameCanvas = document.getElementById('game-canvas');
    gameCanvas.width = window.innerWidth;
    gameCanvas.height = window.innerHeight;
    ctx = gameCanvas.getContext('2d');
    
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('click', handleClick);
    
    gameCanvas.addEventListener('touchstart', handleTouchStart);
    gameCanvas.addEventListener('touchend', handleTouchEnd);
    
    restartButton.addEventListener('click', restartGame);
    
    const savedHighScore = localStorage.getItem('flappyMarketHighScore');
    if (savedHighScore) {
        highScore = parseInt(savedHighScore);
    }
    
    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('resize', handleResize);

    startScreen.style.display = 'block';
}

function handleResize() {
    gameCanvas.width = window.innerWidth;
    gameCanvas.height = window.innerHeight;
    config.playerX = window.innerWidth * 0.25;
    player.x = config.playerX;
    player.radius = Math.max(5, window.innerWidth * 0.005);
    if (gameStarted) {
        initializeMarketData();
    }
}

function handleOrientationChange() {
    handleResize();
    if (window.innerHeight > window.innerWidth && !gameStarted) {
        startScreen.innerHTML = `
            <h2>Flappy Market</h2>
            <p>Please rotate your device to landscape mode and tap to start.</p>
        `;
    } else {
        startScreen.innerHTML = `
            <h2>Flappy Market</h2>
            <p>Tap to Start</p>
        `;
    }
}

function startGame() {
    portfolioValue = config.initialPortfolioValue;
    percentChange = 0;
    gameRunning = true;
    score = 0;
    frameCount = 0;
    scorePopups = [];
    
    noiseOffsetX = Math.random() * 1000;
    noiseOffsetY = Math.random() * 1000;
    waveSeed = Math.random() * 10000;
    
    player = {
        x: config.playerX,
        y: gameCanvas.height / 2,
        velocity: 0,
        radius: Math.max(5, window.innerWidth * 0.005),
        positions: []
    };
    
    initializeMarketData();
    candles = [];
    updateScoreDisplay();
    updatePortfolioDisplay();
    gameOverElement.style.display = 'none';
    
    lastUpdateTime = performance.now();
    requestAnimationFrame(gameLoop);
    
    if (config.soundEnabled && sounds.ambient) {
        sounds.ambient();
    }
    
    setTimeout(spawnCandle, 500);
}

function initializeMarketData() {
    marketData = [];
    curvePoints = [];
    player.positions = [];
    
    const midY = gameCanvas.height / 2;
    
    for (let i = 0; i < config.marketMemory; i++) {
        const x = config.playerX - (config.marketMemory - i) * config.pointSpacing;
        let y = midY + generateWavePoint(i, 0, waveSeed);
        y = Math.max(50, Math.min(gameCanvas.height - 50, y));
        marketData.push({ 
            x: x, 
            y: y,
            timestamp: waveSeed + i
        });
        curvePoints.push({x, y});
        if (i % 2 === 0) {
            player.positions.push({x, y});
        }
    }
    
    if (marketData.length > 0) {
        player.y = marketData[marketData.length - 1].y;
    }
}

function gameLoop(timestamp) {
    if (!gameRunning) return;
    
    const deltaTime = timestamp - lastUpdateTime;
    lastUpdateTime = timestamp;
    
    frameCount++;
    ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);
    drawGrid();
    player.velocity += config.gravity;
    player.y += player.velocity;
    
    if (player.y < player.radius) {
        player.y = player.radius;
        player.velocity = 0;
    } else if (player.y > gameCanvas.height - player.radius) {
        player.y = gameCanvas.height - player.radius;
        player.velocity = 0;
    }
    
    updateMarketData(timestamp);
    drawMarketChart();
    moveAndDrawCandles(deltaTime);
    drawPlayer();
    drawScorePopups();
    checkCollisions();
    updatePortfolioValue();
    requestAnimationFrame(gameLoop);
}

function updateMarketData(timestamp) {
    const newPoint = {
        x: player.x,
        y: player.y,
        timestamp: timestamp
    };
    
    const prevPoint = marketData.length > 0 ? marketData[marketData.length - 1] : null;
    
    if (prevPoint) {
        const dx = player.x - prevPoint.x;
        const dy = player.y - prevPoint.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const numPoints = Math.max(1, Math.floor(distance / 4));
        
        for (let i = 1; i <= numPoints; i++) {
            const ratio = i / (numPoints + 1);
            const x = lerp(prevPoint.x, player.x, ratio);
            const baseY = lerp(prevPoint.y, player.y, ratio);
            const time = timestamp + i * 100;
            const noise = marketNoise(x * 0.11 + time * 0.002, time) * (1 - ratio) * 0.7;
            const y = baseY + noise;
            marketData.push({
                x: x,
                y: y,
                timestamp: timestamp + i * 10
            });
        }
    }
    
    marketData.push(newPoint);
    curvePoints = marketData.map(point => ({x: point.x, y: point.y}));
    
    while (marketData.length > config.marketMemory) {
        marketData.shift();
    }
    
    player.positions.unshift({x: player.x, y: player.y});
    if (player.positions.length > config.trailLength) {
        player.positions.pop();
    }
}

function catmullRomPoint(p0, p1, p2, p3, t) {
    const t2 = t * t;
    const t3 = t2 * t;
    const a = -0.5 * t3 + t2 - 0.5 * t;
    const b = 1.5 * t3 - 2.5 * t2 + 1.0;
    const c = -1.5 * t3 + 2.0 * t2 + 0.5 * t;
    const d = 0.5 * t3 - 0.5 * t2;
    return {
        x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
        y: a * p0.y + b * p1.y + c * p2.y + d * p3.y
    };
}

function drawMarketChart() {
    if (curvePoints.length < 2) return;
    
    ctx.strokeStyle = '#00aa00';
    ctx.lineWidth = Math.max(2, window.innerWidth * 0.002);
    ctx.beginPath();
    ctx.moveTo(curvePoints[0].x, curvePoints[0].y);
    
    for (let i = 0; i < curvePoints.length - 1; i++) {
        const p0 = curvePoints[Math.max(0, i - 1)];
        const p1 = curvePoints[i];
        const p2 = curvePoints[i + 1];
        const p3 = curvePoints[Math.min(curvePoints.length - 1, i + 2)];
        const steps = 10;
        for (let t = 0; t <= steps; t++) {
            const point = catmullRomPoint(p0, p1, p2, p3, t / steps);
            ctx.lineTo(point.x, point.y);
        }
    }
    ctx.stroke();
}

function drawGrid() {
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    const gridSpacing = Math.max(50, window.innerHeight * 0.05);
    for (let y = 0; y < gameCanvas.height; y += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(gameCanvas.width, y);
        ctx.stroke();
    }
}

function drawPlayer() {
    if (player.positions.length > 1) {
        ctx.beginPath();
        ctx.moveTo(player.positions[0].x, player.positions[0].y);
        
        for (let i = 1; i < player.positions.length; i++) {
            const alpha = 1 - (i / player.positions.length);
            ctx.strokeStyle = `rgba(0, 255, 0, ${alpha * 0.4})`;
            ctx.lineWidth = Math.max(1, player.radius * 0.8 * (1 - i/player.positions.length));
            ctx.lineTo(player.positions[i].x, player.positions[i].y);
        }
        ctx.stroke();
    }
    
    ctx.fillStyle = '#0f0';
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(player.x, player.y);
    ctx.lineTo(player.x, player.y + player.velocity * 3);
    ctx.stroke();
}

function drawScorePopups() {
    for (let i = scorePopups.length - 1; i >= 0; i--) {
        const popup = scorePopups[i];
        popup.life--;
        popup.alpha -= config.scorePopupFadeSpeed;
        popup.y -= 1;
        
        if (popup.life <= 0 || popup.alpha <= 0) {
            scorePopups.splice(i, 1);
            continue;
        }
        
        ctx.fillStyle = `rgba(0, 255, 0, ${popup.alpha})`;
        ctx.font = `${Math.max(16, window.innerWidth * 0.015)}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(popup.score, popup.x, popup.y);
    }
}

function canSpawnCandleAtPosition(x) {
    for (const candle of candles) {
        const distance = Math.abs(x - candle.x);
        if (distance < config.minCandleGap) {
            return false;
        }
    }
    return true;
}

function spawnCandle() {
    if (!gameRunning) return;
    const x = gameCanvas.width + config.candleWidth;
    if (!canSpawnCandleAtPosition(x)) {
        setTimeout(spawnCandle, 350);
        return;
    }
    const responsiveCandleWidth = Math.max(30, window.innerWidth * 0.03);
    const isGreenCandle = Math.random() > 0.5;
    
    const minHeight = config.minCandleHeight + (score > 10 ? Math.random() * 40 : 0);
    const candleHeight = Math.random() * (config.maxCandleHeight - minHeight) + minHeight;
    
    let bodyStart;
    if (score > 15 && Math.random() > 0.7) {
        const targetY = player.y + (Math.random() - 0.5) * 170;
        bodyStart = Math.max(50, Math.min(gameCanvas.height - candleHeight - 50, targetY - candleHeight/2));
    } else {
        bodyStart = Math.random() * (gameCanvas.height - candleHeight - (window.innerHeight * 0.1)) + (window.innerHeight * 0.05);
    }
    
    const candle = {
        x: x,
        bodyStart: bodyStart,
        bodyHeight: candleHeight,
        color: isGreenCandle ? '#0f0' : '#f40',
        label: candleLabels[Math.floor(Math.random() * candleLabels.length)],
        passed: false,
        scored: false,
        labelOffset: {x: -responsiveCandleWidth/2, y: -20},
        width: responsiveCandleWidth
    };
    candles.push(candle);
    
    const baseRate = Math.max(700, config.candleSpawnRate - (score * 60));
    const randomization = Math.random() * 300;
    setTimeout(spawnCandle, baseRate + randomization);
}

function moveAndDrawCandles(deltaTime) {
    const moveAmount = getCurrentGameSpeed() * (deltaTime / 16);
    for (let i = 0; i < candles.length; i++) {
        const candle = candles[i];
        candle.x -= moveAmount;
        if (!candle.scored && player.x > candle.x + candle.width) {
            candle.scored = true;
            score++;
            updateScoreDisplay();
            scorePopups.push({
                x: player.x,
                y: player.y - player.radius - 10,
                score: score,
                life: config.scorePopupDuration,
                alpha: 1.0
            });
            if (config.soundEnabled && sounds.score) {
                sounds.score();
            }
        }
        ctx.fillStyle = candle.color;
        ctx.fillRect(candle.x, candle.bodyStart, candle.width, candle.bodyHeight);
        const wickWidth = Math.max(1, window.innerWidth * 0.001);
        const wickHeight = Math.max(20, window.innerHeight * 0.02);
        ctx.fillRect(candle.x + candle.width/2 - wickWidth/2, candle.bodyStart - wickHeight, wickWidth, wickHeight);
        ctx.fillRect(candle.x + candle.width/2 - wickWidth/2, candle.bodyStart + candle.bodyHeight, wickWidth, wickHeight);
        if (candle.label) {
            ctx.fillStyle = '#888';
            ctx.font = `${Math.max(12, window.innerWidth * 0.01)}px monospace`;
            const labelX = candle.x + candle.width/2 + candle.labelOffset.x;
            const labelY = candle.bodyStart + candle.labelOffset.y;
            ctx.fillText(candle.label, labelX, labelY);
        }
        ctx.strokeStyle = candle.color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(candle.x + candle.width/2, 0);
        ctx.lineTo(candle.x + candle.width/2, gameCanvas.height);
        ctx.stroke();
    }
    candles = candles.filter(candle => candle.x + candle.width > -100);
}

function checkCollisions() {
    if (player.y - player.radius <= 0 || player.y + player.radius >= gameCanvas.height) {
        endGame();
        return;
    }
    for (const candle of candles) {
        if (
            player.x + player.radius > candle.x &&
            player.x - player.radius < candle.x + candle.width &&
            player.y + player.radius > candle.bodyStart &&
            player.y - player.radius < candle.bodyStart + candle.bodyHeight
        ) {
            endGame();
            return;
        }
    }
}

function updatePortfolioValue() {
    const baseValue = config.initialPortfolioValue;
    const scoreValue = score * 65;
    const heightFactor = (gameCanvas.height / 2 - player.y) * 0.85;
    const volatility = Math.sin(frameCount * 0.04) * 35 * Math.min(1, score * 0.14);
    portfolioValue = Math.max(0, Math.round(baseValue + scoreValue + heightFactor + volatility));
    percentChange = ((portfolioValue - baseValue) / baseValue) * 100;
    if (frameCount % 5 === 0) {
        updatePortfolioDisplay();
    }
}

function updatePortfolioDisplay() {
    portfolioValueElement.textContent = portfolioValue;
    percentChangeElement.textContent = (percentChange >= 0 ? '+' : '') + percentChange.toFixed(2) + '%';
    percentChangeElement.className = percentChange >= 0 ? 'percent' : 'percent negative';
}

function updateScoreDisplay() {
    scoreElement.textContent = score;
}

function handleKeyDown(e) {
    if (e.code === 'Space' && gameRunning) {
        flap();
        e.preventDefault();
    }
}

function handleClick(e) {
    if (!gameStarted) {
        gameStarted = true;
        startScreen.style.display = 'none';
        initSounds(); // Initialize sounds after user interaction
        startGame();
    } else if (gameRunning && e.target === gameCanvas) {
        flap();
    }
}

let touchActive = false;

function handleTouchStart(e) {
    e.preventDefault();
    if (!gameStarted) {
        gameStarted = true;
        startScreen.style.display = 'none';
        initSounds(); 
        startGame();
    } else if (gameRunning) {
        touchActive = true;
        flap();
    }
}

function handleTouchEnd(e) {
    e.preventDefault();
    touchActive = false;
}

function flap() {
    player.velocity = config.flapStrength;
    if (config.soundEnabled && sounds.flap) {
        sounds.flap();
    }
}

function endGame() {
    gameRunning = false;
    if (config.soundEnabled && sounds.crash) {
        sounds.crash();
    }
    
    if (portfolioValue > highScore) {
        highScore = portfolioValue;
        localStorage.setItem('flappyMarketHighScore', highScore);
    }
    finalValueElement.innerHTML = `Final Portfolio Value:<br>$${portfolioValue}`;
    highScoreValueElement.textContent = `$${highScore}`;
    gameOverElement.style.display = 'block';
}

function restartGame() {
    startGame();
}

window.onload = initGame;

