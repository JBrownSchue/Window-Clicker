// SECTION 1: GAME STATE AND GLOBAL VARIABLES
// --------------------------------------------

let clicks = 0;
let clicksPerClick = 1;
let passiveClicksPerSecond = 0;
let activeCPS = 0;
let clickTimestamps = [];
let subwaySurfersSpawned = 0;
let particles = [];
let radialGradientActive = false;
let radialGradientHue = 0;
let currentLanguage = 'de';
let languageData = {};
let isShiftHeld = false;
let isCtrlHeld = false;

// Upgrade definitions
const upgrades = {
    cursor:             { level: 0, cost: 10,    baseCost: 10,    bonus: 1,  costMultiplier: 1.15 },
    windowOptimization: { level: 0, cost: 100,   baseCost: 100,   bonus: 5,  costMultiplier: 1.25 },
    autoclicker:        { level: 0, cost: 25,    baseCost: 25,    bonus: 1,  costMultiplier: 1.20 },
    clickMagnet:        { level: 0, cost: 500,   baseCost: 500,   bonus: 1,  costMultiplier: 1.30 },
    factory:            { level: 0, cost: 500,   baseCost: 500,   bonus: 10, costMultiplier: 1.25 },
    globalDominance:    { level: 0, cost: 10000, baseCost: 10000, bonus: 50, costMultiplier: 1.40 }
};

// Milestone definitions
const milestones = [
    { threshold: 100,    activated: false, effect: () => triggerParticleBurst('red', 50, 10) },
    { threshold: 1000,   activated: false, effect: () => {
        triggerParticleBurst('gold', 100, 20); 
        spawnFloatingText(languageData.milestone_1000_text, 'green', 30);
    }},
    { threshold: 10000,  activated: false, effect: () => {
        triggerParticleBurst('purple', 200, 30); 
        spawnFloatingText(languageData.milestone_10000_text, 'purple', 40);
        activateRadialGradientPulse();
    }},
    { threshold: 100000, activated: false, effect: () => {
        triggerParticleBurst('rainbow', 500, 40); 
        spawnFloatingText(languageData.milestone_100000_text, 'orange', 50);
    }}
];


// SECTION 2: DOM ELEMENT SELECTORS
// --------------------------------

const clickCountDisplay = document.getElementById('click-count');
const activeCpsDisplay = document.getElementById('active-cps-display');
const passiveCpsDisplay = document.getElementById('passive-cps-display');
const clickableWindow = document.getElementById('clickable-window');
const videoContainer = document.getElementById('video-background-container');
const chaosCanvas = document.getElementById('chaos-canvas');
const ctx = chaosCanvas.getContext('2d');
const resetButton = document.getElementById('reset-save-btn');
const languageSwitcher = document.getElementById('language-switcher');

const upgradeButtons = {
    cursor: document.getElementById('upgrade-cursor-btn'),
    windowOptimization: document.getElementById('upgrade-window-opt-btn'),
    autoclicker: document.getElementById('upgrade-autoclicker-btn'),
    clickMagnet: document.getElementById('upgrade-click-magnet-btn'),
    factory: document.getElementById('upgrade-factory-btn'),
    globalDominance: document.getElementById('upgrade-global-dominance-btn')
};


// SECTION 3: LANGUAGE HANDLING
// ----------------------------

async function fetchLanguageData(lang) {
    try {
        const response = await fetch(`lang/${lang}.json`);
        if (!response.ok) throw new Error(`Could not load language file: lang/${lang}.json`);
        languageData = await response.json();
        applyLanguage();
    } catch (error) {
        console.error('Failed to fetch language data:', error);
        if (lang !== 'de') await fetchLanguageData('de');
    }
}

function applyLanguage() {
    document.querySelectorAll('[data-lang-key]').forEach(element => {
        const key = element.getAttribute('data-lang-key');
        if (languageData[key]) element.textContent = languageData[key];
    });
    updateUI();
}

function handleLanguageChange() {
    currentLanguage = languageSwitcher.value;
    fetchLanguageData(currentLanguage);
}


// SECTION 4: CORE GAME LOGIC
// --------------------------

