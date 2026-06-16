/**
 * UNDERNAIL - Core Game JavaScript (Updated)
 * Serious Dark Fantasy Retro RPG. Connected rooms, procedural overworld, mystery portals.
 */

// ==========================================
// 1. SOUND ENGINE (WEB AUDIO API)
// ==========================================
const AudioEngine = {
    ctx: null,
    bgm: null,
    currentTrack: null,

    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    },

    playBGM(filename) {
        if (this.currentTrack === filename) {
            if (this.bgm && this.bgm.paused) {
                this.bgm.play().catch(err => console.log("Audio play failed:", err));
            }
            return;
        }
        this.stopBGM();
        this.bgm = new Audio(`audio/${filename}`);
        this.bgm.loop = true;
        this.bgm.volume = 0.4;
        this.currentTrack = filename;
        this.bgm.play().catch(err => {
            console.log("BGM autoplay postponed:", err);
        });
    },

    stopBGM() {
        if (this.bgm) {
            this.bgm.pause();
            this.bgm = null;
            this.currentTrack = null;
        }
    },

    playBeep(freq, duration, type = 'sine') {
        this.init();
        if (!this.ctx) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        
        gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    },

    // Dialogue voice buzz
    playTextBuzz() {
        this.playBeep(110 + Math.random() * 15, 0.05, 'square');
    },

    // Player damage sound
    playHitSound() {
        this.playBeep(85, 0.15, 'sawtooth');
        this.playBeep(55, 0.25, 'triangle');
    },

    // Healing sound effect
    playHealSound() {
        this.init();
        const now = this.ctx.currentTime;
        const notes = [293.66, 349.23, 440.00, 587.33]; // D minor arpeggio
        notes.forEach((freq, index) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.frequency.setValueAtTime(freq, now + index * 0.08);
            gain.gain.setValueAtTime(0.06, now + index * 0.08);
            gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.08 + 0.25);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now + index * 0.08);
            osc.stop(now + index * 0.08 + 0.25);
        });
    },

    // Level-up / Victory fanfar
    playVictorySound() {
        this.init();
        const now = this.ctx.currentTime;
        const notes = [293.66, 293.66, 293.66, 392.00, 440.00, 587.33];
        const durations = [0.1, 0.1, 0.1, 0.2, 0.2, 0.6];
        let delay = 0;
        notes.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(freq, now + delay);
            gain.gain.setValueAtTime(0.07, now + delay);
            gain.gain.exponentialRampToValueAtTime(0.001, now + delay + durations[idx]);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now + delay);
            osc.stop(now + delay + durations[idx]);
            delay += durations[idx] + 0.02;
        });
    },

    // Soul breaking death sound
    playBreakSound() {
        this.playBeep(160, 0.1, 'sawtooth');
        setTimeout(() => {
            this.playBeep(80, 0.45, 'triangle');
        }, 120);
    },

    // Exciting final victory music arpeggio
    playExcitingMusic() {
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const notes = [
            130.81, 130.81, 196.00, 196.00, 220.00, 220.00, 196.00,
            261.63, 261.63, 392.00, 392.00, 440.00, 440.00, 392.00,
            523.25, 587.33, 659.25, 698.46, 783.99, 880.00, 987.77, 1046.50
        ];
        let delay = 0;
        notes.forEach((freq, index) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = index % 2 === 0 ? 'sawtooth' : 'triangle';
            osc.frequency.setValueAtTime(freq, now + delay);
            gain.gain.setValueAtTime(0.08, now + delay);
            gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.15);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now + delay);
            osc.stop(now + delay + 0.15);
            delay += 0.10;
        });
    }
};

// ==========================================
// 1.5. PRELOAD IMAGES
// ==========================================
const Images = {
    player: new Image(),
    mustafa: new Image(),
    oktay: new Image(),
    kayra: new Image(),
    arel: new Image()
};
Images.player.src = 'assets/zafer_aygun.png';
Images.mustafa.src = 'assets/mustafa.png';
Images.oktay.src = 'assets/oktay.png';
Images.kayra.src = 'assets/kayra.png';
Images.arel.src = 'assets/arel.png';

// ==========================================
// 2. GAME STATE AND CONFIG
// ==========================================
const Game = {
    // Boss triggering & level conditions
    boss1Spawned: false,
    boss2Spawned: false,
    boss1Defeated: false,
    boss2Defeated: false,
    hasVisitedHouseSinceLevel3: false,
    hasVisitedHouseSinceLevel5: false,

    // Player data
    player: {
        name: 'GOLGE',
        x: 400,
        y: 300,
        speed: 3.8,
        size: 26, // Enlarged player size
        hp: 25,
        maxHp: 25,
        kirkel: 0,
        inventory: [],
        level: 0,
        xp: 0
    },


    gainXP(amount) {
        Game.player.xp += amount;
        let xpNeeded = Game.getXpNeeded(Game.player.level);
        let leveledUp = false;

        while (Game.player.xp >= xpNeeded) {
            Game.player.xp -= xpNeeded;
            Game.player.level++;
            Game.player.maxHp += 5;
            Game.player.hp = Game.player.maxHp; // Heal to full
            xpNeeded = Game.getXpNeeded(Game.player.level);
            leveledUp = true;
        }

        if (leveledUp) {
            if (Game.battle.active) {
                Game.battle.leveledUp = true;
            } else if (Game.currentScreen === 'PUZZLE_GAME') {
                // Handled in updateHardPuzzle
            } else {
                AudioEngine.playVictorySound();
                DialogSystem.show('SİSTEM', `GÜÇLENDİN! LV ${Game.player.level} oldun! Maksimum HP arttı ve tamamen iyileştin.`, null, 'none');
            }
        }
    },

    getXpNeeded(level) {
        if (level >= 3) {
            return 120; // Caps XP requirement at the level 2 -> 3 transition amount
        }
        return level * level * 30; // Harder leveling curve
    },

    // Dark serious fantasy items
    shopItems: [
        { id: 'kan_iksiri', name: 'Ejderha Kanı İksiri', price: 10, desc: '10 Can kazandırır. Taze, sıcak can özü.', type: 'heal', value: 10 },
        { id: 'golge_iksiri', name: 'Gölge Özü Şerbeti', price: 25, desc: 'Tüm canı fuller. Karanlıkta demlenmiştir.', type: 'heal', value: 999 },
        { id: 'celik_kilic', name: 'Kara Çelik Kılıç', price: 40, desc: 'Saldırı gücünü +8 artırır. Çok keskin.', type: 'weapon', value: 8 },
        { id: 'gece_zirhi', name: 'Gece Muhafızı Zırhı', price: 60, desc: 'Savunmayı artırır. Darbeleri sönümler.', type: 'armor', value: 5 }
    ],

    // Game Screens: 'INTRO' | 'OVERWORLD' | 'COMBAT' | 'SHOP' | 'PUZZLE_GAME'
    currentScreen: 'INTRO',
    
    // Map State: 'HOUSE' | 'OUTSIDE'
    currentLocation: 'HOUSE',
    
    // House Room Index (1 to 5)
    // ROOM 1: Giriş Salonu (1. Kat)
    // ROOM 2: Kütüphane (1. Kat)
    // ROOM 3: Yemek Odası (1. Kat)
    // ROOM 4: Üst Kat Koridor (2. Kat)
    // ROOM 5: Muhafız Yatak Odası (2. Kat)
    currentRoom: 1,

    // Scrolling Connected Overworld Page (0, 1, 2...)
    overworldPage: 0,

    // Canvas properties
    canvas: null,
    ctx: null,
    keys: {},

    // Entities active in the current screen/room
    entities: [],
    
    // Dialogue box details
    dialogue: {
        active: false,
        speaker: '',
        text: '',
        visibleText: '',
        charIndex: 0,
        timer: 0,
        portrait: 'none',
        callback: null
    },

    // Combat Dodge engine details
    battle: {
        active: false,
        boss: null,
        phase: 'menu',    // 'menu' | 'fight_timing' | 'dodge' | 'item' | 'act' | 'victory' | 'defeat'
        dodgeTimer: 0,
        dodgeDuration: 8000,
        heartX: 400,
        heartY: 280,
        heartSpeed: 2.8,
        laserHitsThisDodge: 0,
        bullets: [],
        popups: [],
        menuIndex: 0,
        fightTimingPos: 0,
        fightTimingSpeed: 3.2,
        fightTimingDir: 1,
        message: '',
        isChallenge: false,
        challengeWager: 15
    },

    // Mystery rift / portal spawner state in the house
    activeHousePortal: null, // null or { x, y, type: 'combat' | 'puzzle' }

    // Grid Physical Sokoban-style Puzzle screen state
    puzzleRoom: {
        playerCol: 1,
        playerRow: 3,
        solved: false,
        lastMoveTime: 0,
        resetCell: { col: 14, row: 7 },
        targets: [
            { col: 12, row: 2, color: '#ef4444' }, // Red
            { col: 12, row: 3, color: '#3b82f6' }, // Blue
            { col: 12, row: 4, color: '#10b981' }, // Green
            { col: 12, row: 5, color: '#eab308' }  // Yellow
        ],
        boxes: [
            { col: 4, row: 2, color: '#ef4444' }, // Red
            { col: 5, row: 3, color: '#3b82f6' }, // Blue
            { col: 4, row: 4, color: '#10b981' }, // Green
            { col: 5, row: 5, color: '#eab308' }  // Yellow
        ],
        walls: [
            { col: 3, row: 1 }, { col: 3, row: 6 },
            { col: 7, row: 1 }, { col: 7, row: 2 }, { col: 7, row: 4 }, { col: 7, row: 5 }, { col: 7, row: 6 },
            { col: 10, row: 1 }, { col: 10, row: 6 }
        ]
    }
};

