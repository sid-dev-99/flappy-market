import { Candle, Player, ScorePopup, Config } from './types';
import { Market } from './market';
import { Sounds, initSounds } from './audio';

export class Game {
  private portfolioValue: number;
  private highScore: number = 0;
  private gameRunning: boolean = false;
  private gameStarted: boolean = false;
  private gameCanvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private player: Player;
  private candles: Candle[] = [];
  private score: number = 0;
  private frameCount: number = 0;
  private percentChange: number = 0;
  private lastUpdateTime: number = 0;
  private candleLabels: string[] = ['PEAK', 'CRASH', 'BEAR', 'RISK', 'BULL', 'DUMP', 'PUMP', 'SHORT', 'LOSS'];
  private scorePopups: ScorePopup[] = [];
  private market: Market;
  private sounds: Sounds;
  private touchActive: boolean = false;
  private config: Config;

  private portfolioValueElement: HTMLElement;
  private percentChangeElement: HTMLElement;
  private scoreElement: HTMLElement;
  private gameOverElement: HTMLElement;
  private finalValueElement: HTMLElement;
  private highScoreValueElement: HTMLElement;
  private restartButton: HTMLButtonElement;
  private soundToggle: HTMLButtonElement;
  private startScreen: HTMLElement;

  constructor(config: Config) {
    this.config = config;
    this.portfolioValue = config.initialPortfolioValue;
    this.gameCanvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    this.ctx = this.gameCanvas.getContext('2d')!;
    this.player = {
      x: config.playerX,
      y: 300,
      velocity: 0,
      radius: Math.max(5, window.innerWidth * 0.005),
      positions: [],
    };
    this.market = new Market(this.player, this.gameCanvas, this.ctx, config);
    this.sounds = initSounds(document.getElementById('sound-toggle') as HTMLButtonElement, config);

    this.portfolioValueElement = document.getElementById('portfolio-value')!;
    this.percentChangeElement = document.getElementById('percent-change')!;
    this.scoreElement = document.getElementById('score')!;
    this.gameOverElement = document.getElementById('game-over')!;
    this.finalValueElement = document.getElementById('final-value')!;
    this.highScoreValueElement = document.getElementById('high-score-value')!;
    this.restartButton = document.getElementById('restart-button') as HTMLButtonElement;
    this.soundToggle = document.getElementById('sound-toggle') as HTMLButtonElement;
    this.startScreen = document.getElementById('start-screen')!;
  }

  public init(): void {
    this.gameCanvas.width = window.innerWidth;
    this.gameCanvas.height = window.innerHeight;

    document.addEventListener('keydown', (e) => this.handleKeyDown(e));
    document.addEventListener('click', (e) => this.handleClick(e));
    this.gameCanvas.addEventListener('touchstart', (e) => this.handleTouchStart(e));
    this.gameCanvas.addEventListener('touchend', (e) => this.handleTouchEnd(e));
    this.restartButton.addEventListener('click', () => this.restartGame());
    window.addEventListener('orientationchange', () => this.handleOrientationChange());
    window.addEventListener('resize', () => this.handleResize());

    const savedHighScore = localStorage.getItem('flappyMarketHighScore');
    if (savedHighScore) {
      this.highScore = parseInt(savedHighScore);
    }

    this.startScreen.style.display = 'block';
  }

  private handleResize(): void {
    this.gameCanvas.width = window.innerWidth;
    this.gameCanvas.height = window.innerHeight;
    this.config.playerX = window.innerWidth * 0.25;
    this.player.x = this.config.playerX;
    this.player.radius = Math.max(5, window.innerWidth * 0.005);
    if (this.gameStarted) {
      this.market.initializeMarketData();
    }
  }

  private handleOrientationChange(): void {
    this.handleResize();
    if (window.innerHeight > window.innerWidth && !this.gameStarted) {
      this.startScreen.innerHTML = `
        <h2>Flappy Market</h2>
        <p>Please rotate your device to landscape mode and tap to start.</p>
      `;
    } else {
      this.startScreen.innerHTML = `
        <h2>Flappy Market</h2>
        <p>Tap to Start</p>
      `;
    }
  }

  private startGame(): void {
    this.portfolioValue = this.config.initialPortfolioValue;
    this.percentChange = 0;
    this.gameRunning = true;
    this.gameStarted = true;
    this.score = 0;
    this.frameCount = 0;
    this.scorePopups = [];

    this.player = {
      x: this.config.playerX,
      y: this.gameCanvas.height / 2,
      velocity: 0,
      radius: Math.max(5, window.innerWidth * 0.005),
      positions: [],
    };

    this.market.initializeMarketData();
    this.candles = [];
    this.updateScoreDisplay();
    this.updatePortfolioDisplay();
    this.gameOverElement.style.display = 'none';

    this.lastUpdateTime = performance.now();
    requestAnimationFrame((timestamp) => this.gameLoop(timestamp));

    if (this.config.soundEnabled) {
      this.sounds.ambient();
    }

    setTimeout(() => this.spawnCandle(), 500);
  }