function calculateCostForN(type, n) {
    const upgrade = upgrades[type];
    let totalCost = 0;
    for (let i = 0; i < n; i++) {
        totalCost += Math.floor(upgrade.baseCost * Math.pow(upgrade.costMultiplier, upgrade.level + i));
    }
    return totalCost;
}

function calculateMaxBuy(type) {
    const upgrade = upgrades[type];
    let money = clicks;
    let amount = 0;
    let currentCost = upgrade.cost;

    while (money >= currentCost) {
        money -= currentCost;
        amount++;
        currentCost = Math.floor(upgrade.baseCost * Math.pow(upgrade.costMultiplier, upgrade.level + amount));
    }
    return amount;
}

function calculateActiveCPS() {
    const now = Date.now();
    const oneSecondAgo = now - 1000;
    clickTimestamps = clickTimestamps.filter(ts => ts > oneSecondAgo);
    activeCPS = clickTimestamps.length;
}

function handleWindowClick(event) {
    clicks += clicksPerClick;
    clickTimestamps.push(Date.now());
    checkAllMilestones();
    createClickFeedback(event.clientX, event.clientY, `+${clicksPerClick}`);
}

function buyUpgrade(type, event) {
    let buyAmount = 1;
    if (event.ctrlKey) {
        buyAmount = calculateMaxBuy(type);
    } else if (event.shiftKey) {
        buyAmount = 10;
    }
    
    for (let i = 0; i < buyAmount; i++) {
        const upgrade = upgrades[type];
        if (clicks >= upgrade.cost) {
            clicks -= upgrade.cost;
            upgrade.level++;
            upgrade.cost = Math.floor(upgrade.baseCost * Math.pow(upgrade.costMultiplier, upgrade.level));
        } else {
            break;
        }
    }
    recalculateStats();
    updateUI();
}

function recalculateStats() {
    let newClicksPerClick = 1 + (upgrades.cursor.level * upgrades.cursor.bonus) + (upgrades.windowOptimization.level * upgrades.windowOptimization.bonus);
    clicksPerClick = newClicksPerClick;

    let newCPS = (upgrades.autoclicker.level * upgrades.autoclicker.bonus) + (upgrades.factory.level * upgrades.factory.bonus) + (upgrades.globalDominance.level * upgrades.globalDominance.bonus) + (upgrades.clickMagnet.level * upgrades.clickMagnet.bonus * clicksPerClick);
    passiveClicksPerSecond = newCPS;
}

function updateUI() {
    if (!languageData.costPrefix) return;

    clickCountDisplay.textContent = Math.floor(clicks);
    activeCpsDisplay.textContent = `${languageData.activeCpsLabel || 'Active CPS'}: ${activeCPS}`;
    passiveCpsDisplay.textContent = `${languageData.passiveCpsLabel || 'Passive CPS'}: ${Math.floor(passiveClicksPerSecond)}`;

    for (const type in upgrades) {
        const button = upgradeButtons[type];
        const upgrade = upgrades[type];
        
        button.querySelector('.title').textContent = languageData[`upgrade_${type}_title`];
        button.querySelector('.description').textContent = languageData[`upgrade_${type}_desc`];
        
        const maxBuyAmount = calculateMaxBuy(type);
        const levelSpan = button.querySelector('.level');
        levelSpan.innerHTML = `${languageData.levelPrefix}${upgrade.level} <span class="max-buy-info">${languageData.maxBuyPrefix}${maxBuyAmount}${languageData.maxBuySuffix}</span>`;

        const costSpan = button.querySelector('.cost');
        if (isCtrlHeld) {
            const costForMax = calculateCostForN(type, maxBuyAmount);
            costSpan.textContent = `${languageData.costPrefixMax}${maxBuyAmount}x): ${costForMax}`;
            button.disabled = maxBuyAmount === 0;
        } else if (isShiftHeld) {
            const costFor10 = calculateCostForN(type, 10);
            costSpan.textContent = `${languageData.costPrefix10x}${costFor10}`;
            button.disabled = clicks < costFor10;
        } else {
            costSpan.textContent = `${languageData.costPrefix}${upgrade.cost}`;
            button.disabled = clicks < upgrade.cost;
        }
    }
}