// ==========================================
// 3. PIXEL SPRITES DRAWING (CANVAS DESIGN)
// ==========================================
const Sprites = {
    // Red soul heart
    drawHeart(ctx, x, y, size, color = '#ff0000') {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.fillRect(x - size/2 + size/4, y - size/2, size/2, size/4);
        ctx.fillRect(x - size/2, y - size/2 + size/4, size, size/4);
        ctx.fillRect(x - size/2 + size/8, y, size - size/4, size/4);
        ctx.fillRect(x - size/4, y + size/4, size/2, size/4);
        ctx.fillRect(x - size/8, y + size/2, size/4, size/4);
    },

    drawDummy(ctx, x, y, time) {
        const bob = Math.sin(time / 200) * 3;
        const by = y + bob;
        // Wooden stand base
        ctx.fillStyle = '#451a03';
        ctx.fillRect(x - 20, by + 40, 40, 6);
        // Vertical post
        ctx.fillRect(x - 4, by - 20, 8, 60);
        // Horizontal arms
        ctx.fillRect(x - 25, by - 6, 50, 6);
        
        // Straw body/target bag
        ctx.fillStyle = '#b45309';
        ctx.fillRect(x - 16, by - 25, 32, 45);
        ctx.fillStyle = '#d97706';
        ctx.fillRect(x - 12, by - 21, 24, 37);

        // Target target lines
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 3;
        ctx.strokeRect(x - 8, by - 12, 16, 16);
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(x - 2, by - 6, 4, 4);
    },

    drawSlimeCombat(ctx, x, y, time) {
        const bob = Math.sin(time / 150) * 5;
        const stretch = Math.cos(time / 150) * 0.08;
        const sw = 50 * (1 + stretch);
        const sh = 40 * (1 - stretch);
        const sy = y + 20 + bob;

        ctx.fillStyle = '#261c38';
        ctx.strokeStyle = '#9333ea';
        ctx.lineWidth = 3;
        
        ctx.beginPath();
        ctx.ellipse(x, sy, sw/2, sh/2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Glowing red eyes
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(x - 10, sy - 4, 4, 4);
        ctx.fillRect(x + 6, sy - 4, 4, 4);
        
        // Squiggly mouth
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - 4, sy + 6);
        ctx.lineTo(x + 4, sy + 6);
        ctx.stroke();
    },

    drawCrawlerCombat(ctx, x, y, time) {
        const bob = Math.sin(time / 100) * 4;
        const cy = y + 10 + bob;

        ctx.strokeStyle = '#271c14';
        ctx.lineWidth = 4;
        const legOffset = Math.sin(time / 80) * 8;
        ctx.beginPath(); ctx.moveTo(x - 15, cy); ctx.lineTo(x - 30, cy + 15 + legOffset); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + 15, cy); ctx.lineTo(x + 30, cy + 15 - legOffset); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x - 15, cy + 10); ctx.lineTo(x - 28, cy + 22 - legOffset); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + 15, cy + 10); ctx.lineTo(x + 28, cy + 22 + legOffset); ctx.stroke();

        ctx.fillStyle = '#3a2010';
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 3;
        ctx.fillRect(x - 20, cy - 15, 40, 30);
        ctx.strokeRect(x - 20, cy - 15, 40, 30);

        ctx.fillStyle = '#271c14';
        ctx.fillRect(x - 20, cy - 5, 40, 3);
        ctx.fillRect(x - 20, cy + 5, 40, 3);

        ctx.fillStyle = '#ffaa00';
        ctx.fillRect(x - 12, cy - 8, 4, 4);
        ctx.fillRect(x + 8, cy - 8, 4, 4);
    },

    drawBekciCombat(ctx, x, y, time) {
        const bob = Math.sin(time / 200) * 6;
        const by = y + bob;

        ctx.fillStyle = '#110c24';
        ctx.fillRect(x - 20, by - 35, 40, 70);
        ctx.strokeStyle = '#9333ea';
        ctx.lineWidth = 3;
        ctx.strokeRect(x - 20, by - 35, 40, 70);

        ctx.fillStyle = '#000000';
        ctx.fillRect(x - 12, by - 25, 24, 20);

        ctx.fillStyle = '#c084fc';
        ctx.fillRect(x - 8, by - 18, 4, 4);
        ctx.fillRect(x + 4, by - 18, 4, 4);

        const handBob = Math.cos(time / 150) * 4;
        ctx.fillStyle = '#9333ea';
        ctx.fillRect(x - 32, by + handBob, 10, 10);
        ctx.fillRect(x + 22, by - handBob, 10, 10);
    },

    drawGolgeCombat(ctx, x, y, time) {
        const bob = Math.sin(time / 180) * 8;
        const gy = y + bob;

        ctx.fillStyle = 'rgba(58, 43, 92, 0.85)';
        ctx.strokeStyle = 'rgba(147, 51, 234, 0.9)';
        ctx.lineWidth = 3;

        ctx.beginPath();
        ctx.moveTo(x - 18, gy - 25);
        ctx.lineTo(x + 18, gy - 25);
        ctx.lineTo(x + 22, gy + 15);
        const wave = Math.sin(time / 100) * 4;
        ctx.lineTo(x + 10, gy + 30 + wave);
        ctx.lineTo(x, gy + 20 - wave);
        ctx.lineTo(x - 10, gy + 30 + wave);
        ctx.lineTo(x - 22, gy + 15);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#00ffff';
        ctx.fillRect(x - 8, gy - 12, 4, 4);
        ctx.fillRect(x + 4, gy - 12, 4, 4);
    },

    // Dialogue portrait visuals
    drawPortrait(type) {
        const pCanvas = document.getElementById('avatarCanvas');
        const pCtx = pCanvas.getContext('2d');
        pCtx.clearRect(0, 0, 80, 80);
        pCtx.imageSmoothingEnabled = false;

        pCtx.fillStyle = '#0a0a14';
        pCtx.fillRect(0, 0, 80, 80);

        if (type === 'nail') {
            this.drawCompanion(pCtx, 40, 40);
        } else if (type === 'hoca') {
            this.drawGuardian(pCtx, 40, 45);
        } else if (type === 'boss1') {
            if (Images.mustafa.complete) {
                pCtx.drawImage(Images.mustafa, 10, 10, 60, 60);
            } else {
                this.drawBoss1(pCtx, 40, 45, 0);
            }
        } else if (type === 'boss2') {
            if (Images.oktay.complete) {
                pCtx.drawImage(Images.oktay, 10, 10, 60, 60);
            } else {
                this.drawBoss2(pCtx, 40, 45, 0);
            }
        } else if (type === 'arel') {
            if (Images.arel.complete) {
                pCtx.drawImage(Images.arel, 10, 10, 60, 60);
            }
        } else if (type === 'kayra') {
            if (Images.kayra.complete) {
                pCtx.drawImage(Images.kayra, 10, 10, 60, 60);
            }
        } else {
            // Shadow face icon
            pCtx.fillStyle = '#1e1a3a';
            pCtx.fillRect(25, 25, 30, 30);
            pCtx.fillStyle = '#ff0000';
            pCtx.fillRect(32, 34, 3, 3);
            pCtx.fillRect(45, 34, 3, 3);
        }
    },

    // Companion flowey-like shadow guide
    drawCompanion(ctx, x, y) {
        ctx.fillStyle = '#3a2b5c';
        ctx.fillRect(x - 12, y - 12, 24, 18);
        ctx.fillStyle = '#000';
        ctx.fillRect(x - 6, y - 8, 3, 3);
        ctx.fillRect(x + 3, y - 8, 3, 3);
        ctx.fillStyle = '#990000';
        ctx.fillRect(x - 4, y - 2, 8, 2);
        
        ctx.fillStyle = '#1e1233'; // dark stem
        ctx.fillRect(x - 2, y + 6, 4, 14);
    },

    // Guardian Hoca (Shadow Monk)
    drawGuardian(ctx, x, y) {
        ctx.fillStyle = '#1d1936'; // deep dark blue cloak
        ctx.fillRect(x - 16, y - 28, 32, 48);
        
        ctx.fillStyle = '#3f386b'; // secondary colors
        ctx.fillRect(x - 12, y - 24, 24, 20);

        // Glowing red wizard eyes
        ctx.fillStyle = '#ff3333';
        ctx.fillRect(x - 6, y - 16, 3, 3);
        ctx.fillRect(x + 3, y - 16, 3, 3);

        // Gold collar emblem
        ctx.fillStyle = '#d4af37';
        ctx.fillRect(x - 2, y + 2, 4, 4);
    },

    // Boss 1: Karanlik Sovalye (Dark Knight)
    drawBoss1(ctx, x, y, time) {
        const bob = Math.sin(time / 220) * 6;
        const by = y + bob;

        // Dark heavy metallic shield armor
        ctx.fillStyle = '#1d1d2c';
        ctx.fillRect(x - 30, by - 45, 60, 90);
        ctx.fillStyle = '#3c3c54';
        ctx.fillRect(x - 24, by - 39, 48, 78);

        // Horned knight helmet
        ctx.fillStyle = '#0f0f18';
        ctx.fillRect(x - 18, by - 40, 36, 30);
        // Horns
        ctx.fillRect(x - 24, by - 48, 8, 12);
        ctx.fillRect(x + 16, by - 48, 8, 12);

        // Glowing orange eyes in visor
        ctx.fillStyle = '#ff6600';
        ctx.fillRect(x - 10, by - 30, 4, 4);
        ctx.fillRect(x + 6, by - 30, 4, 4);

        // Crimson cape behind armor
        ctx.fillStyle = '#8b0000';
        ctx.fillRect(x - 36, by - 10, 6, 70);
        ctx.fillRect(x + 30, by - 10, 6, 70);
    },

    // Boss 2: Kaos Ejderi (Chaos Dragon)
    drawBoss2(ctx, x, y, time) {
        const bob = Math.sin(time / 140) * 8;
        const by = y + bob;
        const bx = x + Math.cos(time / 200) * 8;

        // Giant purple floating dragon head
        ctx.fillStyle = '#3a0d5c';
        ctx.fillRect(bx - 40, by - 40, 80, 80);
        ctx.fillStyle = '#1f0433';
        ctx.fillRect(bx - 32, by - 32, 64, 64);

        // Glowing green horns
        ctx.fillStyle = '#39ff14';
        ctx.fillRect(bx - 36, by - 55, 10, 18);
        ctx.fillRect(bx + 26, by - 55, 10, 18);

        // Slit yellow glowing eyes
        ctx.fillStyle = '#ffff00';
        ctx.fillRect(bx - 20, by - 20, 12, 6);
        ctx.fillRect(bx + 8, by - 20, 12, 6);
        ctx.fillStyle = '#000';
        ctx.fillRect(bx - 16, by - 20, 4, 6);
        ctx.fillRect(bx + 12, by - 20, 4, 6);

        // Exposed white sharp teeth jaw
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(bx - 24, by + 12, 48, 8);
        ctx.fillStyle = '#000000'; // gaps between teeth
        ctx.fillRect(bx - 16, by + 12, 4, 8);
        ctx.fillRect(bx - 4, by + 12, 4, 8);
        ctx.fillRect(bx + 8, by + 12, 4, 8);
    },

    // Wandering challenger slimes & crawlers
    drawChallenger(ctx, x, y, size, type) {
        if (type === 'slime') {
            if (Images.arel.complete) {
                ctx.drawImage(Images.arel, x - size, y - size, size * 2, size * 2);
            } else {
                // Shadow jelly
                ctx.fillStyle = '#261c38';
                ctx.beginPath();
                ctx.arc(x, y + 4, size, 0, Math.PI, true);
                ctx.fill();
                ctx.fillRect(x - size, y + 3, size * 2, size * 0.6);
                
                // Glowing red eyes
                ctx.fillStyle = '#ff0000';
                ctx.fillRect(x - size * 0.3, y - 2, 2, 2);
                ctx.fillRect(x + size * 0.2, y - 2, 2, 2);
            }
        } else {
            if (Images.kayra.complete) {
                ctx.drawImage(Images.kayra, x - size, y - size, size * 2, size * 2);
            } else {
                // Crawler bug
                ctx.fillStyle = '#3a2010';
                ctx.fillRect(x - size * 0.75, y - size * 0.5, size * 1.5, size);
                ctx.fillStyle = '#ffaa00'; // orange eyes
                ctx.fillRect(x - size * 0.35, y - 4, 3, 3);
                ctx.fillRect(x + size * 0.2, y - 4, 3, 3);
            }
        }
    },

    // Merchant (Dark Cloaked figure)
    drawShopkeeper(ctx, x, y) {
        ctx.fillStyle = '#0c081f'; // dark purple cloak
        ctx.fillRect(x - 25, y - 35, 50, 70);
        
        ctx.fillStyle = '#171333'; // face mask
        ctx.fillRect(x - 15, y - 25, 30, 24);

        // Glowing cyan goggles
        ctx.fillStyle = '#00ffff';
        ctx.fillRect(x - 12, y - 18, 10, 8);
        ctx.fillRect(x + 2, y - 18, 10, 8);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.strokeRect(x - 12, y - 18, 10, 8);
        ctx.strokeRect(x + 2, y - 18, 10, 8);
    },

    // Mystery portal pixel vortex
    drawPortal(ctx, x, y, time) {
        const angle = (time / 150) % (Math.PI * 2);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);

        // Swirling nested rectangles/circles
        ctx.fillStyle = 'rgba(88, 20, 135, 0.4)';
        ctx.fillRect(-24, -24, 48, 48);

        ctx.fillStyle = 'rgba(147, 51, 234, 0.7)';
        ctx.fillRect(-16, -16, 32, 32);

        ctx.fillStyle = '#ffff00'; // glowing golden center
        ctx.fillRect(-6, -6, 12, 12);

        ctx.restore();
    }
};

// ==========================================
// 4. DIALOGUE SYSTEM WITH RETRO TYPING
// ==========================================
const DialogSystem = {
    show(speaker, text, callback = null, portrait = 'none') {
        Game.dialogue.speaker = speaker;
        Game.dialogue.text = text;
        Game.dialogue.visibleText = '';
        Game.dialogue.charIndex = 0;
        Game.dialogue.timer = 0;
        Game.dialogue.portrait = portrait;
        Game.dialogue.callback = callback;
        Game.dialogue.active = true;

        const overlay = document.getElementById('dialog-overlay');
        overlay.classList.remove('hidden');
        document.querySelector('.dialog-speaker').innerText = speaker;
        document.querySelector('.dialog-text').innerText = '';

        this.drawPortrait(portrait);
    },

    drawPortrait(type) {
        Sprites.drawPortrait(type);
    },

    update() {
        if (!Game.dialogue.active) return;

        if (Game.dialogue.charIndex < Game.dialogue.text.length) {
            Game.dialogue.timer++;
            if (Game.dialogue.timer >= 2) {
                Game.dialogue.timer = 0;
                Game.dialogue.visibleText += Game.dialogue.text[Game.dialogue.charIndex];
                Game.dialogue.charIndex++;
                document.querySelector('.dialog-text').innerText = Game.dialogue.visibleText;
                AudioEngine.playTextBuzz();
            }
        }
    },

    next() {
        if (Game.dialogue.charIndex < Game.dialogue.text.length) {
            Game.dialogue.charIndex = Game.dialogue.text.length;
            Game.dialogue.visibleText = Game.dialogue.text;
            document.querySelector('.dialog-text').innerText = Game.dialogue.visibleText;
            return;
        }

        Game.dialogue.active = false;
        document.getElementById('dialog-overlay').classList.add('hidden');
        
        if (Game.dialogue.callback) {
            const cb = Game.dialogue.callback;
            Game.dialogue.callback = null;
            cb();
        }
    },

    cancel() {
        if (Game.dialogue.charIndex < Game.dialogue.text.length) {
            Game.dialogue.charIndex = Game.dialogue.text.length;
            Game.dialogue.visibleText = Game.dialogue.text;
            document.querySelector('.dialog-text').innerText = Game.dialogue.visibleText;
            return;
        }

        Game.dialogue.active = false;
        document.getElementById('dialog-overlay').classList.add('hidden');
        Game.dialogue.callback = null; // Clear callback so the fight doesn't start!
    }
};

