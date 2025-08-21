const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const gameContainer = document.getElementById('gameContainer');
const scoreEl = document.getElementById('score');
const livesContainerEl = document.getElementById('livesContainer');
const comboEl = document.getElementById('combo');
const modal = document.getElementById('modal');
const startButton = document.getElementById('startButton');
const highScoreEl = document.getElementById('highScore');

// ✨ Supabase setup ✨
const SUPABASE_URL = 'https://iuqiitpxaawkmqqrdifh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1cWlpdHB4YWF3a21xcXJkaWZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3MjE2NjAsImV4cCI6MjA3MTI5NzY2MH0.vzozq44bX0Yc4F0Xc4jYmAgyYrutbsOU7iy-hjRr-XQ';

let supabaseClient;

// 🎮 NEW: Stage system configuration
const STAGES = {
    1: {
        name: "Short Fruits",
        items: ['apple', 'grape', 'lemon', 'lime'],
        emojis: ['🍎', '🍇', '🍋', '🍋‍🟩'],
        requiredScore: 0,
        theme: "Fresh fruits with short names!"
    },
    2: {
        name: "Medium Fruits",
        items: ['banana', 'orange', 'cherry', 'coconut'],
        emojis: ['🍌', '🍊', '🍒', '🥥'],
        requiredScore: 2000,
        theme: "Medium-sized fruit names!"
    },
    3: {
        name: "Long Fruits",
        items: ['strawberry', 'blueberry', 'pineapple', 'watermelon'],
        emojis: ['🍓', '🫐', '🍍', '🍉'],
        requiredScore: 5000,
        theme: "Longer fruit names to challenge you!"
    },
    4: {
        name: "Animals",
        items: ['cat', 'dog', 'elephant', 'butterfly', 'penguin'],
        emojis: ['🐱', '🐶', '🐘', '🦋', '🐧'],
        requiredScore: 8000,
        theme: "Type the animal names!"
    },
    5: {
        name: "Space & Sky",
        items: ['rocket', 'star', 'moon', 'rainbow', 'lightning'],
        emojis: ['🚀', '⭐', '🌙', '🌈', '⚡'],
        requiredScore: 13000,
        theme: "Reach for the stars!"
    },
    6: {
        name: "Ocean Life",
        items: ['whale', 'octopus', 'dolphin', 'shark', 'jellyfish'],
        emojis: ['🐋', '🐙', '🐬', '🦈', '🪼'],
        requiredScore: 18000,
        theme: "Dive deep into the ocean!"
    },
    7: {
        name: "Vehicles",
        items: ['airplane', 'motorcycle', 'helicopter', 'submarine'],
        emojis: ['✈️', '🏍️', '🚁', '🚊'],
        requiredScore: 25000,
        theme: "Fast-moving transportation!"
    },
    8: {
        name: "Musical Magic",
        items: ['guitar', 'piano', 'trumpet', 'violin', 'saxophone'],
        emojis: ['🎸', '🎹', '🎺', '🎻', '🎷'],
        requiredScore: 32000,
        theme: "Strike the right note!"
    },
    9: {
        name: "Fantasy Realm",
        items: ['dragon', 'unicorn', 'wizard', 'crystal', 'castle'],
        emojis: ['🐉', '🦄', '🧙', '💎', '🏰'],
        requiredScore: 40000,
        theme: "Enter the mystical world!"
    },
    10: {
        name: "Champions League",
        items: ['championship', 'legendary', 'magnificent', 'extraordinary'],
        emojis: ['🏆', '👑', '⚡', '🌟'],
        requiredScore: 50000,
        theme: "The ultimate typing challenge!"
    }
};

const specialFruits = {
    'slowmo': { emoji: '⏰', type: 'slowmo' },
    'lifeboost': { emoji: '♥️', type: 'lifeboost' },
    'bomb': { emoji: '💣', type: 'bomb' },
    'lifeboost': { emoji: '♥️', type: 'lifeboost' },
    'bomb': { emoji: '💣', type: 'bomb' },
    'lifeboost': { emoji: '♥️', type: 'lifeboost' },
    'bomb': { emoji: '💣', type: 'bomb' },
    'lifeboost': { emoji: '♥️', type: 'lifeboost' },
    'bomb': { emoji: '💣', type: 'bomb' },
    'lifeboost': { emoji: '♥️', type: 'lifeboost' },
    'bomb': { emoji: '💣', type: 'bomb' },
    'lifeboost': { emoji: '♥️', type: 'lifeboost' },
    'bomb': { emoji: '💣', type: 'bomb' },
    'timewarp': { emoji: '⏳', type: 'timewarp' },
};