function autoClick() {
    clicks += passiveClicksPerSecond / 10;
    checkAllMilestones();
}

function checkAllMilestones() {
    for (const milestone of milestones) {
        if (!milestone.activated && clicks >= milestone.threshold) {
            milestone.activated = true;
            milestone.effect();
        }
    }
    const requiredSpawns = Math.floor(clicks / 10000);
    if (subwaySurfersSpawned < requiredSpawns) {
        const spawnsToCreate = requiredSpawns - subwaySurfersSpawned;
        for (let i = 0; i < spawnsToCreate; i++) {
            spawnSubwaySurfer();
        }
        subwaySurfersSpawned = requiredSpawns;
    }
}


// SECTION 5: SAVE & LOAD SYSTEM
// -----------------------------

function saveGame() {
    const gameState = {
        clicks: clicks,
        upgradeLevels: Object.keys(upgrades).reduce((acc, key) => {
            acc[key] = upgrades[key].level;
            return acc;
        }, {}),
        milestonesActivated: milestones.map(m => m.activated),
        language: currentLanguage
    };
    localStorage.setItem('clickerGameState', JSON.stringify(gameState));
    showSavePopup();
}

async function loadGame() {
    const savedState = localStorage.getItem('clickerGameState');
    if (savedState) {
        const gameState = JSON.parse(savedState);
        clicks = gameState.clicks || 0;
        currentLanguage = gameState.language || 'de';

        if (gameState.upgradeLevels) {
            for (const type in gameState.upgradeLevels) {
                const level = gameState.upgradeLevels[type];
                if (upgrades[type]) {
                    upgrades[type].level = level;
                    upgrades[type].cost = Math.floor(upgrades[type].baseCost * Math.pow(upgrades[type].costMultiplier, level));
                }
            }
        }

        if (gameState.milestonesActivated) {
            for (let i = 0; i < gameState.milestonesActivated.length; i++) {
                if (gameState.milestonesActivated[i]) {
                    milestones[i].activated = true;
                }
            }
        }
    }
    languageSwitcher.value = currentLanguage;
    await fetchLanguageData(currentLanguage);
    recalculateStats();
    checkAllMilestones();
    restoreEffectsOnLoad();
    updateUI();
}

function resetGame() {
    if (confirm("Are you sure you want to reset all your progress? This cannot be undone.")) {
        localStorage.removeItem('clickerGameState');
        location.reload();
    }
}

function showSavePopup() {
    const popup = document.createElement('div');
    popup.className = 'save-popup';
    popup.textContent = languageData.savePopupText || 'Progress Saved!';
    document.body.appendChild(popup);
    setTimeout(() => popup.remove(), 2500);
}

function restoreEffectsOnLoad() {
    let delay = 500;
    for (let i = 0; i < milestones.length; i++) {
        if (milestones[i].activated) {
            setTimeout(() => {
                milestones[i].effect();
            }, delay);
            delay += 750;
        }
    }
}


// SECTION 6: VISUAL EFFECTS & CHAOS
// ---------------------------------

function createClickFeedback(x, y, text) {
    const feedback = document.createElement('div');
    feedback.className = 'click-feedback';
    feedback.textContent = text;
    feedback.style.left = `${x}px`;
    feedback.style.top = `${y}px`;
    document.body.appendChild(feedback);
    setTimeout(() => feedback.remove(), 700);
}

function spawnSubwaySurfer() {
    const gif = document.createElement('div');
    gif.className = 'subway-surfer-gif';
    gif.style.backgroundImage = `url('https://media1.tenor.com/m/b41RjP8S8BwAAAAC/subway-surfers-jake.gif')`;
    gif.style.left = `${Math.random() * (window.innerWidth - 300)}px`;
    gif.style.top = `${Math.random() * (window.innerHeight - 500)}px`;
    videoContainer.appendChild(gif);
}