// ==========================================
// 5. UNDERTAIL COMBAT SYSTEM (DODGE BOX)
// ==========================================
const CombatEngine = {
    start(bossData, isChallenge = false) {
        AudioEngine.playBGM('savas.mp3'); // Play combat music

        Game.battle.active = true;
        Game.battle.boss = bossData;
        Game.battle.menuIndex = 0;
        Game.battle.bullets = [];
        Game.battle.popups = [];
        Game.battle.heartX = 400;
        Game.battle.heartY = 320;
        Game.battle.isChallenge = isChallenge;
        Game.battle.leveledUp = false;

        const startsInDodge = bossData.id !== 'boss1' && bossData.id !== 'boss2';
        const totalPatterns = bossData.id === 'boss2' ? 5 : 3;
        Game.battle.currentAttackPattern = Math.floor(Math.random() * totalPatterns);

        if (startsInDodge) {
            // Standard battles and tutorial start directly in the dodge phase (opponent's turn first)
            Game.battle.phase = 'dodge';
            Game.battle.laserHitsThisDodge = 0;
            Game.battle.dodgeTimer = Game.battle.dodgeDuration;
            Game.battle.message = 'Rakip saldiriyor! Mermilerden kac!';
        } else {
            Game.battle.phase = 'menu';
            Game.battle.message = `Karanlikta ${bossData.name} belirdi!`;
        }
        
        Game.currentScreen = 'OVERWORLD';
    },

    update(time) {
        if (!Game.battle.active) return;

        // Process visual damage popups
        if (Game.battle.popups) {
            for (let i = Game.battle.popups.length - 1; i >= 0; i--) {
                const p = Game.battle.popups[i];
                p.y -= 0.6;
                p.timer -= 16.67;
                if (p.timer <= 0) {
                    Game.battle.popups.splice(i, 1);
                }
            }
        }

        if (Game.battle.phase === 'dodge') {
            const box = { x: 250, y: 240, w: 300, h: 160 };
            let dx = 0, dy = 0;

            if (Game.keys['ArrowUp'] || Game.keys['KeyW']) dy = -1;
            if (Game.keys['ArrowDown'] || Game.keys['KeyS']) dy = 1;
            if (Game.keys['ArrowLeft'] || Game.keys['KeyA']) dx = -1;
            if (Game.keys['ArrowRight'] || Game.keys['KeyD']) dx = 1;

            Game.battle.heartX += dx * Game.battle.heartSpeed;
            Game.battle.heartY += dy * Game.battle.heartSpeed;

            const hr = 7;
            if (Game.battle.heartX - hr < box.x) Game.battle.heartX = box.x + hr;
            if (Game.battle.heartX + hr > box.x + box.w) Game.battle.heartX = box.x + box.w - hr;
            if (Game.battle.heartY - hr < box.y) Game.battle.heartY = box.y + hr;
            if (Game.battle.heartY + hr > box.y + box.h) Game.battle.heartY = box.y + box.h - hr;

            this.generateBullets(time);
            this.updateBullets();

            Game.battle.dodgeTimer -= 16.67;
            if (Game.battle.dodgeTimer <= 0) {
                Game.battle.phase = 'menu';
                Game.battle.bullets = [];
                Game.battle.message = 'Senin siran! Karar ver.';
            }
        }

        if (Game.battle.phase === 'fight_timing') {
            Game.battle.fightTimingPos += Game.battle.fightTimingSpeed * Game.battle.fightTimingDir;
            if (Game.battle.fightTimingPos > 140) Game.battle.fightTimingDir = -1;
            else if (Game.battle.fightTimingPos < -140) Game.battle.fightTimingDir = 1;
        }
    },

    generateBullets(time) {
        const box = { x: 250, y: 240, w: 300, h: 160 };
        const bossId = Game.battle.boss.id;
        const pattern = Game.battle.currentAttackPattern || 0;
        
        let spawnChance = 0.045;
        if (bossId === 'boss2') {
            spawnChance = 0.08;
        }

        if (Math.random() > spawnChance) return;

        // 1. TUTORIAL / EASY ENEMIES (Including Ar3l)
        if (bossId === 'tutorial' || bossId === 'portal_combat_easy' || bossId === 'ar3l') {
            if (pattern === 0) {
                Game.battle.bullets.push({
                    x: box.x + Math.random() * box.w,
                    y: box.y - 10,
                    vx: (Math.random() - 0.5) * 1.5,
                    vy: 2.0,
                    size: 8,
                    color: '#a855f7',
                    type: 'circle'
                });
            } else if (pattern === 1) {
                const startX = box.x + 40 + Math.random() * (box.w - 80);
                Game.battle.bullets.push({
                    x: startX,
                    startX: startX,
                    y: box.y - 10,
                    vx: 0,
                    vy: 1.6,
                    size: 10,
                    color: '#c084fc',
                    type: 'wave',
                    phaseOffset: Math.random() * Math.PI * 2
                });
            } else {
                const px = Game.battle.heartX;
                const py = Game.battle.heartY;
                const sx = box.x + (Math.random() < 0.5 ? 0 : box.w);
                const sy = box.y + Math.random() * box.h;
                const angle = Math.atan2(py - sy, px - sx);
                Game.battle.bullets.push({
                    x: sx,
                    y: sy,
                    vx: Math.cos(angle) * 1.8,
                    vy: Math.sin(angle) * 1.8,
                    size: 12,
                    color: '#38bdf8',
                    type: 'spear'
                });
            }
        }
        // 2. MEDIUM ENEMIES (Sir Mustafa & Portal Medium & Kayratıl)
        else if (bossId === 'boss1' || bossId === 'portal_combat_medium' || bossId === 'kayra') {
            if (pattern === 0) {
                // Arayıcı Mızraklar (Aiming Spears) - Buffed velocity
                const px = Game.battle.heartX;
                const py = Game.battle.heartY;
                let sx, sy;
                if (Math.random() < 0.5) {
                    sx = box.x + Math.random() * box.w;
                    sy = box.y - 10;
                } else {
                    sx = Math.random() < 0.5 ? box.x - 10 : box.x + box.w + 10;
                    sy = box.y + Math.random() * box.h;
                }
                const angle = Math.atan2(py - sy, px - sx);
                Game.battle.bullets.push({
                    x: sx,
                    y: sy,
                    vx: Math.cos(angle) * 4.2,
                    vy: Math.sin(angle) * 4.2,
                    size: 14,
                    color: '#38bdf8',
                    type: 'spear'
                });
            } else if (pattern === 1) {
                // Sinüs Dalgası Orb'ları (Wave Orbs) - Buffed velocity
                const startX = box.x + 40 + Math.random() * (box.w - 80);
                Game.battle.bullets.push({
                    x: startX,
                    startX: startX,
                    y: box.y - 10,
                    vx: 0,
                    vy: 3.0,
                    size: 12,
                    color: '#a855f7',
                    type: 'wave',
                    phaseOffset: Math.random() * Math.PI * 2
                });
            } else {
                // Seksen Toplar (Bouncing Spikes) - Buffed velocity
                Game.battle.bullets.push({
                    x: box.x + Math.random() * box.w,
                    y: box.y + 10,
                    vx: (Math.random() - 0.5) * 3.2,
                    vy: 3.2,
                    size: 10,
                    color: '#fb7185',
                    type: 'chalk',
                    bounce: 4
                });
            }
        }
        // 3. BOSS 2 (Mr. Zoktay) - 5 different mini games - Buffed velocities & laser sizes
        else if (bossId === 'boss2') {
            if (pattern === 0) {
                // Arayıcı Mızraklar (Aiming Spears)
                const px = Game.battle.heartX;
                const py = Game.battle.heartY;
                let sx, sy;
                if (Math.random() < 0.5) {
                    sx = box.x + Math.random() * box.w;
                    sy = box.y - 10;
                } else {
                    sx = Math.random() < 0.5 ? box.x - 10 : box.x + box.w + 10;
                    sy = box.y + Math.random() * box.h;
                }
                const angle = Math.atan2(py - sy, px - sx);
                Game.battle.bullets.push({
                    x: sx,
                    y: sy,
                    vx: Math.cos(angle) * 3.2,
                    vy: Math.sin(angle) * 3.2,
                    size: 14,
                    color: '#39ff14',
                    type: 'spear'
                });
            } else if (pattern === 1) {
                // Sinüs Dalgası Orb'ları (Wave Orbs)
                const startX = box.x + 40 + Math.random() * (box.w - 80);
                Game.battle.bullets.push({
                    x: startX,
                    startX: startX,
                    y: box.y - 10,
                    vx: 0,
                    vy: 2.4,
                    size: 12,
                    color: '#a855f7',
                    type: 'wave',
                    phaseOffset: Math.random() * Math.PI * 2
                });
            } else if (pattern === 2) {
                // Gaster Blaster Lazerleri (Warning Lasers)
                const isHorizontal = Math.random() < 0.5;
                const targetX = box.x + Math.random() * box.w;
                const targetY = box.y + Math.random() * box.h;
                Game.battle.bullets.push({
                    x: isHorizontal ? box.x : targetX,
                    y: isHorizontal ? targetY : box.y,
                    targetX: targetX,
                    targetY: targetY,
                    isHorizontal: isHorizontal,
                    type: 'laser',
                    spawnTime: Date.now(),
                    warningDuration: 400,
                    activeDuration: 250,
                    laserWidth: 26,
                    color: '#ef4444',
                    hitRegistered: false
                });
            } else if (pattern === 3) {
                // Seksen Toplar (Bouncing Spikes)
                Game.battle.bullets.push({
                    x: box.x + Math.random() * box.w,
                    y: box.y + 10,
                    vx: (Math.random() - 0.5) * 2.8,
                    vy: 2.8,
                    size: 10,
                    color: '#ffff00',
                    type: 'chalk',
                    bounce: 4
                });
            } else {
                // Spiral Yıldızlar (Spiral Stars)
                const angle = (time / 80) % (Math.PI * 2);
                Game.battle.bullets.push({
                    x: 400,
                    y: 320,
                    vx: Math.cos(angle) * 3.0,
                    vy: Math.sin(angle) * 3.0,
                    size: 10,
                    color: '#39ff14',
                    type: 'star'
                });
                if (Math.random() < 0.35) {
                    Game.battle.bullets.push({
                        x: 400,
                        y: 320,
                        vx: Math.cos(-angle) * 4.0,
                        vy: Math.sin(-angle) * 4.0,
                        size: 10,
                        color: '#ffff00',
                        type: 'star'
                    });
                }
            }
        }
    },

    updateBullets() {
        const box = { x: 250, y: 240, w: 300, h: 160 };

        for (let i = Game.battle.bullets.length - 1; i >= 0; i--) {
            const b = Game.battle.bullets[i];

            if (b.type === 'wave') {
                b.y += b.vy;
                b.x = b.startX + Math.sin(Date.now() / 150 + b.phaseOffset) * 45;
            } else if (b.type === 'laser') {
                const elapsed = Date.now() - b.spawnTime;
                if (elapsed >= b.warningDuration + b.activeDuration) {
                    Game.battle.bullets.splice(i, 1);
                    continue;
                }
            } else {
                b.x += b.vx;
                b.y += b.vy;
            }

            if (b.type === 'chalk' && b.bounce > 0) {
                if (b.x <= box.x || b.x >= box.x + box.w) {
                    b.vx *= -1;
                    b.bounce--;
                }
                if (b.y >= box.y + box.h) {
                    b.vy *= -1;
                    b.bounce--;
                }
            }

            if (b.type !== 'laser') {
                if (b.x < box.x - 30 || b.x > box.x + box.w + 30 || b.y < box.y - 30 || b.y > box.y + box.h + 30) {
                    Game.battle.bullets.splice(i, 1);
                    continue;
                }
            }

            let isHit = false;

            if (b.type === 'laser') {
                const elapsed = Date.now() - b.spawnTime;
                if (elapsed >= b.warningDuration && !b.hitRegistered) {
                    // Laser combo cap: max 2 laser hits per dodge phase
                    if (Game.battle.laserHitsThisDodge >= 2) {
                        b.hitRegistered = true; // Skip this laser
                    } else if (b.isHorizontal) {
                        if (Math.abs(Game.battle.heartY - b.targetY) < (b.laserWidth/2 + 6)) {
                            isHit = true;
                            b.hitRegistered = true;
                            Game.battle.laserHitsThisDodge++;
                        }
                    } else {
                        if (Math.abs(Game.battle.heartX - b.targetX) < (b.laserWidth/2 + 6)) {
                            isHit = true;
                            b.hitRegistered = true;
                            Game.battle.laserHitsThisDodge++;
                        }
                    }
                }
            } else {
                const dist = Math.hypot(b.x - Game.battle.heartX, b.y - Game.battle.heartY);
                if (dist < (b.size/2 + 5)) {
                    isHit = true;
                    Game.battle.bullets.splice(i, 1);
                }
            }

            if (isHit) {
                AudioEngine.playHitSound();
                let hitDmg = 2;
                const hitIsLaser = (b.type === 'laser');
                if (Game.battle.boss) {
                    if (Game.battle.boss.id === 'boss1') hitDmg = 4;
                    else if (Game.battle.boss.id === 'boss2') {
                        hitDmg = hitIsLaser ? 5 : 3; // Lasers deal 5, normal bullets deal 3
                    }
                }
                const equippedArmor = Game.player.inventory.find(item => item.type === 'armor' && item.equipped);
                if (equippedArmor) {
                    hitDmg = Math.max(1, hitDmg - 2);
                }

                Game.player.hp -= hitDmg;
                if (Game.player.hp < 0) Game.player.hp = 0;
                
                // Add damage popup above the player heart
                Game.battle.popups.push({
                    x: Game.battle.heartX,
                    y: Game.battle.heartY - 15,
                    text: `-${hitDmg}`,
                    color: '#ff3333',
                    timer: 800
                });

                const hpBar = document.getElementById('hud-hp-bar');
                hpBar.style.backgroundColor = '#ff0000';
                setTimeout(() => hpBar.style.backgroundColor = 'var(--accent-yellow)', 100);

                if (Game.player.hp <= 0) {
                    this.triggerDefeat();
                    break;
                }
            }
        }
    },

    triggerDefeat() {
        Game.battle.phase = 'defeat';
        AudioEngine.playBreakSound();
        AudioEngine.stopBGM(); // Stop combat BGM
        Game.battle.message = 'Ruhun parcalandi...';

        const bossId = Game.battle.boss.id;

        setTimeout(() => {
            Game.battle.active = false;
            Game.player.hp = Game.player.maxHp;
            
            AudioEngine.playBGM('maintheme.mp3'); // Play overworld BGM on respawn
            
            if (bossId === 'boss1' || bossId === 'boss2') {
                // Respawn right in front of the boss outside!
                Game.currentLocation = 'OUTSIDE';
                Game.overworldPage = 0;
                Game.player.x = 400;
                Game.player.y = 360; // place player slightly below the boss
                
                // Repopulate page 0 entities to make sure boss is there
                Engine.onOverworldPageChange(0);

                DialogSystem.show('KORUYUCU HOCA', 'Yenildin ama mücadele henüz bitmedi! Boss karşısında tekrar doğdun.', null, 'hoca');
            } else {
                // Normal respawn back to House Room 1!
                Game.currentLocation = 'HOUSE';
                Game.currentRoom = 1; // back to Entrance Hall
                Game.player.x = 400;
                Game.player.y = 300;

                // Call Room Enter to clear the entities / mobs!
                Engine.onRoomEnter(1);

                DialogSystem.show('KORUYUCU HOCA', 'Ruhun yenilgiye ugradi ama hicbir seyini kaybetmedin. Evin guvenli girisinde yeniden dogdun.', null, 'hoca');
            }
        }, 2200);
    },

    triggerVictory() {
        Game.battle.phase = 'victory';
        AudioEngine.playVictorySound();
        AudioEngine.stopBGM(); // Stop battle music
        
        // Clear bullets immediately so player is safe!
        Game.battle.bullets = [];

        let reward = Game.battle.boss.reward;
        let xpReward = 0;
        const bossId = Game.battle.boss.id;
        
        // Determine XP reward based on boss/enemy type
        if (bossId === 'tutorial') {
            xpReward = 0; // First training has 0 XP
        } else if (bossId === 'portal_combat_easy' || bossId === 'ar3l') {
            xpReward = 15;
        } else if (bossId === 'portal_combat_medium' || bossId === 'kayra') {
            xpReward = 25;
        } else if (bossId === 'boss1') {
            xpReward = 50;
        } else if (bossId === 'boss2') {
            xpReward = 100;
        } else {
            xpReward = 10;
        }

        if (Game.battle.isChallenge) {
            reward = Game.battle.challengeWager;
            Game.player.kirkel += reward;
            Game.battle.message = `Tebrikler! Meydan okumayi kazandin! +${reward} Kirkel ve +${xpReward} XP kazandin.`;
            
            // Remove the challenger entity from the overworld list
            if (Game.battle.triggerEntityId) {
                Game.entities = Game.entities.filter(e => e.id !== Game.battle.triggerEntityId);
                Game.battle.triggerEntityId = null;
            }
        } else {
            Game.player.kirkel += reward;
            Game.battle.message = `Tebrikler! ${Game.battle.boss.name} yenildi! +${reward} Kirkel ve +${xpReward} XP kazandin.`;
            
            // Remove boss from temporary overworld spawn list
            Game.entities = Game.entities.filter(e => e.id !== bossId);
        }

        Game.gainXP(xpReward);

        setTimeout(() => {
            Game.battle.active = false;
            const leveledUp = Game.battle.leveledUp;
            Game.battle.leveledUp = false;
            Game.player.hp = Game.player.maxHp; // Heal to full on victory

            if (bossId !== 'boss2') {
                AudioEngine.playBGM('maintheme.mp3'); // Resume overworld music
            }

            // If completed the starting training combat:
            if (bossId === 'tutorial') {
                Game.currentLocation = 'HOUSE';
                Game.currentRoom = 1;
                Game.player.x = 400;
                Game.player.y = 300;
                
                // Clear the entities / mobs!
                Engine.onRoomEnter(1);

                let text = 'Undernail dunyasına adım attın. Evimiz "7/B SALONU"nda güvendesin. Mini oyunları ara, kutu bulmacalarını cöz ve dısarıdaki portal rıhtımlarını kesfet.';
                if (leveledUp) {
                    text = `SEVİYE ATLADIN! LV ${Game.player.level} oldun! Maksimum HP arttı ve tamamen iyileştin.\n\n` + text;
                }
                DialogSystem.show('KORUYUCU HOCA', text, null, 'hoca');
            } else if (bossId === 'boss1') {
                Game.boss1Defeated = true;
                Game.entities = Game.entities.filter(e => e.id !== 'boss1');
                
                DialogSystem.show('Sir Mustafa', 'Bre Kafir Nasıl Olur Bu?! Görüşürüz Yalan Dünyaa...', () => {
                    if (leveledUp) {
                        AudioEngine.playVictorySound();
                        DialogSystem.show('SİSTEM', `GÜÇLENDİN! LV ${Game.player.level} oldun! Maksimum HP arttı ve tamamen iyileştin.`, null, 'none');
                    }
                }, 'boss1');
            } else if (bossId === 'boss2') {
                Game.boss2Defeated = true;
                Game.entities = Game.entities.filter(e => e.id !== 'boss2');
                
                DialogSystem.show('Mr. Zoktay', 'S-ss-e-sen n-nn-nasıl? Ahh, savaşçı yolun açık olsun.', () => {
                    DialogSystem.show('Mr. Zoktay', 'Elveda manifest...', () => {
                        AudioEngine.playExcitingMusic();
                        Game.currentScreen = 'UNDERNAIL_VICTORY';
                    }, 'boss2');
                }, 'boss2');
            } else if (bossId === 'ar3l') {
                DialogSystem.show('Ar3l', 'Nasıl ama bu im-kan-sız!', () => {
                    if (leveledUp) {
                        AudioEngine.playVictorySound();
                        DialogSystem.show('SİSTEM', `GÜÇLENDİN! LV ${Game.player.level} oldun! Maksimum HP arttı ve tamamen iyileştin.`, null, 'none');
                    }
                }, 'arel');
            } else if (bossId === 'kayra') {
                DialogSystem.show('Kayratıll', 'AHHHHHH OHHHHH UHHHHHH AHHHH', () => {
                    if (leveledUp) {
                        AudioEngine.playVictorySound();
                        DialogSystem.show('SİSTEM', `GÜÇLENDİN! LV ${Game.player.level} oldun! Maksimum HP arttı ve tamamen iyileştin.`, null, 'none');
                    }
                }, 'kayra');
            } else {
                if (leveledUp) {
                    AudioEngine.playVictorySound();
                    DialogSystem.show('SİSTEM', `GÜÇLENDİN! LV ${Game.player.level} oldun! Maksimum HP arttı ve tamamen iyileştin.`, null, 'none');
                }
            }
        }, 500); // 500ms minimal delay to play fanfare and transition back immediately
    },

    handleInput(key) {
        if (!Game.battle.active) return;

        if (Game.battle.phase === 'menu') {
            if (key === 'ArrowLeft' || key === 'KeyA') {
                Game.battle.menuIndex = (Game.battle.menuIndex - 1 + 4) % 4;
                AudioEngine.playBeep(400, 0.05);
            }
            if (key === 'ArrowRight' || key === 'KeyD') {
                Game.battle.menuIndex = (Game.battle.menuIndex + 1) % 4;
                AudioEngine.playBeep(400, 0.05);
            }
            if (key === 'KeyZ' || key === 'Enter') {
                AudioEngine.playBeep(550, 0.08);
                const choice = Game.battle.menuIndex;
                if (choice === 0) { // FIGHT
                    Game.battle.phase = 'fight_timing';
                    Game.battle.fightTimingPos = -140;
                    Game.battle.fightTimingDir = 1;
                } else if (choice === 1) { // ACT (Eylem)
                    Game.battle.phase = 'act';
                    Game.battle.message = `${Game.battle.boss.name} sana karanlikta bos gozlerle bakti. Meydan okuyorsun.`;
                } else if (choice === 2) { // ITEM (Esya)
                    if (Game.player.inventory.length === 0) {
                        Game.battle.message = 'Cantanda hic esya yok!';
                        setTimeout(() => Game.battle.message = 'Senin siran! Karar ver.', 1000);
                    } else {
                        Game.battle.phase = 'item';
                        Game.battle.menuIndex = 0;
                    }
                } else if (choice === 3) { // MERCY (Merhamet)
                    if (Game.battle.boss.id === 'tutorial') {
                        Game.battle.message = 'Egitim savasindan kacamazsin!';
                        setTimeout(() => Game.battle.message = 'Senin siran! Karar ver.', 1000);
                    } else {
                        Game.battle.message = 'Savaş alanından kactin!';
                        AudioEngine.stopBGM(); // Stop battle music
                        setTimeout(() => {
                            Game.battle.active = false;
                            Game.player.hp = Game.player.maxHp; // Heal to full on escape
                            AudioEngine.playBGM('maintheme.mp3'); // Resume overworld music
                        }, 1000);
                    }
                }
            }
        }

        else if (Game.battle.phase === 'fight_timing') {
            if (key === 'KeyZ' || key === 'Enter') {
                const offset = Math.abs(Game.battle.fightTimingPos);
                // Require timing to hit the center target area (increased to 35 for easier hitting!)
                if (offset <= 35) {
                    let damage = Math.floor(Math.max(4, 25 - offset * 0.16));
                    damage += Game.player.level * 2;
                    
                    // Attack weapon buff check (must be equipped)
                    const equippedWeapon = Game.player.inventory.find(item => item.type === 'weapon' && item.equipped);
                    if (equippedWeapon) {
                        damage += equippedWeapon.value; // Add weapon's attack value (+8)
                    }

                    Game.battle.boss.hp -= damage;
                    AudioEngine.playHitSound();

                    Game.battle.message = `Kritik Saldırı! ${damage} Hasar verdin!`;
                    
                    // Spawn damage popup above boss sprite (at center top)
                    Game.battle.popups.push({
                        x: 400,
                        y: 100,
                        text: `-${damage}`,
                        color: '#fbbf24',
                        timer: 1000
                    });

                    if (Game.battle.boss.hp <= 0) {
                        this.triggerVictory();
                    } else {
                        setTimeout(() => {
                            Game.battle.phase = 'dodge';
                            Game.battle.laserHitsThisDodge = 0;
                            Game.battle.dodgeTimer = Game.battle.dodgeDuration;
                            Game.battle.currentAttackPattern = Math.floor(Math.random() * (Game.battle.boss.id === 'boss2' ? 5 : 3));
                        }, 1200);
                    }
                } else {
                    // MISS
                    AudioEngine.playBeep(120, 0.25, 'sawtooth');
                    Game.battle.message = 'Iskaladın!';
                    
                    // Spawn "MISS" popup above boss sprite
                    Game.battle.popups.push({
                        x: 400,
                        y: 100,
                        text: 'MISS',
                        color: '#6b7280',
                        timer: 800
                    });

                    // Immediately transition to dodge phase (opponent's turn)
                    Game.battle.phase = 'dodge';
                    Game.battle.laserHitsThisDodge = 0;
                    Game.battle.dodgeTimer = Game.battle.dodgeDuration;
                    Game.battle.currentAttackPattern = Math.floor(Math.random() * (Game.battle.boss.id === 'boss2' ? 5 : 3));
                }
            }
        }

        else if (Game.battle.phase === 'act') {
            if (key === 'KeyZ' || key === 'Enter') {
                Game.battle.phase = 'dodge';
                Game.battle.laserHitsThisDodge = 0;
                Game.battle.dodgeTimer = Game.battle.dodgeDuration;
                Game.battle.currentAttackPattern = Math.floor(Math.random() * (Game.battle.boss.id === 'boss2' ? 5 : 3));
            }
        }

        else if (Game.battle.phase === 'item') {
            if (key === 'ArrowUp' || key === 'KeyW') {
                Game.battle.menuIndex = (Game.battle.menuIndex - 1 + Game.player.inventory.length) % Game.player.inventory.length;
            }
            if (key === 'ArrowDown' || key === 'KeyS') {
                Game.battle.menuIndex = (Game.battle.menuIndex + 1) % Game.player.inventory.length;
            }
            if (key === 'KeyX') {
                Game.battle.phase = 'menu';
                Game.battle.menuIndex = 2;
            }
            if (key === 'KeyZ' || key === 'Enter') {
                const item = Game.player.inventory[Game.battle.menuIndex];
                if (item.type === 'heal') {
                    AudioEngine.playHealSound();
                    Game.player.hp += item.value;
                    if (Game.player.hp > Game.player.maxHp) Game.player.hp = Game.player.maxHp;
                    
                    Game.player.inventory.splice(Game.battle.menuIndex, 1);
                    Game.battle.message = `${item.name} kullandın. HP iyilesti!`;
                    
                    setTimeout(() => {
                        Game.battle.phase = 'dodge';
                        Game.battle.laserHitsThisDodge = 0;
                        Game.battle.dodgeTimer = Game.battle.dodgeDuration;
                        Game.battle.currentAttackPattern = Math.floor(Math.random() * (Game.battle.boss.id === 'boss2' ? 5 : 3));
                    }, 1200);
                } else if (item.type === 'weapon' || item.type === 'armor') {
                    AudioEngine.playHealSound(); // Play sound effect on equip
                    
                    // Unequip any other item of the same type
                    Game.player.inventory.forEach(i => {
                        if (i.type === item.type) i.equipped = false;
                    });
                    
                    item.equipped = true; // Mark as equipped
                    Game.battle.message = `${item.name} kuşandın!`;
                    
                    setTimeout(() => {
                        Game.battle.phase = 'dodge';
                        Game.battle.laserHitsThisDodge = 0;
                        Game.battle.dodgeTimer = Game.battle.dodgeDuration;
                        Game.battle.currentAttackPattern = Math.floor(Math.random() * (Game.battle.boss.id === 'boss2' ? 5 : 3));
                    }, 1200);
                }
            }
        }
    },

    draw(ctx) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, 800, 480);

        const boss = Game.battle.boss;
        ctx.fillStyle = '#ffffff';
        ctx.font = '11px "Press Start 2P"';
        ctx.fillText(boss.name, 100, 40);
        
        ctx.fillStyle = '#333333';
        ctx.fillRect(100, 50, 200, 8);
        ctx.fillStyle = '#ff0000';
        const bossHpPercent = Math.max(0, boss.hp / boss.maxHp);
        ctx.fillRect(100, 50, 200 * bossHpPercent, 8);

        const time = Date.now();
        const sType = boss.sprite || (boss.id === 'tutorial' ? 'dummy' : 'golge');

        if (sType === 'dummy') {
            Sprites.drawDummy(ctx, 400, 120, time);
        } else if (sType === 'slime') {
            if (Images.arel.complete) {
                ctx.drawImage(Images.arel, 400 - 30, 120 - 30, 60, 60);
            } else {
                Sprites.drawSlimeCombat(ctx, 400, 120, time);
            }
        } else if (sType === 'crawler') {
            if (Images.kayra.complete) {
                ctx.drawImage(Images.kayra, 400 - 30, 120 - 30, 60, 60);
            } else {
                Sprites.drawCrawlerCombat(ctx, 400, 120, time);
            }
        } else if (sType === 'bekci') {
            Sprites.drawBekciCombat(ctx, 400, 120, time);
        } else if (sType === 'golge') {
            Sprites.drawGolgeCombat(ctx, 400, 120, time);
        } else if (boss.id === 'boss1' || sType === 'boss1') {
            if (Images.mustafa.complete) {
                ctx.drawImage(Images.mustafa, 400 - 45, 120 - 45, 90, 90);
            } else {
                Sprites.drawBoss1(ctx, 400, 120, time);
            }
        } else if (boss.id === 'boss2' || sType === 'boss2') {
            if (Images.oktay.complete) {
                ctx.drawImage(Images.oktay, 400 - 50, 120 - 50, 100, 100);
            } else {
                Sprites.drawBoss2(ctx, 400, 120, time);
            }
        } else {
            Sprites.drawGolgeCombat(ctx, 400, 120, time);
        }

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 4;
        ctx.strokeRect(250, 240, 300, 160);

        if (Game.battle.phase === 'dodge') {
            Sprites.drawHeart(ctx, Game.battle.heartX, Game.battle.heartY, 14);

            Game.battle.bullets.forEach(b => {
                ctx.fillStyle = b.color;
                if (b.type === 'circle' || b.type === 'star' || b.type === 'wave') {
                    ctx.beginPath();
                    ctx.arc(b.x, b.y, b.size/2, 0, Math.PI * 2);
                    ctx.fill();
                    if (b.type === 'star') {
                        ctx.strokeStyle = '#ffffff';
                        ctx.lineWidth = 1;
                        ctx.stroke();
                    }
                } else if (b.type === 'paper') {
                    ctx.fillRect(b.x - b.size/2, b.y - b.size/2, b.size, b.size);
                } else if (b.type === 'chalk') {
                    ctx.fillRect(b.x - 3, b.y - b.size/2, 6, b.size);
                } else if (b.type === 'spear') {
                    const angle = Math.atan2(b.vy, b.vx);
                    ctx.save();
                    ctx.translate(b.x, b.y);
                    ctx.rotate(angle);
                    ctx.fillStyle = b.color;
                    ctx.beginPath();
                    ctx.moveTo(b.size, 0);
                    ctx.lineTo(-b.size/2, -b.size/3);
                    ctx.lineTo(-b.size/2, b.size/3);
                    ctx.closePath();
                    ctx.fill();
                    ctx.restore();
                } else if (b.type === 'laser') {
                    const elapsed = Date.now() - b.spawnTime;
                    const box = { x: 250, y: 240, w: 300, h: 160 };
                    
                    if (elapsed < b.warningDuration) {
                        ctx.strokeStyle = '#ef4444';
                        ctx.lineWidth = 2;
                        ctx.setLineDash([4, 4]);
                        ctx.beginPath();
                        if (b.isHorizontal) {
                            ctx.moveTo(box.x, b.targetY);
                            ctx.lineTo(box.x + box.w, b.targetY);
                        } else {
                            ctx.moveTo(b.targetX, box.y);
                            ctx.lineTo(b.targetX, box.y + box.h);
                        }
                        ctx.stroke();
                        ctx.setLineDash([]);
                    } else {
                        ctx.save();
                        ctx.strokeStyle = b.color;
                        ctx.lineWidth = b.laserWidth;
                        ctx.beginPath();
                        if (b.isHorizontal) {
                            ctx.moveTo(box.x, b.targetY);
                            ctx.lineTo(box.x + box.w, b.targetY);
                        } else {
                            ctx.moveTo(b.targetX, box.y);
                            ctx.lineTo(b.targetX, box.y + box.h);
                        }
                        ctx.stroke();
                        
                        ctx.strokeStyle = '#ffffff';
                        ctx.lineWidth = b.laserWidth - 6;
                        ctx.beginPath();
                        if (b.isHorizontal) {
                            ctx.moveTo(box.x, b.targetY);
                            ctx.lineTo(box.x + box.w, b.targetY);
                        } else {
                            ctx.moveTo(b.targetX, box.y);
                            ctx.lineTo(b.targetX, box.y + box.h);
                        }
                        ctx.stroke();
                        ctx.restore();
                    }
                }
            });

            ctx.fillStyle = '#9333ea';
            const progress = Game.battle.dodgeTimer / Game.battle.dodgeDuration;
            ctx.fillRect(250, 232, 300 * progress, 4);
        } 
        
        else if (Game.battle.phase === 'menu') {
            ctx.fillStyle = '#ffffff';
            ctx.font = '10px "Press Start 2P"';
            ctx.fillText(Game.battle.message, 270, 280);
            ctx.fillText('* [ Yon tuslari ile sec, Z\'ye bas ]', 270, 320);
        } 
        
        else if (Game.battle.phase === 'act' || Game.battle.phase === 'victory' || Game.battle.phase === 'defeat') {
            ctx.fillStyle = '#ffffff';
            ctx.font = '9px "Press Start 2P"';
            ctx.fillText(Game.battle.message, 270, 290);
        }

        else if (Game.battle.phase === 'item') {
            ctx.fillStyle = '#ffffff';
            ctx.font = '10px "Press Start 2P"';
            ctx.fillText('--- CANTANDAKI ESYALAR ---', 270, 270);
            
            Game.player.inventory.forEach((item, index) => {
                const isSelected = index === Game.battle.menuIndex;
                ctx.fillStyle = isSelected ? '#ffff00' : '#ffffff';
                const prefix = item.equipped ? '[K] ' : ''; // Draw [K] prefix if equipped
                ctx.fillText(`${isSelected ? '♥ ' : '  '}${prefix}${item.name}`, 270, 300 + index * 20);
            });
        }

        else if (Game.battle.phase === 'fight_timing') {
            ctx.strokeStyle = '#33333f';
            ctx.lineWidth = 5;
            ctx.strokeRect(270, 310, 260, 20);
            
            ctx.fillStyle = '#a855f7';
            ctx.fillRect(390, 305, 20, 30);
            
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(400 + Game.battle.fightTimingPos - 3, 300, 6, 40);

            ctx.fillStyle = '#a855f7';
            ctx.font = '9px "Press Start 2P"';
            ctx.fillText('ORTADA HEDEFI BUL VE Z\'YE BAS!', 300, 270);
        }

        const buttons = ['DÖVÜS', 'EYLEM', 'ESYA', 'MERHAMET'];
        const btnColors = ['#ff3333', '#eab308', '#a855f7', '#ec4899'];
        
        buttons.forEach((btn, index) => {
            const bx = 60 + index * 180;
            const by = 420;
            const bw = 140;
            const bh = 40;

            const isSelected = index === Game.battle.menuIndex && Game.battle.phase === 'menu';
            
            ctx.strokeStyle = isSelected ? '#ffff00' : '#4b5563';
            ctx.lineWidth = isSelected ? 3 : 2;
            ctx.strokeRect(bx, by, bw, bh);

            ctx.fillStyle = isSelected ? '#ffff00' : btnColors[index];
            ctx.font = '9px "Press Start 2P"';
            ctx.textAlign = 'center';
            ctx.fillText(btn, bx + bw/2, by + bh/2 + 4);
            ctx.textAlign = 'left';
        });

        // Draw visual damage popups
        if (Game.battle.popups) {
            Game.battle.popups.forEach(p => {
                ctx.fillStyle = p.color;
                ctx.font = '11px "Press Start 2P"';
                ctx.fillText(p.text, p.x - 10, p.y);
            });
        }
    }
};