  private gameLoop(timestamp: number): void {
    if (!this.gameRunning) return;

    const deltaTime = timestamp - this.lastUpdateTime;
    this.lastUpdateTime = timestamp;

    this.frameCount++;
    this.ctx.clearRect(0, 0, this.gameCanvas.width, this.gameCanvas.height);
    this.market.drawGrid();
    this.player.velocity += this.config.gravity;
    this.player.y += this.player.velocity;

    if (this.player.y < this.player.radius) {
      this.player.y = this.player.radius;
      this.player.velocity = 0;
    } else if (this.player.y > this.gameCanvas.height - this.player.radius) {
      this.player.y = this.gameCanvas.height - this.player.radius;
      this.player.velocity = 0;
    }

    this.market.updateMarketData(timestamp);
    this.market.drawMarketChart();
    this.moveAndDrawCandles(deltaTime);
    this.drawPlayer();
    this.drawScorePopups();
    this.checkCollisions();
    this.updatePortfolioValue();
    requestAnimationFrame((timestamp) => this.gameLoop(timestamp));
  }

  private drawPlayer(): void {
    if (this.player.positions.length > 1) {
      this.ctx.beginPath();
      this.ctx.moveTo(this.player.positions[0].x, this.player.positions[0].y);

      for (let i = 1; i < this.player.positions.length; i++) {
        const alpha = 1 - i / this.player.positions.length;
        this.ctx.strokeStyle = `rgba(0, 255, 0, ${alpha * 0.4})`;
        this.ctx.lineWidth = Math.max(1, this.player.radius * 0.8 * (1 - i / this.player.positions.length));
        this.ctx.lineTo(this.player.positions[i].x, this.player.positions[i].y);
      }
      this.ctx.stroke();
    }

    this.ctx.fillStyle = '#0f0';
    this.ctx.beginPath();
    this.ctx.arc(this.player.x, this.player.y, this.player.radius, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.strokeStyle = '#fff';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(this.player.x, this.player.y);
    this.ctx.lineTo(this.player.x, this.player.y + this.player.velocity * 3);
    this.ctx.stroke();
  }

  private drawScorePopups(): void {
    for (let i = this.scorePopups.length - 1; i >= 0; i--) {
      const popup = this.scorePopups[i];
      popup.life--;
      popup.alpha -= this.config.scorePopupFadeSpeed;
      popup.y -= 1;

      if (popup.life <= 0 || popup.alpha <= 0) {
        this.scorePopups.splice(i, 1);
        continue;
      }

      this.ctx.fillStyle = `rgba(0, 255, 0, ${popup.alpha})`;
      this.ctx.font = `${Math.max(16, window.innerWidth * 0.015)}px monospace`;
      this.ctx.textAlign = 'center';
      this.ctx.fillText(popup.score.toString(), popup.x, popup.y);
    }
  }

  private canSpawnCandleAtPosition(x: number): boolean {
    for (const candle of this.candles) {
      const distance = Math.abs(x - candle.x);
      if (distance < this.config.minCandleGap) {
        return false;
      }
    }
    return true;
  }

  private spawnCandle(): void {
    if (!this.gameRunning) return;
    const x = this.gameCanvas.width + this.config.candleWidth;
    if (!this.canSpawnCandleAtPosition(x)) {
      setTimeout(() => this.spawnCandle(), 350);
      return;
    }
    const responsiveCandleWidth = Math.max(30, window.innerWidth * 0.03);
    const isGreenCandle = Math.random() > 0.5;

    const minHeight = this.config.minCandleHeight + (this.score > 10 ? Math.random() * 40 : 0);
    const candleHeight = Math.random() * (this.config.maxCandleHeight - minHeight) + minHeight;

    let bodyStart: number;
    if (this.score > 15 && Math.random() > 0.7) {
      const targetY = this.player.y + (Math.random() - 0.5) * 170;
      bodyStart = Math.max(50, Math.min(this.gameCanvas.height - candleHeight - 50, targetY - candleHeight / 2));
    } else {
      bodyStart = Math.random() * (this.gameCanvas.height - candleHeight - window.innerHeight * 0.1) + window.innerHeight * 0.05;
    }

    const candle: Candle = {
      x,
      bodyStart,
      bodyHeight: candleHeight,
      color: isGreenCandle ? '#0f0' : '#f40',
      label: this.candleLabels[Math.floor(Math.random() * this.candleLabels.length)],
      passed: false,
      scored: false,
      labelOffset: { x: -responsiveCandleWidth / 2, y: -20 },
      width: responsiveCandleWidth,
    };
    this.candles.push(candle);

    const baseRate = Math.max(700, this.config.candleSpawnRate - this.score * 60);
    const randomization = Math.random() * 300;
    setTimeout(() => this.spawnCandle(), baseRate + randomization);
  }

  private moveAndDrawCandles(deltaTime: number): void {
    const moveAmount = this.getCurrentGameSpeed() * (deltaTime / 16);
    for (let i = 0; i < this.candles.length; i++) {
      const candle = this.candles[i];
      candle.x -= moveAmount;
      if (!candle.scored && this.player.x > candle.x + candle.width) {
        candle.scored = true;
        this.score++;
        this.updateScoreDisplay();
        this.scorePopups.push({
          x: this.player.x,
          y: this.player.y - this.player.radius - 10,
          score: this.score,
          life: this.config.scorePopupDuration,
          alpha: 1.0,
        });
        if (this.config.soundEnabled) {
          this.sounds.score();
        }
      }
      this.ctx.fillStyle = candle.color;
      this.ctx.fillRect(candle.x, candle.bodyStart, candle.width, candle.bodyHeight);
      const wickWidth = Math.max(1, window.innerWidth * 0.001);
      const wickHeight = Math.max(20, window.innerHeight * 0.02);
      this.ctx.fillRect(candle.x + candle.width / 2 - wickWidth / 2, candle.bodyStart - wickHeight, wickWidth, wickHeight);
      this.ctx.fillRect(candle.x + candle.width / 2 - wickWidth / 2, candle.bodyStart + candle.bodyHeight, wickWidth, wickHeight);
      if (candle.label) {
        this.ctx.fillStyle = '#888';
        this.ctx.font = `${Math.max(12, window.innerWidth * 0.01)}px monospace`;
        const labelX = candle.x + candle.width / 2 + candle.labelOffset.x;
        const labelY = candle.bodyStart + candle.labelOffset.y;
        this.ctx.fillText(candle.label, labelX, labelY);
      }
      this.ctx.strokeStyle = candle.color;
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.moveTo(candle.x + candle.width / 2, 0);
      this.ctx.lineTo(candle.x + candle.width / 2, this.gameCanvas.height);
      this.ctx.stroke();
    }
    this.candles = this.candles.filter((candle) => candle.x + candle.width > -100);
  }

  private checkCollisions(): void {
    if (this.player.y - this.player.radius <= 0 || this.player.y + this.player.radius >= this.gameCanvas.height) {
      this.endGame();
      return;
    }
    for (const candle of this.candles) {
      if (
        this.player.x + this.player.radius > candle.x &&
        this.player.x - this.player.radius < candle.x + candle.width &&
        this.player.y + this.player.radius > candle.bodyStart &&
        this.player.y - this.player.radius < candle.bodyStart + candle.bodyHeight
      ) {
        this.endGame();
        return;
      }
    }
  }

  private updatePortfolioValue(): void {
    const baseValue = this.config.initialPortfolioValue;
    const scoreValue = this.score * 65;
    const heightFactor = (this.gameCanvas.height / 2 - this.player.y) * 0.85;
    const volatility = Math.sin(this.frameCount * 0.04) * 35 * Math.min(1, this.score * 0.14);
    this.portfolioValue = Math.max(0, Math.round(baseValue + scoreValue + heightFactor + volatility));
    this.percentChange = ((this.portfolioValue - baseValue) / baseValue) * 100;
    if (this.frameCount % 5 === 0) {
      this.updatePortfolioDisplay();
    }
  }

  private updatePortfolioDisplay(): void {
    this.portfolioValueElement.textContent = this.portfolioValue.toString();
    this.percentChangeElement.textContent = (this.percentChange >= 0 ? '+' : '') + this.percentChange.toFixed(2) + '%';
    this.percentChangeElement.className = this.percentChange >= 0 ? 'percent' : 'percent negative';
  }

  private updateScoreDisplay(): void {
    this.scoreElement.textContent = this.score.toString();
  }

  private getCurrentGameSpeed(): number {
    const speedMultiplier = Math.min(1 + this.score * this.config.speedIncreaseFactor, this.config.maxSpeedMultiplier);
    return this.config.baseGameSpeed * speedMultiplier;
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (e.code === 'Space' && this.gameRunning) {
      this.flap();
      e.preventDefault();
    }
  }

  private handleClick(e: MouseEvent): void {
    if (!this.gameStarted) {
      this.startGame();
      this.startScreen.style.display = 'none';
    } else if (this.gameRunning && e.target === this.gameCanvas) {
      this.flap();
    }
  }

  private handleTouchStart(e: TouchEvent): void {
    e.preventDefault();
    if (!this.gameStarted) {
      this.startGame();
      this.startScreen.style.display = 'none';
    } else if (this.gameRunning) {
      this.touchActive = true;
      this.flap();
    }
  }

  private handleTouchEnd(e: TouchEvent): void {
    e.preventDefault();
    this.touchActive = false;
  }

  private flap(): void {
    this.player.velocity = this.config.flapStrength;
    if (this.config.soundEnabled) {
      this.sounds.flap();
    }
  }

  private endGame(): void {
    this.gameRunning = false;
    if (this.config.soundEnabled) {
      this.sounds.crash();
    }

    if (this.portfolioValue > this.highScore) {
      this.highScore = this.portfolioValue;
      localStorage.setItem('flappyMarketHighScore', this.highScore.toString());
    }
    this.finalValueElement.innerHTML = `Final Portfolio Value:<br>$${this.portfolioValue}`;
    this.highScoreValueElement.textContent = `$${this.highScore}`;
    this.gameOverElement.style.display = 'block';
  }

  private restartGame(): void {
    this.startGame();
  }
}