function triggerParticleBurst(colorType = 'white', count = 50, size = 5) {
    const centerX = chaosCanvas.width / 2;
    const centerY = chaosCanvas.height / 2;
    for (let i = 0; i < count; i++) {
        let color;
        if (colorType === 'rainbow') color = `hsl(${Math.random() * 360}, 100%, 50%)`;
        else if (colorType === 'red') color = `hsl(0, 100%, ${50 + Math.random() * 30}%)`;
        else if (colorType === 'gold') color = `hsl(40, 100%, ${50 + Math.random() * 30}%)`;
        else if (colorType === 'purple') color = `hsl(270, 100%, ${50 + Math.random() * 30}%)`;
        else color = colorType;
        particles.push({
            x: centerX, y: centerY, size: size + Math.random() * size, color: color,
            vx: (Math.random() - 0.5) * 10, vy: (Math.random() - 0.5) * 10
        });
    }
}

function animateParticles() {
    ctx.clearRect(0, 0, chaosCanvas.width, chaosCanvas.height);
    if (radialGradientActive) {
        const gradient = ctx.createRadialGradient(
            chaosCanvas.width / 2, chaosCanvas.height / 2, 0,
            chaosCanvas.width / 2, chaosCanvas.height / 2, Math.max(chaosCanvas.width, chaosCanvas.height) / 2
        );
        radialGradientHue = (radialGradientHue + 0.5) % 360;
        gradient.addColorStop(0, `hsla(${radialGradientHue}, 100%, 70%, 0.3)`);
        gradient.addColorStop(0.5, `hsla(${(radialGradientHue + 60) % 360}, 100%, 50%, 0.2)`);
        gradient.addColorStop(1, `hsla(${(radialGradientHue + 120) % 360}, 100%, 30%, 0)`);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, chaosCanvas.width, chaosCanvas.height);
    }
    for (let p of particles) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > chaosCanvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > chaosCanvas.height) p.vy *= -1;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
    }
    requestAnimationFrame(animateParticles);
}

function spawnFloatingText(text, color, fontSize) {
    if (!text) return;
    const textElement = document.createElement('div');
    textElement.className = 'milestone-text';
    textElement.textContent = text;
    textElement.style.color = color;
    textElement.style.fontSize = `${fontSize}px`;
    textElement.style.left = `${Math.random() * (window.innerWidth - 300) + 100}px`;
    textElement.style.top = `${Math.random() * (window.innerHeight - 200) + 50}px`;
    document.body.appendChild(textElement);
}

function activateRadialGradientPulse() {
    radialGradientActive = true;
}

function resizeCanvas() {
    chaosCanvas.width = window.innerWidth;
    chaosCanvas.height = window.innerHeight;
}


// SECTION 7: EVENT LISTENERS AND GAME INITIALIZATION
// -------------------------------------------------

window.addEventListener('resize', resizeCanvas);
clickableWindow.addEventListener('mousedown', function (event) {
    event.preventDefault();
    handleWindowClick(event);
});
clickableWindow.addEventListener('click', function (event) {
    event.preventDefault();
    handleWindowClick(event);
});
clickableWindow.addEventListener('contextmenu', function (event) {
    event.preventDefault();
    handleWindowClick(event); 
});
resetButton.addEventListener('click', resetGame);
languageSwitcher.addEventListener('change', handleLanguageChange);

window.addEventListener('keydown', (event) => {
    if (event.key === 'Shift' && !isShiftHeld) {
        isShiftHeld = true;
        updateUI();
    }
    if (event.key === 'Control' && !isCtrlHeld) {
        isCtrlHeld = true;
        updateUI();
    }
});
window.addEventListener('keyup', (event) => {
    if (event.key === 'Shift') {
        isShiftHeld = false;
        updateUI();
    }
    if (event.key === 'Control') {
        isCtrlHeld = false;
        updateUI();
    }
});

for (const type in upgradeButtons) {
    upgradeButtons[type].addEventListener('click', (event) => buyUpgrade(type, event));
}

document.addEventListener('DOMContentLoaded', () => {
    loadGame();
    resizeCanvas();
    animateParticles();

    // Main game loop
    setInterval(() => {
        autoClick();
        calculateActiveCPS();
        updateUI();
    }, 100);

    // Save game progress
    setInterval(saveGame, 30000);
});