// ==========================================
// 6. MAIN GAME ENGINE (ROOMS & PROCEDURAL GENERATION)
// ==========================================
const Engine = {
    init() {
        Game.canvas = document.getElementById('gameCanvas');
        Game.ctx = Game.canvas.getContext('2d');
        
        this.bindEvents();
        this.gameLoop();
    },

    bindEvents() {
        window.addEventListener('keydown', e => {
            Game.keys[e.code] = true;
            AudioEngine.init();

            // Trigger menu track on first menu interaction
            if (Game.currentScreen === 'INTRO') {
                AudioEngine.playBGM('menu.mp3');
            }

            if (Game.currentScreen === 'INTRO') {
                if (e.code === 'Enter') {
                    document.getElementById('start-game-btn').click();
                }
            } 
            else if (Game.currentScreen === 'OVERWORLD') {
                if (Game.battle.active) {
                    CombatEngine.handleInput(e.code);
                } else if (Game.dialogue.active) {
                    if (e.code === 'KeyZ' || e.code === 'Enter') {
                        DialogSystem.next();
                    } else if (e.code === 'KeyX') {
                        DialogSystem.cancel();
                    }
                } else {
                    if (e.code === 'KeyH') {
                        AudioEngine.playBeep(330, 0.15, 'triangle');
                        setTimeout(() => AudioEngine.playBeep(660, 0.25, 'triangle'), 80);
                        
                        Game.currentLocation = 'HOUSE';
                        Game.currentRoom = 1;
                        Game.player.x = 400;
                        Game.player.y = 300;
                        
                        this.onRoomEnter(1);
                        DialogSystem.show('SİSTEM', 'Eve ışınlandın!', null, 'none');
                    } else if (e.code === 'KeyB') {
                        // Set player level to 5
                        Game.player.level = 5;
                        Game.player.maxHp = 50;
                        Game.player.hp = Game.player.maxHp;
                        Game.player.xp = 0;
                        AudioEngine.playVictorySound();
                        DialogSystem.show('SİSTEM', 'Kısayol kullanıldı: Seviyeniz 5 yapıldı! Evden çıkınca Mr. Zoktay belirecektir.', null, 'none');
                    } else if (e.code === 'KeyZ' || e.code === 'Enter') {
                        this.triggerInteraction();
                    }
                }
            }
            else if (Game.currentScreen === 'PUZZLE_GAME') {
                if (e.code === 'KeyX') {
                    // Quit puzzle back to room
                    Game.currentScreen = 'OVERWORLD';
                    AudioEngine.playBeep(200, 0.15, 'sawtooth');
                }
            }
            else if (Game.currentScreen === 'UNDERNAIL_VICTORY') {
                if (e.code === 'Enter' || e.code === 'KeyZ') {
                    window.location.reload();
                }
            }
        });

        window.addEventListener('keyup', e => {
            Game.keys[e.code] = false;
        });

        document.getElementById('start-game-btn').addEventListener('click', () => {
            const nameInput = document.getElementById('player-name-input');
            let name = nameInput.value.trim().toUpperCase();
            if (!name) name = 'GOLGE';
            Game.player.name = name;
            
            document.getElementById('hud-player-name').innerText = Game.player.name;
            document.getElementById('intro-screen').classList.remove('active');
            document.getElementById('game-screen').classList.add('active');
            
            Game.currentScreen = 'OVERWORLD';
            AudioEngine.playBGM('maintheme.mp3'); // Play overworld BGM
            
            DialogSystem.show('REHBER GOLGE', `Selam ${Game.player.name}. Bu kadim derinliklerde hayatta kalmak icin mermilerden kacmayı ogrenmelisin!`, () => {
                CombatEngine.start({
                    id: 'tutorial',
                    name: 'Karanlık Eğitim İllüzyonu',
                    hp: 30,
                    maxHp: 30,
                    reward: 20,
                    sprite: 'dummy'
                });
            }, 'nail');
        });

        document.getElementById('exit-shop-btn').addEventListener('click', () => {
            document.getElementById('shop-screen').classList.remove('active');
            document.getElementById('game-screen').classList.add('active');
            Game.currentScreen = 'OVERWORLD';
            AudioEngine.playBeep(330, 0.15);
            AudioEngine.playBGM('maintheme.mp3'); // Play overworld BGM on shop exit
        });

        // Mobile DPad bindings
        const registerTouch = (btnId, keyName) => {
            const btn = document.getElementById(btnId);
            if (!btn) return;
            btn.addEventListener('pointerdown', (e) => {
                e.preventDefault(); Game.keys[keyName] = true; AudioEngine.init();
            });
            btn.addEventListener('pointerup', (e) => {
                e.preventDefault(); Game.keys[keyName] = false;
            });
        };
        registerTouch('btn-up', 'ArrowUp');
        registerTouch('btn-down', 'ArrowDown');
        registerTouch('btn-left', 'ArrowLeft');
        registerTouch('btn-right', 'ArrowRight');

        document.getElementById('btn-z').addEventListener('pointerdown', (e) => {
            e.preventDefault(); AudioEngine.init();
            window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyZ' }));
        });
        document.getElementById('btn-x').addEventListener('pointerdown', (e) => {
            e.preventDefault(); AudioEngine.init();
            window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyX' }));
        });

        // Touch/Click canvas to advance dialogues or hit target in fights
        Game.canvas.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            AudioEngine.init();
            if (Game.currentScreen === 'INTRO') {
                AudioEngine.playBGM('menu.mp3');
            }
            if (Game.currentScreen === 'OVERWORLD') {
                if (Game.battle.active || Game.dialogue.active) {
                    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyZ' }));
                }
            }
        });
        
        // Input interaction BGM initialization
        document.getElementById('player-name-input').addEventListener('focus', () => {
            AudioEngine.playBGM('menu.mp3');
        });
    },

    // Triggered when entering any room of the 2-story 5-room house
    onRoomEnter(roomIndex) {
        Game.currentRoom = roomIndex;
        Game.activeHousePortal = null; // reset portal

        // Roll probability gates
        // 4.89% chance for Battle Portal
        // 7.90% chance for Puzzle Portal
        const roll = Math.random() * 100;
        
        if (roll < 4.89) {
            // Spawn Battle Portal at random coordinate
            Game.activeHousePortal = {
                x: 200 + Math.random() * 400,
                y: 180 + Math.random() * 220,
                type: 'combat'
            };
        } else if (roll < 4.89 + 7.90) {
            // Spawn Puzzle Portal
            Game.activeHousePortal = {
                x: 200 + Math.random() * 400,
                y: 180 + Math.random() * 220,
                type: 'puzzle'
            };
        }

        // Specific room setups with new interactable entities
        Game.entities = [];
        if (roomIndex === 1) {
            Game.entities.push({
                id: 'vase_room1',
                x: 150,
                y: 170,
                size: 14,
                sprite: 'vase',
                interaction: () => {
                    DialogSystem.show('VAZO', "7/B Salonu'nun geleneksel toprak vazosu. İçinde tozdan başka bir şey yok.", null, 'none');
                }
            });
        } else if (roomIndex === 2) {
            Game.entities.push({
                id: 'painting_room2',
                x: 400,
                y: 150,
                size: 18,
                sprite: 'painting',
                interaction: () => {
                    DialogSystem.show('TABLO', "Kadim zamanlardan kalma bir tablo. Gölgelerle savaşan ilk hocalardan birini tasvir ediyor.", null, 'none');
                }
            });
        } else if (roomIndex === 3) {
            Game.entities.push({
                id: 'sword_room3',
                x: 150,
                y: 160,
                size: 16,
                sprite: 'broken_sword',
                interaction: () => {
                    DialogSystem.show('KILIC', "Kırılmış bir Kara Çelik Kılıç. Kabzasında 'Zafer' ismi kazınmış.", null, 'none');
                }
            });
        } else if (roomIndex === 4) {
            Game.entities.push({
                id: 'painting_room4',
                x: 600,
                y: 150,
                size: 18,
                sprite: 'painting',
                interaction: () => {
                    DialogSystem.show('TABLO', "Tozlu bir kraliyet tablosu. Tablodaki gözler sanki hareketlerinizi izliyor...", null, 'none');
                }
            });
        } else if (roomIndex === 5) {
            // Spawn guardian Hoca in bedroom
            Game.entities.push({
                id: 'hoca',
                x: 400,
                y: 200,
                size: 26,
                sprite: 'guardian',
                interaction: () => {
                    DialogSystem.show('KORUYUCU HOCA', 'Evimiz "7/B SALONU"ndasın yavrum. Buradaki odalara girip cıktığında beliren gizemli rıhtımlardan hangi mini oyuna gireceğini asla bilemezsin! Dikkatli ol.', null, 'hoca');
                }
            });
        }
    },

    // Warps overworld scroll transitions between connected pages
    onOverworldPageChange(pageIndex) {
        Game.overworldPage = pageIndex;
        Game.entities = [];

        // Clear active house portal when outside
        Game.activeHousePortal = null;

        // Roll dynamic procedural spawns:
        // Slimes / Monsters: 25% chance
        // Shop / Market Table: 5% chance
        // Boss: 0.5% chance
        const monsterRoll = Math.random();
        const shopRoll = Math.random();
        const bossRoll = Math.random();

        // 1. Spawning Wandering Monsters - Size enlarged to 26
        if (monsterRoll < 0.25) {
            Game.entities.push({
                id: 'challenger_1',
                x: 300,
                y: 240,
                size: 26,
                sprite: 'slime',
                vx: 0.8, vy: 0, walkTimer: 0,
                interaction: () => {
                    DialogSystem.show('Ar3l', 'Hyyyyaaaaaaaa yabancı duello ister misin? (Z: Evet / X: Hayır)', () => {
                        this.askForChallenge('challenger_1', 'Ar3l', 80, 'slime', 'ar3l');
                    }, 'arel');
                }
            });
            if (Math.random() < 0.5) {
                Game.entities.push({
                    id: 'challenger_2',
                    x: 550,
                    y: 300,
                    size: 26,
                    sprite: 'crawler',
                    vx: 0, vy: 0.8, walkTimer: 0,
                    interaction: () => {
                        DialogSystem.show('Kayratıll', 'Ben çok kaşındım. Gel beni kaşı! (Z: Evet / X: Hayır)', () => {
                            this.askForChallenge('challenger_2', 'Kayratıll', 100, 'crawler', 'kayra');
                        }, 'kayra');
                    }
                });
            }
        }

        // 2. Spawning dynamic Shop (increased by 3.8% -> 8.8%)
        if (shopRoll < 0.088) {
            Game.entities.push({
                id: 'shopkeeper',
                x: 400,
                y: 160,
                size: 26,
                sprite: 'shopkeeper',
                interaction: () => {
                    this.openShop();
                }
            });
        }

        // 3. Spawning Bosses (Level-dependent triggers at page 0) - Sir Mustafa (300 HP), Mr. Zoktay (600 HP)
        if (pageIndex === 0) {
            let bossActive = false;
            if (Game.boss2Spawned && !Game.boss2Defeated) {
                bossActive = true;
                Game.entities.push({
                    id: 'boss2',
                    name: 'Mr. Zoktay',
                    x: 400,
                    y: 260,
                    size: 28,
                    sprite: 'boss2',
                    interaction: () => {
                        DialogSystem.show('Mr. Zoktay', 'Sen manifest sever misin?', () => {
                            DialogSystem.show('Mr. Zoktay', 'Zoktayın Gücü Adına GÜÇ BENDE ARTIK!!!', () => {
                                CombatEngine.start({
                                    id: 'boss2',
                                    name: 'Mr. Zoktay',
                                    hp: 500,
                                    maxHp: 500,
                                    reward: 350,
                                    sprite: 'boss2'
                                });
                            }, 'boss2');
                        }, 'boss2');
                    }
                });
            } else if (Game.boss1Spawned && !Game.boss1Defeated) {
                bossActive = true;
                Game.entities.push({
                    id: 'boss1',
                    name: 'Sir Mustafa',
                    x: 400,
                    y: 260,
                    size: 28,
                    sprite: 'boss1',
                    interaction: () => {
                        DialogSystem.show('Sir Mustafa', 'Seni buralarda yeni görüyorum yabancı sen kimsin?', () => {
                            DialogSystem.show('Sir Mustafa', 'Demek öyle ha sen haddiini aşıyosun bre kafir', () => {
                                DialogSystem.show('Sir Mustafa', 'Tez indirin  bunun kellesini!', () => {
                                    CombatEngine.start({
                                        id: 'boss1',
                                        name: 'Sir Mustafa',
                                        hp: 375, // Buffed health from 300 to 375
                                        maxHp: 375,
                                        reward: 150,
                                        sprite: 'boss1'
                                    });
                                }, 'boss1');
                            }, 'boss1');
                        }, 'boss1');
                    }
                });
            }

            // Spawn guaranteed shopkeeper if a boss is active on this page
            if (bossActive) {
                Game.entities.push({
                    id: 'shopkeeper',
                    x: 280,
                    y: 260,
                    size: 26,
                    sprite: 'shopkeeper',
                    interaction: () => {
                        this.openShop();
                    }
                });
            }
        }

        // Spawn page-specific outside interactable objects
        if (pageIndex === 0) {
            Game.entities.push({
                id: 'sword_outside0',
                x: 200,
                y: 150,
                size: 16,
                sprite: 'broken_sword',
                interaction: () => {
                    DialogSystem.show('TAS SAPLI KILIC', "Taşa saplanmış kırık bir kılıç. Üzerindeki rünler sönmüş.", null, 'none');
                }
            });
        } else if (pageIndex === 1) {
            Game.entities.push({
                id: 'vase_outside1',
                x: 500,
                y: 150,
                size: 14,
                sprite: 'vase',
                interaction: () => {
                    DialogSystem.show('ANTIK VAZO', "Ormanın ortasında terk edilmiş antik bir vazo. Hafifçe uğulduyor...", null, 'none');
                }
            });
        } else if (pageIndex === 2) {
            Game.entities.push({
                id: 'painting_outside2',
                x: 350,
                y: 150,
                size: 18,
                sprite: 'painting',
                interaction: () => {
                    DialogSystem.show('AGACTAKI TABLO', "Kurumuş bir ağaca asılmış gizemli bir tablo. Tabloda girdap gibi dönen mor bir portal resmi var.", null, 'none');
                }
            });
        }
    },

    askForChallenge(entityId, bossName, hpVal, spriteType, uniqueBossId) {
        if (Game.player.kirkel < 15) {
            DialogSystem.show('SİSTEM', 'Yetersiz Kirkel! Canlılarla iddialasmak icin en az 15 Kirkel gerekiyor.', null, 'none');
            return;
        }

        Game.battle.triggerEntityId = entityId; // Store the ID of the triggering overworld entity
        CombatEngine.start({
            id: uniqueBossId,
            name: bossName,
            hp: hpVal,
            maxHp: hpVal,
            reward: 15,
            sprite: spriteType
        }, true);
    },

    openShop() {
        Game.currentScreen = 'SHOP';
        document.getElementById('game-screen').classList.remove('active');
        document.getElementById('shop-screen').classList.add('active');
        AudioEngine.playBGM('dukkan.mp3'); // Play shop music
        this.renderShopItems();
    },

    renderShopItems() {
        document.getElementById('shop-kirkel-amount').innerText = Game.player.kirkel;
        const container = document.getElementById('shop-items-container');
        container.innerHTML = '';

        Game.shopItems.forEach(item => {
            const row = document.createElement('div');
            row.className = 'shop-item-row';
            row.innerHTML = `
                <div class="shop-item-info">
                    <span class="shop-item-name">${item.name}</span>
                    <span class="shop-item-desc">${item.desc}</span>
                </div>
                <div class="shop-item-price-tag">
                    <span>${item.price} Kirkel</span>
                </div>
            `;
            row.addEventListener('click', () => {
                this.buyShopItem(item);
            });
            container.appendChild(row);
        });
    },

    buyShopItem(item) {
        if (Game.player.kirkel >= item.price) {
            Game.player.kirkel -= item.price;
            Game.player.inventory.push(item);
            AudioEngine.playHealSound();
            document.getElementById('shopkeeper-bubble').innerText = `'${item.name}' satın aldın. Yolculuğunda yardımcı olacaktır!`;
            this.renderShopItems();
        } else {
            AudioEngine.playBeep(90, 0.25, 'sawtooth');
            document.getElementById('shopkeeper-bubble').innerText = "Cüzdanın bombos! Daha fazla Kirkel toplayıp gel.";
        }
    },

    triggerInteraction() {
        // First check active house portal trigger proximity
        if (Game.currentLocation === 'HOUSE' && Game.activeHousePortal) {
            const dist = Math.hypot(Game.activeHousePortal.x - Game.player.x, Game.activeHousePortal.y - Game.player.y);
            if (dist < Game.player.size + 15) {
                this.enterMysteryPortal();
                return;
            }
        }

        // Check standard entity interactions
        const px = Game.player.x;
        const py = Game.player.y;
        const radius = Game.player.size + 16;

        for (const e of Game.entities) {
            const dist = Math.hypot(e.x - px, e.y - py);
            if (dist < radius) {
                e.interaction();
                return;
            }
        }
    },

    enterMysteryPortal() {
        const portal = Game.activeHousePortal;
        if (!portal) return;

        AudioEngine.playBeep(200, 0.45, 'triangle');
        Game.activeHousePortal = null; // consume portal

        // User requested mystery! Player doesn't know which type they are entering!
        if (portal.type === 'combat') {
            // Warp to a quick dodge fight
            const isMedium = Math.random() < 0.4;
            CombatEngine.start({
                id: isMedium ? 'portal_combat_medium' : 'portal_combat_easy',
                name: isMedium ? 'Karanlık Bekçi İllüzyonu' : 'Zayıf Gölge İllüzyonu',
                hp: isMedium ? 60 : 30,
                maxHp: isMedium ? 60 : 30,
                reward: 20,
                sprite: isMedium ? 'bekci' : 'golge'
            });
        } 
        else if (portal.type === 'puzzle') {
            // Warp to the new harder maze physical puzzle screen!
            this.startHardPuzzle();
        }
    },

    startHardPuzzle() {
        Game.currentScreen = 'PUZZLE_GAME';
        
        // Reset grid puzzle
        Game.puzzleRoom.playerCol = 1;
        Game.puzzleRoom.playerRow = 3;
        Game.puzzleRoom.solved = false;
        Game.puzzleRoom.boxes = [
            { col: 4, row: 2, color: '#ef4444' }, // Red
            { col: 5, row: 3, color: '#3b82f6' }, // Blue
            { col: 4, row: 4, color: '#10b981' }, // Green
            { col: 5, row: 5, color: '#eab308' }  // Yellow
        ];
        
        AudioEngine.playBeep(440, 0.15, 'triangle');
    },

    syncHUD() {
        document.getElementById('hud-kirkel-count').innerText = Game.player.kirkel;
        document.getElementById('hud-hp-text').innerText = `${Game.player.hp} / ${Game.player.maxHp}`;
        document.getElementById('hud-hp-bar').style.width = `${(Game.player.hp / Game.player.maxHp) * 100}%`;

        const levelElement = document.getElementById('hud-player-level');
        if (levelElement) {
            levelElement.innerText = `LV ${Game.player.level}`;
        }
        const xpBar = document.getElementById('hud-xp-bar');
        if (xpBar) {
            const xpNeeded = Game.getXpNeeded(Game.player.level);
            xpBar.style.width = `${(Game.player.xp / xpNeeded) * 100}%`;
        }
    },

    update(time) {
        // Always sync HUD stats
        this.syncHUD();

        // House healing & Level Boss visit house check
        if (Game.currentLocation === 'HOUSE' && !Game.battle.active && Game.currentScreen === 'OVERWORLD') {
            if (Game.player.level >= 5) {
                Game.hasVisitedHouseSinceLevel5 = true;
            }
            if (Game.player.level >= 3) {
                Game.hasVisitedHouseSinceLevel3 = true;
            }

            const now = Date.now();
            if (!Game.lastHouseHealTime) Game.lastHouseHealTime = now;
            if (now - Game.lastHouseHealTime >= 3000) {
                if (Game.player.hp < Game.player.maxHp) {
                    Game.player.hp = Math.min(Game.player.maxHp, Game.player.hp + 1);
                }
                Game.lastHouseHealTime = now;
            }
        } else {
            Game.lastHouseHealTime = null;
        }

        DialogSystem.update();

        // Screen routing
        if (Game.currentScreen === 'PUZZLE_GAME') {
            this.updateHardPuzzle();
            return;
        }

        if (Game.battle.active) {
            CombatEngine.update(time);
            return;
        }

        if (Game.dialogue.active || Game.currentScreen !== 'OVERWORLD') return;

        // 1. MOVEMENT INPUTS
        let dx = 0, dy = 0;
        if (Game.keys['ArrowUp'] || Game.keys['KeyW']) dy = -1;
        if (Game.keys['ArrowDown'] || Game.keys['KeyS']) dy = 1;
        if (Game.keys['ArrowLeft'] || Game.keys['KeyA']) dx = -1;
        if (Game.keys['ArrowRight'] || Game.keys['KeyD']) dx = 1;

        if (dx !== 0 && dy !== 0) {
            dx *= 0.7071;
            dy *= 0.7071;
        }

        const prevX = Game.player.x;
        const prevY = Game.player.y;

        Game.player.x += dx * Game.player.speed;
        Game.player.y += dy * Game.player.speed;

        // 2. BOUNDS AND INTER-ROOM HOUSE TRANSITIONS
        const pad = Game.player.size/2 + 5;
        if (Game.player.x < pad) Game.player.x = pad;
        if (Game.player.x > 800 - pad) Game.player.x = 800 - pad;
        if (Game.player.y < pad) Game.player.y = pad;
        if (Game.player.y > 480 - pad) Game.player.y = 480 - pad;

        if (Game.currentLocation === 'HOUSE') {
            // Boundary limitations in house rooms:
            // Back walls blocking top: y < 140
            if (Game.player.y < 140) Game.player.y = 140;

            // ROOM 1: Giriş Salonu (1. Kat)
            if (Game.currentRoom === 1) {
                // Exit left edge -> warps to Room 3 (Dining Room)
                if (Game.player.x <= pad) {
                    Game.player.x = 760;
                    this.onRoomEnter(3);
                }
                // Exit right edge -> warps to Room 2 (Library)
                if (Game.player.x >= 800 - pad) {
                    Game.player.x = 40;
                    this.onRoomEnter(2);
                }
                // Staircase upwards warp box: centered at x: 400, y: 150
                const stairDist = Math.hypot(Game.player.x - 400, Game.player.y - 145);
                if (stairDist < 20) {
                    Game.player.x = 400;
                    Game.player.y = 380;
                    this.onRoomEnter(4);
                }
                // Exit bottom portal to OUTSIDE OVERWORLD: centered at x: 400, y: 460
                if (Game.player.y >= 450) {
                    Game.currentLocation = 'OUTSIDE';
                    Game.player.x = 400;
                    Game.player.y = 180;
                    
                    // Trigger boss spawns if criteria are met
                    if (Game.player.level >= 5 && Game.hasVisitedHouseSinceLevel5 && !Game.boss2Defeated && !Game.boss2Spawned) {
                        Game.boss2Spawned = true;
                    } else if (Game.player.level >= 3 && Game.hasVisitedHouseSinceLevel3 && !Game.boss1Defeated && !Game.boss1Spawned) {
                        Game.boss1Spawned = true;
                    }
                    
                    this.onOverworldPageChange(0);
                }
            }

            // ROOM 2: Kütüphane
            else if (Game.currentRoom === 2) {
                // Exit left edge -> warps to Room 1
                if (Game.player.x <= pad) {
                    Game.player.x = 750;
                    this.onRoomEnter(1);
                }
            }

            // ROOM 3: Yemek Odası
            else if (Game.currentRoom === 3) {
                // Exit right edge -> warps to Room 1
                if (Game.player.x >= 800 - pad) {
                    Game.player.x = 50;
                    this.onRoomEnter(1);
                }
            }

            // ROOM 4: Üst Kat Koridor (2. Kat)
            else if (Game.currentRoom === 4) {
                // Exit left edge -> warps to Room 5 (Bedroom)
                if (Game.player.x <= pad) {
                    Game.player.x = 750;
                    this.onRoomEnter(5);
                }
                // Staircase downwards warp box: centered at x: 400, y: 400
                if (Game.player.y >= 415) {
                    Game.player.x = 400;
                    Game.player.y = 180;
                    this.onRoomEnter(1);
                }
            }

            // ROOM 5: Yatak Odası
            else if (Game.currentRoom === 5) {
                // Exit right edge -> warps to Room 4
                if (Game.player.x >= 800 - pad) {
                    Game.player.x = 50;
                    this.onRoomEnter(4);
                }
            }
        } 
        
        else if (Game.currentLocation === 'OUTSIDE') {
            // Connective screen pages endless scrolling overworld!
            // Exiting right edge transitions page + 1
            if (Game.player.x >= 800 - pad) {
                Game.player.x = 40;
                this.onOverworldPageChange(Game.overworldPage + 1);
            }
            // Exiting left edge transitions page - 1, or goes back to house entrance if page 0!
            if (Game.player.x <= pad) {
                if (Game.overworldPage === 0) {
                    Game.currentLocation = 'HOUSE';
                    Game.player.x = 400;
                    Game.player.y = 420;
                    this.onRoomEnter(1);
                } else {
                    Game.player.x = 760;
                    this.onOverworldPageChange(Game.overworldPage - 1);
                }
            }
        }

        // 3. WANDERING MONSTERS
        Game.entities.forEach(e => {
            if (e.sprite === 'slime' || e.sprite === 'crawler') {
                e.walkTimer++;
                if (e.walkTimer > 50) {
                    e.walkTimer = 0;
                    if (Math.random() < 0.35) {
                        e.vx = (Math.random() > 0.5 ? 1 : -1) * 0.9;
                        e.vy = (Math.random() > 0.5 ? 1 : -1) * 0.9;
                    }
                }
                e.x += e.vx;
                e.y += e.vy;

                if (e.x < 100 || e.x > 700) e.vx *= -1;
                if (e.y < 150 || e.y > 420) e.vy *= -1;
            }
        });

        // 4. STAT HUD SYNCING
        this.syncHUD();
    },

    // Grid Physical Sokoban-style Puzzle logic inside dynamic screen
    updateHardPuzzle() {
        const b = Game.puzzleRoom;
        const now = Date.now();
        const moveDelay = 180; // ms between moves when holding keys
        
        let dx = 0, dy = 0;
        if (Game.keys['ArrowUp'] || Game.keys['KeyW']) dy = -1;
        else if (Game.keys['ArrowDown'] || Game.keys['KeyS']) dy = 1;
        else if (Game.keys['ArrowLeft'] || Game.keys['KeyA']) dx = -1;
        else if (Game.keys['ArrowRight'] || Game.keys['KeyD']) dx = 1;

        if ((dx !== 0 || dy !== 0) && now - b.lastMoveTime > moveDelay) {
            b.lastMoveTime = now;
            
            const nextCol = b.playerCol + dx;
            const nextRow = b.playerRow + dy;
            
            // Check boundaries
            if (nextCol >= 0 && nextCol < 15 && nextRow >= 0 && nextRow < 8) {
                // Check wall
                const isWall = b.walls.some(w => w.col === nextCol && w.row === nextRow);
                if (!isWall) {
                    // Check box
                    const boxIndex = b.boxes.findIndex(bx => bx.col === nextCol && bx.row === nextRow);
                    if (boxIndex !== -1) {
                        const boxNextCol = nextCol + dx;
                        const boxNextRow = nextRow + dy;
                        
                        // Check boundaries behind box
                        if (boxNextCol >= 0 && boxNextCol < 15 && boxNextRow >= 0 && boxNextRow < 8) {
                            // Check wall behind box
                            const isBoxWall = b.walls.some(w => w.col === boxNextCol && w.row === boxNextRow);
                            // Check other boxes behind box
                            const isBoxBox = b.boxes.some(bx => bx.col === boxNextCol && bx.row === boxNextRow);
                            
                            if (!isBoxWall && !isBoxBox) {
                                // Move box and player
                                b.boxes[boxIndex].col = boxNextCol;
                                b.boxes[boxIndex].row = boxNextRow;
                                b.playerCol = nextCol;
                                b.playerRow = nextRow;
                                AudioEngine.playBeep(260, 0.05, 'triangle');
                            }
                        }
                    } else {
                        // Move player only
                        b.playerCol = nextCol;
                        b.playerRow = nextRow;
                        AudioEngine.playBeep(330, 0.04, 'sine');
                    }
                }
            }

            // Check Reset Cell trigger
            if (b.playerCol === b.resetCell.col && b.playerRow === b.resetCell.row) {
                b.playerCol = 1;
                b.playerRow = 3;
                b.solved = false;
                b.boxes = [
                    { col: 4, row: 2, color: '#ef4444' }, // Red
                    { col: 5, row: 3, color: '#3b82f6' }, // Blue
                    { col: 4, row: 4, color: '#10b981' }, // Green
                    { col: 5, row: 5, color: '#eab308' }  // Yellow
                ];
                AudioEngine.playBeep(200, 0.15, 'sawtooth');
            }

            // Check solved condition
            let allMatched = true;
            b.targets.forEach(t => {
                const match = b.boxes.find(bx => bx.col === t.col && bx.row === t.row && bx.color === t.color);
                if (!match) allMatched = false;
            });

            if (allMatched && !b.solved) {
                b.solved = true;
                AudioEngine.playVictorySound();
                Game.player.kirkel += 20;

                const prevLevel = Game.player.level;
                Game.gainXP(15); // award 15 XP
                const leveledUp = Game.player.level > prevLevel;

                let msg = 'Harika! Tum renkli kutuları eslesen hedeflere yerlestirdin. +20 Kirkel ve +15 XP kazandin!';
                if (leveledUp) {
                    msg += `\n\nGÜÇLENDİN! LV ${Game.player.level} oldun! Maksimum HP arttı ve tamamen iyileştin.`;
                }

                DialogSystem.show('BULMACA', msg, () => {
                    Game.currentScreen = 'OVERWORLD';
                }, 'none');
            }
        }
    },

    draw() {
        const ctx = Game.ctx;
        if (!ctx) return;

        // VICTORY SCREEN REDIRECT
        if (Game.currentScreen === 'UNDERNAIL_VICTORY') {
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, 800, 480);
            
            const time = Date.now();
            const color = `hsl(${(time / 5) % 360}, 100%, 50%)`;
            ctx.fillStyle = color;
            ctx.font = '40px "Press Start 2P"';
            ctx.textAlign = 'center';
            ctx.fillText('UNDERNAIL', 400, 240);
            
            ctx.fillStyle = '#ffffff';
            ctx.font = '12px "Press Start 2P"';
            ctx.fillText('TEBRİKLER! OYUNU KAZANDINIZ!', 400, 320);
            ctx.font = '8px "Press Start 2P"';
            ctx.fillText('[ ENTER\'A BASARAK YENİDEN BAŞLA ]', 400, 380);
            ctx.textAlign = 'left';
            return;
        }

        // COMBAT REDIRECT
        if (Game.battle.active) {
            CombatEngine.draw(ctx);
            return;
        }

        // PUZZLE GAME REDIRECT
        if (Game.currentScreen === 'PUZZLE_GAME') {
            this.drawHardPuzzle(ctx);
            return;
        }

        ctx.clearRect(0, 0, 800, 480);

        // 1. DRAW CURRENT MAP
        if (Game.currentLocation === 'HOUSE') {
            // Dark stone-brick floor design
            ctx.fillStyle = '#080512';
            ctx.fillRect(0, 0, 800, 480);

            // Wood panels and borders
            ctx.fillStyle = '#030208';
            ctx.fillRect(0, 0, 800, 140);
            ctx.fillStyle = '#3a205a';
            ctx.fillRect(0, 134, 800, 6);

            // Print current room names
            ctx.fillStyle = '#9333ea';
            ctx.font = '10px "Press Start 2P"';
            
            let roomName = '';
            if (Game.currentRoom === 1) roomName = 'GIRISTEKI BÜYÜK SALON';
            else if (Game.currentRoom === 2) roomName = 'KADIM KÜTÜPHANE';
            else if (Game.currentRoom === 3) roomName = 'GÖLGELİ YEMEK ODASI';
            else if (Game.currentRoom === 4) roomName = 'ÜST KAT ANA KORİDOR';
            else if (Game.currentRoom === 5) roomName = 'MUHAFIZ YATAK ODASI';
            
            ctx.fillText(`7/B SALONU - ${roomName}`, 40, 60);

            // Draw staircases, door frames, furniture depending on active Room
            if (Game.currentRoom === 1) {
                // Large double door to outside
                ctx.fillStyle = '#11052c';
                ctx.fillRect(360, 420, 80, 60);
                ctx.strokeStyle = '#9333ea';
                ctx.lineWidth = 3;
                ctx.strokeRect(360, 420, 80, 60);
                
                ctx.fillStyle = '#ffffff';
                ctx.font = '8px "Press Start 2P"';
                ctx.fillText('DIS DÜNYA', 363, 410);

                // Staircase to floor 2 (archway upwards)
                ctx.fillStyle = '#1e1a3a';
                ctx.fillRect(370, 110, 60, 30);
                ctx.fillStyle = '#d4af37';
                for (let i = 0; i < 4; i++) {
                    ctx.fillRect(370, 110 + i * 8, 60, 3);
                }
                ctx.fillStyle = '#d4af37';
                ctx.fillText('UST KAT (▲)', 360, 100);

                // Side doors labels
                ctx.fillStyle = '#9333ea';
                ctx.fillText('◄ YEMEK ODASI', 30, 290);
                ctx.fillText('KUTUPHANE ►', 650, 290);
            } 
            
            else if (Game.currentRoom === 2) {
                // Library bookshelves on walls
                ctx.fillStyle = '#2b1b54';
                for (let x = 80; x < 720; x += 120) {
                    ctx.fillRect(x, 100, 100, 34);
                    ctx.fillStyle = '#ffff00';
                    ctx.fillRect(x + 10, 110, 8, 15);
                    ctx.fillStyle = '#ff3333';
                    ctx.fillRect(x + 25, 115, 8, 10);
                    ctx.fillStyle = '#00ffff';
                    ctx.fillRect(x + 40, 108, 6, 17);
                    ctx.fillStyle = '#2b1b54';
                }
                ctx.fillStyle = '#9333ea';
                ctx.fillText('◄ ANA SALON', 30, 290);
            }

            else if (Game.currentRoom === 3) {
                // Dining Room: long central dining table
                ctx.fillStyle = '#1a0f30';
                ctx.fillRect(200, 220, 400, 80);
                ctx.strokeStyle = '#3a205a';
                ctx.strokeRect(200, 220, 400, 80);
                
                // Silver cups on table
                ctx.fillStyle = '#cccccc';
                ctx.fillRect(300, 235, 10, 15);
                ctx.fillRect(400, 235, 10, 15);
                ctx.fillRect(500, 235, 10, 15);

                ctx.fillStyle = '#9333ea';
                ctx.fillText('ANA SALON ►', 650, 290);
            }

            else if (Game.currentRoom === 4) {
                // Hallway: Stairs down at bottom
                ctx.fillStyle = '#1e1a3a';
                ctx.fillRect(370, 420, 60, 60);
                ctx.fillStyle = '#d4af37';
                for (let i = 0; i < 4; i++) {
                    ctx.fillRect(370, 420 + i * 8, 60, 3);
                }
                ctx.fillStyle = '#9333ea';
                ctx.fillText('ALT KAT (▼)', 360, 410);

                ctx.fillText('◄ YATAK ODASI', 30, 290);
            }

            else if (Game.currentRoom === 5) {
                // Cozy Guardian bedroom: large bed in corner
                ctx.fillStyle = '#581c87'; // bed sheets
                ctx.fillRect(100, 150, 80, 80);
                ctx.fillStyle = '#ffffff'; // pillow
                ctx.fillRect(100, 150, 80, 20);

                ctx.fillStyle = '#9333ea';
                ctx.fillText('KORIDOR ►', 670, 290);
            }

            // Draw active house portals (mystery rifts!)
            if (Game.activeHousePortal) {
                Sprites.drawPortal(ctx, Game.activeHousePortal.x, Game.activeHousePortal.y, Date.now());
                
                ctx.fillStyle = '#ffff00';
                ctx.font = '8px "Press Start 2P"';
                ctx.fillText('PORTALA GIR (Z)', Game.activeHousePortal.x - 65, Game.activeHousePortal.y - 35);
            }
        } 
        
        else if (Game.currentLocation === 'OUTSIDE') {
            // Outside Dark Overworld Forest layout
            ctx.fillStyle = '#05030a';
            ctx.fillRect(0, 0, 800, 480);

            // Purple forest paths
            ctx.fillStyle = '#100c25';
            ctx.fillRect(0, 180, 800, 180);

            // Fences
            ctx.strokeStyle = '#2e1065';
            ctx.lineWidth = 12;
            ctx.strokeRect(6, 6, 788, 468);

            ctx.fillStyle = '#a855f7';
            ctx.font = '9px "Press Start 2P"';
            ctx.fillText('DIS DUNYA - ODALAR', 30, 40);
            ctx.fillText('[ Evine donmek icin en sola (Gecit 0) yuru ]', 30, 65);
        }

        // 2. DRAW OVERWORLD CHARACTERS / INTERACTIVES
        Game.entities.forEach(e => {
            if (e.sprite === 'guardian') {
                Sprites.drawGuardian(ctx, e.x, e.y);
            } else if (e.sprite === 'shopkeeper') {
                Sprites.drawShopkeeper(ctx, e.x, e.y);
                // Counter table overlay
                ctx.fillStyle = '#1e1a3a';
                ctx.fillRect(e.x - 40, e.y + 15, 80, 20);
                ctx.strokeStyle = '#4c1d95';
                ctx.strokeRect(e.x - 40, e.y + 15, 80, 20);
            } else if (e.sprite === 'boss1') {
                if (Images.mustafa.complete) {
                    ctx.drawImage(Images.mustafa, e.x - e.size * 1.6, e.y - e.size * 1.6, e.size * 3.2, e.size * 3.2);
                } else {
                    Sprites.drawBoss1(ctx, e.x, e.y, Date.now());
                }
            } else if (e.sprite === 'boss2') {
                if (Images.oktay.complete) {
                    ctx.drawImage(Images.oktay, e.x - e.size * 1.8, e.y - e.size * 1.8, e.size * 3.6, e.size * 3.6);
                } else {
                    Sprites.drawBoss2(ctx, e.x, e.y, Date.now());
                }
            } else if (e.sprite === 'slime') {
                Sprites.drawChallenger(ctx, e.x, e.y, e.size, 'slime');
            } else if (e.sprite === 'crawler') {
                Sprites.drawChallenger(ctx, e.x, e.y, e.size, 'crawler');
            } else if (e.sprite === 'painting') {
                // Draw a framed picture
                ctx.fillStyle = '#451a03'; // Brown frame
                ctx.fillRect(e.x - 20, e.y - 25, 40, 35);
                ctx.fillStyle = '#1e1b4b'; // Dark blue canvas
                ctx.fillRect(e.x - 16, e.y - 21, 32, 27);
                // Golden sun/star details
                ctx.fillStyle = '#fbbf24';
                ctx.fillRect(e.x - 4, e.y - 12, 8, 8);
            } else if (e.sprite === 'broken_sword') {
                // Draw a steel sword stuck in a stone base
                ctx.fillStyle = '#4b5563'; // Stone
                ctx.fillRect(e.x - 12, e.y + 10, 24, 8);
                ctx.fillStyle = '#9ca3af'; // Steel blade
                ctx.fillRect(e.x - 3, e.y - 15, 6, 25);
                // Hilt
                ctx.fillStyle = '#d4af37'; // Gold hilt
                ctx.fillRect(e.x - 8, e.y - 15, 16, 4);
                ctx.fillStyle = '#9ca3af';
                ctx.fillRect(e.x - 2, e.y - 20, 4, 5);
            } else if (e.sprite === 'vase') {
                // Draw a pixel vase
                ctx.fillStyle = '#d97706'; // Terracotta clay
                ctx.fillRect(e.x - 10, e.y - 15, 20, 25);
                ctx.fillRect(e.x - 14, e.y - 8, 28, 15);
                ctx.fillStyle = '#b45309'; // Shade
                ctx.fillRect(e.x - 12, e.y - 8, 4, 15);
                ctx.fillStyle = '#f59e0b'; // Highlight
                ctx.fillRect(e.x + 8, e.y - 8, 4, 15);
            }
        });

        // 3. DRAW PLAYER CHAR (zafer aygün.png)
        if (Images.player.complete) {
            ctx.drawImage(Images.player, Game.player.x - Game.player.size, Game.player.y - Game.player.size, Game.player.size * 2, Game.player.size * 2);
        } else {
            Sprites.drawHeart(ctx, Game.player.x, Game.player.y, Game.player.size);
        }
    },

    // Draw the specialized harder dungeon maze puzzle screen (Grid-based Sokoban)
    drawHardPuzzle(ctx) {
        ctx.fillStyle = '#05040d';
        ctx.fillRect(0, 0, 800, 480);

        // Draw outer thick maze frame: [100, 100, 600, 320]
        ctx.strokeStyle = '#9333ea';
        ctx.lineWidth = 6;
        ctx.strokeRect(100, 100, 600, 320);

        // Print header & HUD details
        ctx.fillStyle = '#ffffff';
        ctx.font = '10px "Press Start 2P"';
        ctx.fillText('PORTAL BULMACA ODASI - RENK ESLENIK GRIDI', 120, 60);
        ctx.fillStyle = '#6b7280';
        ctx.font = '8px "Press Start 2P"';
        ctx.fillText('[ Yon Tuslari ile hareket et | X\'e basarak odadan cik ]', 120, 82);

        const b = Game.puzzleRoom;

        // Draw Grid Cells
        ctx.strokeStyle = '#1e1b4b';
        ctx.lineWidth = 1;
        for (let col = 0; col < 15; col++) {
            for (let row = 0; row < 8; row++) {
                const cx = 100 + col * 40;
                const cy = 100 + row * 40;
                ctx.strokeRect(cx, cy, 40, 40);
            }
        }

        // Draw Target squares
        b.targets.forEach(t => {
            const cx = 100 + t.col * 40;
            const cy = 100 + t.row * 40;
            ctx.fillStyle = t.color + '44'; // semi-transparent
            ctx.fillRect(cx + 4, cy + 4, 32, 32);
            ctx.strokeStyle = t.color;
            ctx.lineWidth = 3;
            ctx.strokeRect(cx + 4, cy + 4, 32, 32);
            
            // Draw a cross inside target
            ctx.beginPath();
            ctx.moveTo(cx + 12, cy + 12);
            ctx.lineTo(cx + 28, cy + 28);
            ctx.moveTo(cx + 28, cy + 12);
            ctx.lineTo(cx + 12, cy + 28);
            ctx.stroke();
        });

        // Draw Reset Cell
        const rx = 100 + b.resetCell.col * 40;
        const ry = 100 + b.resetCell.row * 40;
        ctx.fillStyle = '#ec489955';
        ctx.fillRect(rx + 2, ry + 2, 36, 36);
        ctx.strokeStyle = '#ec4899';
        ctx.lineWidth = 2;
        ctx.strokeRect(rx + 2, ry + 2, 36, 36);
        ctx.fillStyle = '#ffffff';
        ctx.font = '8px "Press Start 2P"';
        ctx.fillText('RST', rx + 8, ry + 22);

        // Draw Wall blocks
        ctx.fillStyle = '#311054';
        ctx.strokeStyle = '#9333ea';
        ctx.lineWidth = 2;
        b.walls.forEach(w => {
            const wx = 100 + w.col * 40;
            const wy = 100 + w.row * 40;
            ctx.fillRect(wx + 2, wy + 2, 36, 36);
            ctx.strokeRect(wx + 2, wy + 2, 36, 36);
            
            // Inner brick texture
            ctx.fillStyle = '#1e0835';
            ctx.fillRect(wx + 6, wy + 6, 28, 28);
            ctx.fillStyle = '#311054';
        });

        // Draw Colored Boxes
        b.boxes.forEach(bx => {
            const boxX = 100 + bx.col * 40;
            const boxY = 100 + bx.row * 40;
            
            ctx.fillStyle = bx.color;
            ctx.fillRect(boxX + 4, boxY + 4, 32, 32);
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.strokeRect(boxX + 4, boxY + 4, 32, 32);
            
            // Crate style cross
            ctx.strokeStyle = 'rgba(0,0,0,0.4)';
            ctx.beginPath();
            ctx.moveTo(boxX + 8, boxY + 8);
            ctx.lineTo(boxX + 28, boxY + 28);
            ctx.moveTo(boxX + 28, boxY + 8);
            ctx.lineTo(boxX + 8, boxY + 28);
            ctx.stroke();
        });

        // Draw player inside grid cell
        const px = 100 + b.playerCol * 40 + 20;
        const py = 100 + b.playerRow * 40 + 20;
        if (Images.player.complete) {
            ctx.drawImage(Images.player, px - 14, py - 14, 28, 28);
        } else {
            Sprites.drawHeart(ctx, px, py, 14);
        }
    },

    gameLoop() {
        const loop = (time) => {
            this.update(time);
            this.draw();
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }
};

window.addEventListener('load', () => {
    Engine.init();
});
