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

// The supabase client variable can be declared here, but not initialized yet.
let supabaseClient;

const fruitTypes = [
    'apple', 'banana', 'strawberry', 'grape', 'blueberry', 'lemon', 'coconut', 'orange', 'cherry'
];
const fruitEmojis = [
    '🍎', '🍌', '🍓', '🍇', '🫐', '🍋', '🥥', '🍊', '🍒'
];
const specialFruits = {
    'slowmo': { emoji: '⏰', type: 'slowmo' },
    'lifeboost': { emoji: '♥️', type: 'lifeboost' },
    'bomb': { emoji: '💣', type: 'bomb' },
};
const PARTICLE_COUNT = 30;
const INITIAL_LIVES = 3;
const COMBO_HEIGHT_THRESHOLD = 2 / 5;

let fruits = [], particles = [], floatingTexts = [];
let score = 0, lives = INITIAL_LIVES, combo = 0, gameState = 'start';
let currentTypingFruit = null, currentInputText = '';
let spawnIntervalId = null, spawnRate = 2000, speedMultiplier = 1;
let slowmoActive = false;
let slowmoTimer = null;
let highScore = parseInt(localStorage.getItem('fruitSparkHighScore')) || 0;

function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
}
window.addEventListener('resize', resizeCanvas);

window.onload = function () {
    // Initialize Supabase here, after the library has been loaded
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    resizeCanvas();
    updateHighScoreDisplay();

    // Add event listener for the new leaderboard button
    const leaderboardButton = document.getElementById('leaderboardButton');
    if (leaderboardButton) {
        leaderboardButton.addEventListener('click', showLeaderboard);
    }

    const synthPing = new Tone.Synth({
        oscillator: { type: 'sine' },
        envelope: { attack: 0.01, decay: 0.2, sustain: 0.1, release: 0.1 }
    }).toDestination();
    const synthPop = new Tone.Synth({
        oscillator: { type: 'sine' },
        envelope: { attack: 0.01, decay: 0.3, sustain: 0.1, release: 0.2 }
    }).toDestination();
    const synthMiss = new Tone.Synth({
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.01, decay: 0.4, sustain: 0.1, release: 0.3 }
    }).toDestination();
    const synthPowerUp = new Tone.PolySynth(Tone.Synth).toDestination();

    const playSound = async (type) => {
        await Tone.start();
        if (type === 'ping') synthPing.triggerAttackRelease('C4', '8n');
        if (type === 'pop') synthPop.triggerAttackRelease('E4', '8n');
        if (type === 'miss') synthMiss.triggerAttackRelease('A3', '8n');
        if (type === 'powerup') synthPowerUp.triggerAttackRelease(['C5', 'E5', 'G5'], '8n');
    };

    class Fruit {
        constructor() {
            this.isSpecial = (Math.random() < 0.1);
            if (this.isSpecial) {
                const specialKey = Object.keys(specialFruits)[Math.floor(Math.random() * Object.keys(specialFruits).length)];
                this.type = specialFruits[specialKey].type;
                this.emoji = specialFruits[specialKey].emoji;
                this.radius = canvas.height * 0.03;
            } else {
                const idx = Math.floor(Math.random() * fruitTypes.length);
                this.type = fruitTypes[idx];
                this.emoji = fruitEmojis[idx];
                this.radius = canvas.height * 0.06;
            }
            this.x = Math.random() * (canvas.width - 2 * this.radius) + this.radius;
            this.y = -this.radius;
            this.speed = (0.3 + Math.random() * 0.7) * speedMultiplier * (canvas.height / 600);
        }
        draw() {
            if (this === currentTypingFruit) {
                ctx.save();
                ctx.shadowColor = '#fff';
                ctx.shadowBlur = 25;
                ctx.fillStyle = 'rgba(255,255,255,0.7)';
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
            if (slowmoActive) {
                this.y += this.speed * 0.5;
            } else {
                this.y += this.speed;
            }
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

            ctx.fillStyle = 'rgba(0,0,0,0.1)';
            if (ctx.roundRect) {
                ctx.beginPath();
                ctx.roundRect(boxX, boxY, boxWidth, boxHeight, [15]);
                ctx.fill();
            } else {
                ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
            }

            const textX = boxX + 10;

            ctx.fillStyle = 'rgba(255,255,255,0.3)';
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
        constructor(text, x, y, color) {
            this.text = text;
            this.x = canvas.width / 2;
            this.y = canvas.height / 2;
            this.color = color;
            this.opacity = 1.0;
            this.vy = -1;
            this.life = 120;
        }
        update() {
            this.y += this.vy;
            this.opacity = this.life / 120;
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

    // In your functions, change all references from `supabase` to `supabaseClient`
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
        const topScores = await fetchLeaderboard();
        let html = '<h2>🏆 Leaderboard</h2><ol>';
        topScores.forEach(row => {
            html += `<li>${row.name}: ${row.score}</li>`;
        });
        html += '</ol>';
        html += '<button id="backButton">Back to Start</button>';
        modal.innerHTML = html;
        document.getElementById('backButton').addEventListener('click', showStartScreen);
        modal.style.opacity = '1';
        modal.style.pointerEvents = 'auto';
    }

    function getParticleColor(fruitType) {
        switch (fruitType) {
            case 'apple': return 'red';
            case 'banana': return '#FFD700';
            case 'strawberry': return '#FF4500';
            case 'grape': return '#8A2BE2';
            case 'blueberry': return '#4169E1';
            case 'lemon': return 'yellow';
            case 'coconut': return '#A0522D';
            case 'orange': return 'orange';
            case 'cherry': return '#DC143C';
            default: return `hsl(${Math.random() * 60 + 20},100%,70%)`;
        }
    }

    function createParticles(x, y, fruitType, sizeMultiplier = 1) {
        const color = getParticleColor(fruitType);
        for (let i = 0; i < PARTICLE_COUNT; i++)
            particles.push(new Particle(x, y, color, sizeMultiplier));
    }

    function spawnFruit() {
        if (gameState === 'playing') fruits.push(new Fruit());
    }

    function updateUI() {
        scoreEl.textContent = score;
        livesContainerEl.innerHTML = '♥️'.repeat(lives);

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
        if (gameState !== 'playing') return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const comboLineY = canvas.height * COMBO_HEIGHT_THRESHOLD;
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(0, comboLineY);
        ctx.lineTo(canvas.width, comboLineY);
        ctx.stroke();
        ctx.restore();

        for (let i = fruits.length - 1; i >= 0; i--) {
            const f = fruits[i];
            f.update();
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
        particles.forEach(p => { p.update(); p.draw(); });
        particles = particles.filter(p => p.life > 0);
        floatingTexts.forEach(t => { t.update(); t.draw(); });
        floatingTexts = floatingTexts.filter(t => t.life > 0);
        requestAnimationFrame(gameLoop);
    }

    // Shows the main menu
    function showStartScreen() {
        modal.innerHTML = `
            <h1>🍎 Fruit Type ✨</h1>
            <p>Click a fruit and type its name before it falls!</p>
            <button id="startButton">Start Game</button>
            <button id="leaderboardButton">Leaderboard</button>
        `;
        document.getElementById('startButton').addEventListener('click', startGame);
        document.getElementById('leaderboardButton').addEventListener('click', showLeaderboard);
        modal.style.opacity = '1';
        modal.style.pointerEvents = 'auto';
        gameState = 'start';
    }

    function startGame() {
        score = 0;
        lives = INITIAL_LIVES;
        combo = 0;
        fruits = [];
        particles = [];
        floatingTexts = [];
        speedMultiplier = 1;
        spawnRate = 2000;
        resetTyping();
        updateUI();
        gameState = 'playing';
        modal.style.opacity = '0';
        modal.style.pointerEvents = 'none';
        clearInterval(spawnIntervalId);
        spawnIntervalId = setInterval(() => {
            spawnFruit();
            if (spawnRate > 700) spawnRate -= 5;
            speedMultiplier += 0.002;
        }, spawnRate);
        gameLoop();
    }

    // New function to show a custom nickname input
    function showNicknamePrompt() {
        modal.innerHTML = `<h1>Game Over</h1>
            <p>Your final score is ${score}</p>
            <p>Enter your nickname to save your score!</p>
            <div class="input-container">
                <input type="text" id="nicknameInput" maxlength="12">
                <span id="nicknamePlaceholder">Click to type your name</span>
            </div>
            <button id="submitScoreButton">Submit Score</button>`;
        const nicknameInput = document.getElementById('nicknameInput');
        const nicknamePlaceholder = document.getElementById('nicknamePlaceholder');
        const submitScoreButton = document.getElementById('submitScoreButton');
        nicknameInput.addEventListener('focus', () => {
            nicknamePlaceholder.textContent = 'Nickname';
            nicknamePlaceholder.style.opacity = '1';
        });
        nicknameInput.addEventListener('blur', () => {
            if (!nicknameInput.value.trim()) {
                nicknamePlaceholder.textContent = 'Click to type your name';
                nicknamePlaceholder.style.opacity = '0.7';
            }
        });
        submitScoreButton.addEventListener('click', async () => {
            let nickname = nicknameInput.value.trim() || 'Player';
            submitScoreButton.disabled = true;
            submitScoreButton.textContent = 'Please wait...';
            await submitScore(nickname, score);
            showLeaderboard();
        });
        nicknameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') submitScoreButton.click();
        });
        modal.style.opacity = '1';
        modal.style.pointerEvents = 'auto';
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
                    }
                } else {
                    let comboMultiplier = combo > 0 ? combo : 1;
                    points = currentTypingFruit.type.length * 10 * comboMultiplier;
                }

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

    startButton.addEventListener('click', startGame);
};