const PARTICLE_COUNT = 30;
const INITIAL_LIVES = 3;
const COMBO_HEIGHT_THRESHOLD = 2 / 5;

let fruits = [], particles = [], floatingTexts = [];
let score = 0, lives = INITIAL_LIVES, combo = 0, gameState = 'start';
let currentTypingFruit = null, currentInputText = '';
let spawnIntervalId = null, spawnRate = 2000;
let slowmoActive = false;
let slowmoTimer = null;
let timeWarpActive = false;
let timeWarpTimer = null;
let highScore = parseInt(localStorage.getItem('fruitSparkHighScore')) || 0;

// 🎮 NEW: Stage system variables
let currentStage = 1;
let stageJustAdvanced = false;
let stagePauseActive = false;

// NEW: Use separate speed multipliers for different game states
const BACKGROUND_SPEED_MULTIPLIER = 2;
let gameSpeedMultiplier = 0.3;

// NEW: Global variable to cache leaderboard data
let leaderboardCache = null;

function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
}

window.addEventListener('resize', resizeCanvas);

window.onload = function () {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    resizeCanvas();
    updateHighScoreDisplay();
    showStartScreen(); 

    const leaderboardButton = document.getElementById('leaderboardButton');
    if (leaderboardButton) {
        leaderboardButton.addEventListener('click', showLeaderboard);
    }
    
    // Set up a continuous loop for the background
    startBackgroundLoop();

    const synthPing = new Tone.Synth({
        oscillator: { type: 'sine' },
        envelope: { attack: 0.01, decay: 0.2, sustain: 0.1, release: 0.1 }
    }).toDestination();
    const synthPop = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.01, decay: 0.3, sustain: 0.1, release: 0.2 }
    }).toDestination();
    const synthMiss = new Tone.Synth({
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.01, decay: 0.4, sustain: 0.1, release: 0.3 }
    }).toDestination();
    const synthPowerUp = new Tone.PolySynth(Tone.Synth).toDestination();
    
    const synthTimeWarp = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'sine' },
        envelope: { attack: 0.1, decay: 0.5, sustain: 0.2, release: 0.8 }
    }).toDestination();

    // 🎮 NEW: Stage advancement sound - softer and more pleasant
    const synthStageUp = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'sine' },
        envelope: { attack: 0.2, decay: 0.6, sustain: 0.2, release: 1.0 }
    }).toDestination();

    const playSound = async (type) => {
        await Tone.start();
        if (type === 'ping') synthPing.triggerAttackRelease('C4', '8n');
        if (type === 'pop') synthPop.triggerAttackRelease(['C5', 'E5', 'G5'], '8n');
        if (type === 'miss') synthMiss.triggerAttackRelease('A3', '8n');
        if (type === 'powerup') synthPowerUp.triggerAttackRelease(['C5', 'E5', 'G5'], '8n');
        if (type === 'timewarp') synthTimeWarp.triggerAttackRelease(['C6', 'A5', 'F5'], '4n');
        if (type === 'stageup') synthStageUp.triggerAttackRelease(['C5', 'E5', 'G5'], '2n');
    };

    // 🎮 NEW: Function to get current stage items
    function getCurrentStageItems() {
        const stage = STAGES[currentStage];
        return {
            items: stage.items,
            emojis: stage.emojis
        };
    }

    // 🎮 NEW: Function to check and advance stage
    function checkStageAdvancement() {
        const nextStage = currentStage + 1;
        if (STAGES[nextStage] && score >= STAGES[nextStage].requiredScore && !stageJustAdvanced) {
            currentStage = nextStage;
            stageJustAdvanced = true;
            stagePauseActive = true;
            
            // 🔄 NEW: Reset combo when advancing to a new stage
            combo = 0;
            
            playSound('stageup');
            
            const stage = STAGES[currentStage];
            
            // 🎮 NEW: Don't clear fruits, let them continue falling
            // fruits = []; // REMOVED
            
            // 🎮 NEW: Longer-lasting stage announcements with slower fade
            floatingTexts.push(new FloatingText(`Stage ${currentStage}`, canvas.width / 2, canvas.height / 2 - 40, '#FFD700', 2000));
            floatingTexts.push(new FloatingText(stage.name, canvas.width / 2, canvas.height / 2, '#4CAF50', 2000));
            floatingTexts.push(new FloatingText(stage.theme, canvas.width / 2, canvas.height / 2 + 40, '#87CEEB', 2000));
            
            
            // 🎮 NEW: Pause fruit spawning for 5 seconds during stage transition
            clearInterval(spawnIntervalId);
            
            // Reset the flags and resume after 5 seconds
            setTimeout(() => {
                stageJustAdvanced = false;
                stagePauseActive = false;
                
                // Resume spawning fruits
                spawnIntervalId = setInterval(() => {
                    spawnFruit();
                    if (spawnRate > 700) spawnRate -= 5;
                    gameSpeedMultiplier += 0.005;
                }, spawnRate);
            }, 5000);
            
            updateUI();
        }
    }

    class Fruit {
        constructor() {
            this.isSpecial = (Math.random() < 0.1);
            if (this.isSpecial) {
                const specialKey = Object.keys(specialFruits)[Math.floor(Math.random() * Object.keys(specialFruits).length)];
                this.type = specialFruits[specialKey].type;
                this.emoji = specialFruits[specialKey].emoji;
                this.radius = canvas.height * 0.03;
            } else {
                // 🎮 NEW: Use current stage items instead of fixed fruits
                const stageItems = getCurrentStageItems();
                const idx = Math.floor(Math.random() * stageItems.items.length);
                this.type = stageItems.items[idx];
                this.emoji = stageItems.emojis[idx];
                this.radius = canvas.height * 0.06;
            }
            this.x = Math.random() * (canvas.width - 2 * this.radius) + this.radius;
            this.y = -this.radius;
            let currentBaseSpeed = (0.3 + Math.random() * 0.7);
            if (gameState === 'playing') {
                this.speed = currentBaseSpeed * gameSpeedMultiplier * (canvas.height / 600);
            } else {
                this.speed = currentBaseSpeed * BACKGROUND_SPEED_MULTIPLIER * (canvas.height / 600);
            }
        }
        draw() {
            if (this === currentTypingFruit) {
                ctx.save();
                const glowColor = getParticleColor(this.type);
                ctx.shadowColor = glowColor;
                ctx.shadowBlur = 25;
                ctx.fillStyle = `rgba(${parseInt(glowColor.slice(1,3), 16)}, ${parseInt(glowColor.slice(3,5), 16)}, ${parseInt(glowColor.slice(5,7), 16)}, 0.7)`;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
            ctx.font = `${this.radius * 1.4}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(this.emoji, this.x, this.y);
            if (this === currentTypingFruit) this.drawTypingUI();
        }
        update() {
            let currentSpeed = this.speed;
            if (slowmoActive) {
                currentSpeed *= 0.5;
            } else if (timeWarpActive) {
                currentSpeed *= 2;
            }
            this.y += currentSpeed;
            this.draw();
        }
        drawTypingUI() {
            const y = this.y + this.radius + 15;
            const isCorrect = this.type.startsWith(currentInputText);

            ctx.font = '24px Quicksand';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';

            const textMetrics = ctx.measureText(this.type);
            const boxWidth = textMetrics.width + 20;
            const boxHeight = 40;

            const boxX = this.x - boxWidth / 2;
            const boxY = y - boxHeight / 2;

            ctx.fillStyle = 'rgba(255,255,255,0.1)';
            if (ctx.roundRect) {
                ctx.beginPath();
                ctx.roundRect(boxX, boxY, boxWidth, boxHeight, [15]);
                ctx.fill();
            } else {
                ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
            }

            const textX = boxX + 10;

            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.fillText(this.type, textX, y);

            ctx.fillStyle = isCorrect ? '#a7ff8b' : '#ff8b8b';
            ctx.fillText(currentInputText, textX, y);

            if (Date.now() % 1000 < 500) {
                const cursorX = textX + ctx.measureText(currentInputText).width + 2;
                ctx.fillStyle = 'white';
                ctx.fillRect(cursorX, y - 12, 2, 24);
            }
        }
    }

    class Particle {
        constructor(x, y, color, sizeMultiplier = 1) {
            this.x = x;
            this.y = y;
            this.size = (Math.random() * 5 + 2) * sizeMultiplier;
            this.speedX = (Math.random() - 0.5) * 6;
            this.speedY = (Math.random() - 0.5) * 6;
            this.color = color;
            this.life = 1;
            this.fadeSpeed = 0.03;
        }
        update() {
            this.x += this.speedX;
            this.y += this.speedY;
            this.life -= this.fadeSpeed;
        }
        draw() {
            ctx.save();
            ctx.globalAlpha = this.life;
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    class FloatingText {
        constructor(text, x, y, color, lifespan = 120) {
            this.text = text;
            this.x = x;
            this.y = y;
            this.color = color;
            this.opacity = 1.0;
            this.vy = -0.3; // 🎮 NEW: Even slower movement for stage announcements
            this.life = lifespan;
            this.maxLife = lifespan; // 🎮 NEW: Store original lifespan for better fade calculation
        }
        update() {
            this.y += this.vy;
            this.opacity = this.life / this.maxLife; // 🎮 NEW: Use original lifespan for smooth fade
            this.life--;
        }
        draw() {
            ctx.save();
            ctx.globalAlpha = this.opacity;
            ctx.font = 'bold 30px Quicksand';
            ctx.textAlign = 'center';
            ctx.fillStyle = this.color;
            ctx.fillText(this.text, this.x, this.y);
            ctx.restore();
        }
    }

    async function submitScore(nickname, gameScore) {
        const { data, error } = await supabaseClient
            .from('leaderboard')
            .insert({ name: nickname, score: gameScore });

        if (error) console.error('Error submitting score:', error);
        else console.log('Score submitted!', data);
    }

    async function fetchLeaderboard() {
        const { data, error } = await supabaseClient
            .from('leaderboard')
            .select('*')
            .order('score', { ascending: false })
            .limit(10);

        if (error) console.error('Error fetching leaderboard:', error);
        return data || [];
    }

    async function showLeaderboard() {
        // NEW: Disable the button and show a loading state immediately
        const leaderboardButton = document.getElementById('leaderboardButton');
        if (leaderboardButton) {
            leaderboardButton.textContent = 'Loading...';
            leaderboardButton.disabled = true;
        }

        // NEW: Show cached data instantly if it exists
        let scores = leaderboardCache;
        if (!scores) {
            scores = await fetchLeaderboard();
            leaderboardCache = scores;
        }

        let leaderboardHtml = `
            <div class="leaderboard-container">
                <h2>🏆 Top Scores</h2>
                <ol class="score-list">
                    ${scores.map(row => `<li><span class="score-name">${row.name}</span><span class="score-value">${row.score}</span></li>`).join('')}
                </ol>
                <button id="backButton">Back to Start</button>
            </div>
        `;
        modal.innerHTML = leaderboardHtml;
        document.getElementById('backButton').addEventListener('click', showStartScreen);
        modal.style.opacity = '1';
        modal.style.pointerEvents = 'auto';
        gameState = 'modal';

        // NEW: Fetch fresh data in the background and update the cache for next time
        const freshScores = await fetchLeaderboard();
        leaderboardCache = freshScores;
    }

    function getParticleColor(fruitType) {
        // 🎮 NEW: Updated color scheme for different stage items
        const stageColors = {
            // Stage 1 - Short Fruits
            'apple': '#FF0000', 'grape': '#8A2BE2', 'lemon': '#FFFF00', 'lime': '#00FF00',
            
            // Stage 2 - Medium Fruits
            'banana': '#FFD700', 'orange': '#FFA500', 'cherry': '#DC143C', 'coconut': '#A0522D',
            
            // Stage 3 - Long Fruits
            'strawberry': '#FF4500', 'blueberry': '#4169E1', 'pineapple': '#FFD700', 'watermelon': '#FF69B4',
            
            // Stage 4 - Animals
            'cat': '#FFA500', 'dog': '#8B4513', 'elephant': '#708090', 'butterfly': '#FF1493', 'penguin': '#000080',
            
            // Stage 5 - Space & Sky
            'rocket': '#FF4500', 'star': '#FFD700', 'moon': '#C0C0C0', 'rainbow': '#FF69B4', 'lightning': '#FFFF00',
            
            // Stage 6 - Ocean Life
            'whale': '#4682B4', 'octopus': '#8A2BE2', 'dolphin': '#87CEEB', 'shark': '#708090', 'jellyfish': '#FF1493',
            
            // Stage 7 - Vehicles
            'airplane': '#C0C0C0', 'motorcycle': '#FF4500', 'helicopter': '#008000', 'submarine': '#000080',
            
            // Stage 8 - Musical Magic
            'guitar': '#8B4513', 'piano': '#000000', 'trumpet': '#FFD700', 'violin': '#A0522D', 'saxophone': '#DAA520',
            
            // Stage 9 - Fantasy Realm
            'dragon': '#FF0000', 'unicorn': '#FF1493', 'wizard': '#4B0082', 'crystal': '#00FFFF', 'castle': '#708090',
            
            // Stage 10 - Champions League
            'championship': '#FFD700', 'legendary': '#FF1493', 'magnificent': '#8A2BE2', 'extraordinary': '#00FF00',
            
            // Special items
            'slowmo': '#00FFFF', 'lifeboost': '#FF1493', 'bomb': '#FF0000', 'timewarp': '#C0C0C0'
        };
        
        return stageColors[fruitType] || `hsl(${Math.random() * 60 + 20},100%,70%)`;
    }

    function createParticles(x, y, fruitType, sizeMultiplier = 1) {
        const color = getParticleColor(fruitType);
        for (let i = 0; i < PARTICLE_COUNT; i++)
            particles.push(new Particle(x, y, color, sizeMultiplier));
    }

    function spawnFruit() {
        // 🎮 NEW: Don't spawn fruits during stage pause
        if (stagePauseActive) return;
        
        if (gameState === 'playing' || gameState === 'modal') fruits.push(new Fruit());
    }

    function updateUI() {
        scoreEl.textContent = score;
        livesContainerEl.innerHTML = '❤️'.repeat(lives);

        if (combo > 0) {
            comboEl.style.display = 'block';
            comboEl.textContent = `Combo x${combo}`;
            comboEl.style.transform = `scale(${1 + combo * 0.05})`;
            comboEl.style.left = `${canvas.offsetLeft + canvas.width / 2 - comboEl.offsetWidth / 2}px`;
            comboEl.style.top = `${canvas.offsetTop + canvas.height / 2 - comboEl.offsetHeight / 2}px`;
            comboEl.style.position = 'absolute';
        } else {
            comboEl.style.display = 'none';
        }
        updateHighScoreDisplay();
        
        // 🎮 NEW: Check for stage advancement
        checkStageAdvancement();
    }

    function updateHighScoreDisplay() {
        highScoreEl.textContent = highScore;
    }

    function resetTyping() {
        currentTypingFruit = null;
        currentInputText = '';
    }

    function handleScreenShake() {
        gameContainer.classList.add('shake');
        setTimeout(() => {
            gameContainer.classList.remove('shake');
        }, 300);
    }

    function activateSlowmo() {
        if (slowmoActive) clearTimeout(slowmoTimer);
        slowmoActive = true;
        floatingTexts.push(new FloatingText('Slow Motion!', canvas.width / 2, canvas.height / 2, '#4CAF50'));
        slowmoTimer = setTimeout(() => {
            slowmoActive = false;
        }, 5000);
    }
    
    function activateTimeWarp() {
        if (timeWarpActive) clearTimeout(timeWarpTimer);
        timeWarpActive = true;
        playSound('timewarp');
        floatingTexts.push(new FloatingText('Time Warp!', canvas.width / 2, canvas.height / 2, '#C0C0C0'));
        timeWarpTimer = setTimeout(() => {
            timeWarpActive = false;
        }, 10000);
    }

    function activateBomb() {
        playSound('powerup');
        let fruitsToKeep = [];
        fruits.forEach(f => {
            if (!f.isSpecial) {
                createParticles(f.x, f.y, f.type, 1.5);
                floatingTexts.push(new FloatingText('BOOM!', f.x, f.y, '#FF0000'));
            } else {
                fruitsToKeep.push(f);
            }
        });
        fruits = fruitsToKeep.filter(f => f.type !== 'bomb');
        resetTyping();
        updateUI();
    }

    function handleFruitMiss(fruit) {
        if (fruit.isSpecial) {
            fruits = fruits.filter(f => f !== fruit);
            return;
        }
        playSound('miss');
        handleScreenShake();
        fruits = fruits.filter(f => f !== fruit);
        lives--;
        combo = 0;
        floatingTexts.push(new FloatingText('Miss!', canvas.width / 2, canvas.height / 2, 'red'));
        if (fruit === currentTypingFruit) resetTyping();
        updateUI();
        if (lives <= 0) endGame();
    }

    function gameLoop() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (gameState === 'playing') {
            const comboLineY = canvas.height * COMBO_HEIGHT_THRESHOLD;
            ctx.save();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(0, comboLineY);
            ctx.lineTo(canvas.width, comboLineY);
            ctx.stroke();
            ctx.restore();

            // 🎮 NEW: Display current stage info
            ctx.save();
            ctx.font = '20px Quicksand';
            ctx.textAlign = 'right';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            const stageText = `Stage ${currentStage}: ${STAGES[currentStage].name}`;
            ctx.fillText(stageText, canvas.width - 20, 40);
            ctx.restore();
        }

        for (let i = fruits.length - 1; i >= 0; i--) {
            const f = fruits[i];
            f.update();

            if (gameState === 'playing') {
                if (f.y - f.radius > canvas.height) {
                    handleFruitMiss(f);
                    continue;
                }
                if (
                    f.y > canvas.height * COMBO_HEIGHT_THRESHOLD &&
                    currentTypingFruit !== f &&
                    currentInputText === ''
                ) {
                    combo = 0;
                    updateUI();
                }
            }
        }
        
        if (gameState === 'modal' || gameState === 'start') {
            fruits = fruits.filter(f => f.y - f.radius < canvas.height);
        }

        particles.forEach(p => { p.update(); p.draw(); });
        particles = particles.filter(p => p.life > 0);
        floatingTexts.forEach(t => { t.update(); t.draw(); });
        floatingTexts = floatingTexts.filter(t => t.life > 0);
        requestAnimationFrame(gameLoop);
    }

    function startBackgroundLoop() {
        clearInterval(spawnIntervalId);
        spawnIntervalId = setInterval(() => {
            spawnFruit();
        }, 1000);
        gameLoop();
    }

    function showStartScreen() {
        modal.innerHTML = `
            <h1>🍎 Fruit Type ✨</h1>
            <p>Click an item and type its name before it falls!</p>
            <p><strong>10 Stages</strong> with increasing difficulty!</p>
            <button id="startButton">Start Game</button>
            <button id="leaderboardButton">Leaderboard</button>
        `;
        document.getElementById('startButton').addEventListener('click', startGame);
        document.getElementById('leaderboardButton').addEventListener('click', showLeaderboard);
        modal.style.opacity = '1';
        modal.style.pointerEvents = 'auto';
        gameState = 'modal'; 
        
        fruits = [];
        startBackgroundLoop();
    }

    function startGame() {
        // NEW: Immediately disable pointer events to prevent another button from being clicked
        modal.style.pointerEvents = 'none';

        score = 0;
        lives = INITIAL_LIVES;
        combo = 0;
        fruits = [];
        particles = [];
        floatingTexts = [];
        gameSpeedMultiplier = 0.2;
        spawnRate = 2000;
        
        // 🎮 NEW: Reset stage system
        currentStage = 1;
        stageJustAdvanced = false;
        stagePauseActive = false;
        
        resetTyping();
        updateUI();
        gameState = 'playing';
        modal.style.opacity = '0';
        
        // 🎮 NEW: Show initial stage notification
        const stage = STAGES[currentStage];
        floatingTexts.push(new FloatingText(`Stage ${currentStage}`, canvas.width / 2, canvas.height / 2 - 40, '#FFD700'));
        floatingTexts.push(new FloatingText(stage.name, canvas.width / 2, canvas.height / 2, '#4CAF50'));
        floatingTexts.push(new FloatingText(stage.theme, canvas.width / 2, canvas.height / 2 + 40, '#87CEEB'));
        
        clearInterval(spawnIntervalId);
        spawnIntervalId = setInterval(() => {
            spawnFruit();
            if (spawnRate > 700) spawnRate -= 5;
            gameSpeedMultiplier += 0.001;
        }, spawnRate);
    }

    function showNicknamePrompt() {
    modal.innerHTML = `
        <div class="nickname-prompt-container">
            <h1>Game Over</h1>
            <p>Your final score is <span class="final-score-value">${score}</span></p>
            <p>You reached <strong>Stage ${currentStage}: ${STAGES[currentStage].name}</strong></p>
            <p>Enter your nickname to save your score!</p>
            <div class="input-container">
                <input type="text" id="nicknameInput" maxlength="12" placeholder="Your Nickname">
            </div>
            <button id="submitScoreButton">Submit Score</button>
        </div>
    `;
    const nicknameInput = document.getElementById('nicknameInput');
    const submitScoreButton = document.getElementById('submitScoreButton');
    submitScoreButton.addEventListener('click', () => {
        let nickname = nicknameInput.value.trim() || 'Player';
        
        // Disable the button and show a loading state
        submitScoreButton.disabled = true;
        submitScoreButton.textContent = 'Submitting...';
        
        // NEW: Call submitScore without 'await' to run it as a background task
        submitScore(nickname, score);
        
        // Immediately return to the start screen
        showStartScreen();
    });
    nicknameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') submitScoreButton.click();
    });
    modal.style.opacity = '1';
    modal.style.pointerEvents = 'auto';
    gameState = 'modal';
}

    async function endGame() {
        gameState = 'gameOver';
        clearInterval(spawnIntervalId);

        if (score > highScore) {
            highScore = score;
            localStorage.setItem('fruitSparkHighScore', highScore);
        }
        updateHighScoreDisplay();
        showNicknamePrompt();
    }

    canvas.addEventListener('mousedown', (e) => {
        if (gameState !== 'playing') return;
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left, mouseY = e.clientY - rect.top;
        const clickedFruit = fruits.find(f => Math.hypot(f.x - mouseX, f.y - mouseY) < f.radius);
        if (clickedFruit) {
            playSound('ping');
            currentTypingFruit = clickedFruit;
            currentInputText = '';
        } else {
            resetTyping();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (gameState !== 'playing' || !currentTypingFruit) return;

        const key = e.key;
        if (key === 'Enter') {
            if (currentInputText === currentTypingFruit.type) {
                playSound('pop');
                let points = 0;

                if (currentTypingFruit.isSpecial) {
                    if (currentTypingFruit.type === 'slowmo') {
                        activateSlowmo();
                        points = 500;
                    } else if (currentTypingFruit.type === 'lifeboost') {
                        lives++;
                        playSound('powerup');
                        points = 250;
                    } else if (currentTypingFruit.type === 'bomb') {
                        activateBomb();
                        points = 1000;
                    } else if (currentTypingFruit.type === 'timewarp') {
                        activateTimeWarp();
                        points = 1500;
                    }
                } else {
                    // 🎮 NEW: Enhanced scoring system based on word length and stage
                    let comboMultiplier = combo > 0 ? combo : 1;
                    let stageBonus = currentStage * 5; // Bonus points for higher stages
                    points = (currentTypingFruit.type.length * 10 + stageBonus) * comboMultiplier;
                }

                if (timeWarpActive) points *= 2;

                score += points;
                createParticles(currentTypingFruit.x, currentTypingFruit.y, currentTypingFruit.type, 1 + combo * 0.2);
                floatingTexts.push(new FloatingText(`+${points}`, canvas.width / 2, canvas.height / 2, '#32CD32'));

                if (!currentTypingFruit.isSpecial) combo++;

                if (combo > 0 && combo % 5 === 0)
                    floatingTexts.push(new FloatingText('Combo!', canvas.width / 2, canvas.height / 2, '#FFD700'));

                fruits = fruits.filter(f => f !== currentTypingFruit);
                resetTyping();
                updateUI();
            } else {
                combo = 0;
                updateUI();
            }
        } else if (key === 'Backspace') {
            currentInputText = currentInputText.slice(0, -1);
        } else if (key === 'Escape') {
            resetTyping();
        } else if (key.length === 1 && key.match(/[a-z]/i)) {
            currentInputText += key.toLowerCase();
        }

        if (currentTypingFruit && !currentTypingFruit.type.startsWith(currentInputText)) {
            combo = 0;
            updateUI();
        }
    });
};