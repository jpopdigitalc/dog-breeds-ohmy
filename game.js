// Modern color palette
const COLORS = {
    bg: '#0f0f23',
    bgSecondary: '#1a1a3e',
    text: '#ffffff',
    textSecondary: '#b8b8d4',
    textAccent: '#64ffda',
    accent: '#6366f1',
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
    pill: '#6366f1',
    pillHover: '#818cf8',
    // Hex values for Phaser
    hex: {
        bg: 0x0f0f23,
        bgSecondary: 0x1a1a3e,
        accent: 0x6366f1,
        success: 0x10b981,
        error: 0xef4444,
        warning: 0xf59e0b,
        pill: 0x6366f1,
        pillHover: 0x818cf8,
        pillSuccess: 0x10b981,
        pillError: 0xef4444,
        placeholder: 0x4b5563
    }
};

// Game state
let currentRound = 1;
let roundTimeRemaining = 20;
let correctAnswers = 0; // Correct answers in current round
let cumulativeCorrectAnswers = 0; // Total correct answers across all rounds
let totalTime = 0;
let roundStartTime = 0;
let currentDogBreed = "";
let answerChoices = [];
let blinkStartTime = 0;
let isBlinking = false;
let dogImage = null;
let roundTimer = null;
let blinkTimer = null;
let currentQuestionStartTime = 0;
let errors = 0; // Track errors (wrong answers) for error tolerance
let hasAnsweredCurrentQuestion = false; // Prevent multiple answers to same question

// Progression requirements
const PROGRESSION_REQUIREMENTS = {
    2: 3,   // Need 3 correct to advance to Round 2
    3: 9,   // Need 9 correct to advance to Round 3
    leaderboard: 18  // Need 18 correct to reach leaderboard
};

// Round configuration
const ROUND_CONFIG = {
    1: {
        displayTime: 5,           // 5 seconds to see the dog
        blinkDuration: 1.5,       // 1.5 second blink-out (longest)
        maxErrors: 3,             // Up to 3 errors allowed
        breeds: ["Golden Retriever", "Labrador", "German Shepherd", "Bulldog", "Beagle", "Poodle", "Rottweiler", "Yorkshire Terrier"]
    },
    2: {
        displayTime: 3,           // 3 seconds to see the dog
        blinkDuration: 1.0,       // 1 second blink-out (shorter)
        maxErrors: 2,             // Up to 2 errors allowed
        breeds: ["Shiba Inu", "Border Collie", "Australian Shepherd", "Dalmatian", "Husky", "Akita", "Basenji", "Whippet"]
    },
    3: {
        displayTime: 2,           // 2 seconds to see the dog
        blinkDuration: 0.5,       // 0.5 second blink-out (shortest)
        maxErrors: 1,             // Up to 1 error allowed
        breeds: ["Xoloitzcuintli", "Azawakh", "Catalburun", "Lundehund", "Mudi", "Lagotto Romagnolo", "Keeshond", "Bergamasco"]
    }
};

// Breed to Dog CEO API path (main/sub for sub-breeds: https://dog.ceo/api/breed/{path}/images/random)
const BREED_API_MAP = {
    // Round 1 breeds
    "Golden Retriever": "retriever/golden",
    "Labrador": "labrador",
    "German Shepherd": "german/shepherd",
    "Bulldog": "bulldog/english",
    "Beagle": "beagle",
    "Poodle": "poodle/standard",
    "Rottweiler": "rottweiler",
    "Yorkshire Terrier": "terrier/yorkshire",
    
    // Round 2 breeds
    "Shiba Inu": "shiba",
    "Border Collie": "collie/border",
    "Australian Shepherd": "australian/shepherd",
    "Dalmatian": "dalmatian",
    "Husky": "husky",
    "Akita": "akita",
    "Basenji": "basenji",
    "Whippet": "whippet",
    
    // Round 3 breeds (obscure)
    "Xoloitzcuintli": "mexicanhairless",
    "Azawakh": "saluki",
    "Catalburun": "pointer/german",
    "Lundehund": "elkhound/norwegian",
    "Mudi": "sheepdog/shetland",
    "Lagotto Romagnolo": "waterdog/spanish",
    "Keeshond": "keeshond",
    "Bergamasco": "sheepdog/shetland",
};

// Round breed pools (max 2 breeds per round)
let roundBreedPool = [];

// Scale image to fit within max size, keep aspect ratio, ensure no side under 100px
function scaleToFitBalanced(texture, maxWidth, maxHeight, minSize) {
    minSize = minSize || 100;
    let w, h;
    const src = texture.getSource ? texture.getSource() : texture.source && texture.source[0];
    if (src && src.width != null && src.height != null) {
        w = src.width;
        h = src.height;
    } else {
        const frame = texture.getFrame ? texture.getFrame(texture.getFrameNames()[0] || '__BASE') : null;
        w = frame ? frame.cutWidth || frame.width : 0;
        h = frame ? frame.cutHeight || frame.height : 0;
    }
    if (!w || !h) return 0.4;
    let scale = Math.min(maxWidth / w, maxHeight / h);
    let displayW = w * scale;
    let displayH = h * scale;
    if (displayW < minSize || displayH < minSize) {
        const scaleUp = Math.max(minSize / displayW, minSize / displayH);
        scale *= scaleUp;
    }
    return scale;
}

// Create a pill-shaped graphic (rounded rectangle with semicircular ends)
function createPillShape(scene, x, y, width, height, color) {
    const radius = height / 2;
    const g = scene.add.graphics();
    g.x = x;
    g.y = y;
    g.fillStyle(color);
    g.fillRoundedRect(-width / 2, -height / 2, width, height, radius);
    g.setInteractive(new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height), Phaser.Geom.Rectangle.Contains);
    g._pillWidth = width;
    g._pillHeight = height;
    g._pillColor = color;
    return g;
}

// Update pill color (redraw the pill shape with new color)
function updatePillColor(pill, color) {
    if (!pill || !pill._pillWidth) return;
    pill.clear();
    pill.fillStyle(color);
    const w = pill._pillWidth;
    const h = pill._pillHeight;
    pill.fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    pill._pillColor = color;
}

// Initialize breed pool for round (1 or 2 breeds, randomly determined)
function initializeRoundBreeds(round) {
    const availableBreeds = ROUND_CONFIG[round].breeds;
    // Randomly select 1 or 2 breeds for this round
    const numBreeds = Math.floor(Math.random() * 2) + 1; // 1 or 2
    const shuffled = [...availableBreeds].sort(() => Math.random() - 0.5);
    roundBreedPool = shuffled.slice(0, numBreeds);
    
    // Ensure at least 2 breeds for answer choices to work properly
    if (roundBreedPool.length === 1 && availableBreeds.length > 1) {
        const remainingBreeds = availableBreeds.filter(b => !roundBreedPool.includes(b));
        if (remainingBreeds.length > 0) {
            const randomBreed = remainingBreeds[Math.floor(Math.random() * remainingBreeds.length)];
            roundBreedPool.push(randomBreed);
        }
    }
    
    return roundBreedPool;
}

// Generate answer choices. Enforce: no more than one duplicate (no breed appears more than twice).
function generateChoices(correctBreed, round) {
    const choicePool = (round === 1)
        ? ROUND_CONFIG[1].breeds
        : roundBreedPool;
    const wrongBreeds = choicePool.filter(b => b !== correctBreed);
    const totalChoices = round === 1 ? 4 : 3 + Math.floor(Math.random() * 2); // 4 for R1; 3–4 for R2/R3
    const numWrong = totalChoices - 1; // 1 correct + numWrong wrong

    const selectedWrong = [];
    const shuffledWrong = [...wrongBreeds].sort(() => Math.random() - 0.5);

    // Use each wrong breed at most once first
    for (let i = 0; i < numWrong && i < shuffledWrong.length; i++) {
        selectedWrong.push(shuffledWrong[i]);
    }

    // If we still need more wrong choices, add exactly one duplicate (one breed repeated once, no more)
    if (selectedWrong.length < numWrong && shuffledWrong.length > 0) {
        selectedWrong.push(shuffledWrong[0]);
    }

    let choices = [correctBreed, ...selectedWrong];

    // Enforce at most one duplicate: no breed appears more than twice
    choices = capToAtMostOneDuplicate(choices);
    return choices.sort(() => Math.random() - 0.5);
}

// Ensure no breed appears more than twice (at most one duplicate per breed).
function capToAtMostOneDuplicate(choices) {
    const seen = {};
    const out = [];
    for (const b of choices) {
        seen[b] = (seen[b] || 0) + 1;
        if (seen[b] <= 2) out.push(b);
    }
    return out;
}

// Preload 25 different breed images for Round 1
async function preloadRound1Images(progressText) {
    const round1Breeds = ROUND_CONFIG[1].breeds;
    const imagesToLoad = 25;
    let loadedCount = 0;
    
    // Create array of breed-image pairs to load
    const loadPromises = [];
    
    for (let i = 0; i < imagesToLoad; i++) {
        // Cycle through breeds to get variety
        const breed = round1Breeds[i % round1Breeds.length];
        const imageKey = `preload-dog-${i}`;
        
        const promise = loadDogImageForPreload(gameScene, breed, imageKey)
            .then((key) => {
                loadedCount++;
                preloadedImages.push({ key, breed });
                if (progressText) {
                    progressText.setText(`Preloading images: ${loadedCount}/${imagesToLoad}`);
                }
            })
            .catch((error) => {
                console.warn(`Failed to preload image ${i} for ${breed}:`, error);
                loadedCount++;
                if (progressText) {
                    progressText.setText(`Preloading images: ${loadedCount}/${imagesToLoad}`);
                }
            });
        
        loadPromises.push(promise);
        
        // Small delay between requests to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Wait for all images to load (or fail)
    await Promise.allSettled(loadPromises);
    console.log(`Preloaded ${preloadedImages.length} images for Round 1`);
}

// Preload 50 Round 2 breed images (none from Round 1; Round 2 breeds only)
async function preloadRound2Images(progressText) {
    const round2Breeds = ROUND_CONFIG[2].breeds;
    const imagesToLoad = 50;
    let loadedCount = 0;
    const loadPromises = [];
    
    for (let i = 0; i < imagesToLoad; i++) {
        const breed = round2Breeds[i % round2Breeds.length];
        const imageKey = `preload2-dog-${i}`;
        
        const promise = loadDogImageForPreload(gameScene, breed, imageKey)
            .then((key) => {
                loadedCount++;
                preloadedImagesRound2.push({ key, breed });
                if (progressText) {
                    progressText.setText(`Preloading Round 2: ${loadedCount}/${imagesToLoad}`);
                }
            })
            .catch((error) => {
                console.warn(`Failed to preload Round 2 image ${i} for ${breed}:`, error);
                loadedCount++;
                if (progressText) {
                    progressText.setText(`Preloading Round 2: ${loadedCount}/${imagesToLoad}`);
                }
            });
        
        loadPromises.push(promise);
        await new Promise(resolve => setTimeout(resolve, 80));
    }
    
    await Promise.allSettled(loadPromises);
    console.log(`Preloaded ${preloadedImagesRound2.length} images for Round 2`);
}

// Preload 150 Round 3 breed images
async function preloadRound3Images(progressText) {
    const round3Breeds = ROUND_CONFIG[3].breeds;
    const imagesToLoad = 150;
    let loadedCount = 0;
    const loadPromises = [];
    
    for (let i = 0; i < imagesToLoad; i++) {
        const breed = round3Breeds[i % round3Breeds.length];
        const imageKey = `preload3-dog-${i}`;
        
        const promise = loadDogImageForPreload(gameScene, breed, imageKey)
            .then((key) => {
                loadedCount++;
                preloadedImagesRound3.push({ key, breed });
                if (progressText) {
                    progressText.setText(`Preloading Round 3: ${loadedCount}/${imagesToLoad}`);
                }
            })
            .catch((error) => {
                console.warn(`Failed to preload Round 3 image ${i} for ${breed}:`, error);
                loadedCount++;
                if (progressText) {
                    progressText.setText(`Preloading Round 3: ${loadedCount}/${imagesToLoad}`);
                }
            });
        
        loadPromises.push(promise);
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    await Promise.allSettled(loadPromises);
    console.log(`Preloaded ${preloadedImagesRound3.length} images for Round 3`);
}

// Load a dog image for preloading (simpler version)
async function loadDogImageForPreload(scene, breed, imageKey) {
    const apiBreedName = BREED_API_MAP[breed] || breed.toLowerCase().replace(/\s+/g, '-');
    
    try {
        // Fetch image URL from Dog API
        const apiUrl = `https://dog.ceo/api/breed/${apiBreedName}/images/random`;
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        if (data.status === 'success' && data.message) {
            const imgUrl = data.message;
            
            // Load image using native Image object, then add to Phaser
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                
                img.onload = () => {
                    // Add image to Phaser texture cache
                    scene.textures.addImage(imageKey, img);
                    resolve(imageKey);
                };
                
                img.onerror = () => {
                    reject(new Error(`Failed to load image: ${imgUrl}`));
                };
                
                img.src = imgUrl;
            });
        } else {
            throw new Error('API returned no image');
        }
    } catch (error) {
        throw error;
    }
}

// Load a dog image using Dog API
async function loadDogImage(scene, breed) {
    const apiBreedName = BREED_API_MAP[breed] || breed.toLowerCase().replace(/\s+/g, '-');
    const imageKey = `dog-${breed}`;
    
    // Check if already loaded
    if (scene.textures.exists(imageKey)) {
        return imageKey;
    }
    
    try {
        // Fetch image URL from Dog API
        const apiUrl = `https://dog.ceo/api/breed/${apiBreedName}/images/random`;
        console.log(`Loading image for ${breed} from ${apiUrl}`);
        
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        if (data.status === 'success' && data.message) {
            const imgUrl = data.message;
            console.log(`Got image URL: ${imgUrl}`);
            
            // Load image using native Image object, then add to Phaser
            return new Promise((resolve) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                
                img.onload = () => {
                    // Add image to Phaser texture cache
                    scene.textures.addImage(imageKey, img);
                    console.log(`Successfully loaded image for ${breed}`);
                    resolve(imageKey);
                };
                
                img.onerror = () => {
                    console.warn(`Failed to load image for ${breed}, using placeholder`);
                    resolve(null);
                };
                
                img.src = imgUrl;
            });
        }
    } catch (error) {
        console.warn(`Could not load image for ${breed}:`, error);
    }
    
    return null; // Will use placeholder
}

// Phaser game configuration
const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent: 'game-container',
    backgroundColor: COLORS.bg,
    scene: {
        create: create,
        update: update
    }
};

const game = new Phaser.Game(config);
let gameScene = null;
let answerPills = [];
let dogSprite = null;
let roundText = null;
let timerText = null;
let errorText = null;
let scoreText = null;
let preloadedImages = []; // Round 1 preloaded images
let preloadIndex = 0;
let preloadedImagesRound2 = []; // Round 2 preloaded images (50, none from Round 1)
let preloadIndexRound2 = 0;
let preloadedImagesRound3 = []; // Round 3 preloaded images (150)
let preloadIndexRound3 = 0;

async function create() {
    gameScene = this;
    
    // Show loading screen
    const loadingText = gameScene.add.text(400, 250, "Loading game...", {
        fontSize: '36px',
        fontFamily: 'Inter, sans-serif',
        fontWeight: '600',
        fill: COLORS.text,
        stroke: COLORS.textAccent,
        strokeThickness: 2
    }).setOrigin(0.5);
    
    const progressText = gameScene.add.text(400, 300, "Preloading images: 0/25", {
        fontSize: '20px',
        fontFamily: 'Inter, sans-serif',
        fill: COLORS.textSecondary
    }).setOrigin(0.5);
    
    // Preload 25 breed images for Round 1
    await preloadRound1Images(progressText);
    
    // Remove loading screen
    loadingText.destroy();
    progressText.destroy();
    
    // Start the game
    startRound(1);
}

function update() {
    // Update logic handled by timers
}

// Start a new round
async function startRound(round) {
    if (gameScene) {
        gameScene.children.removeAll();
        answerPills = [];
    }
    
    // Cancel any existing timers
    if (roundTimer) {
        clearInterval(roundTimer);
    }
    if (blinkTimer) {
        clearTimeout(blinkTimer);
    }
    
    // Reset round-specific state
    errors = 0;
    correctAnswers = 0;
    totalTime = 0;
    
    // Initialize breed pool
    initializeRoundBreeds(round);
    
    // Display round number
    roundText = gameScene.add.text(400, 30, `Round ${round}`, {
        fontSize: '36px',
        fontFamily: 'Inter, sans-serif',
        fontWeight: '700',
        fill: COLORS.text,
        stroke: COLORS.accent,
        strokeThickness: 3
    }).setOrigin(0.5);
    
    // Start round timer
    roundTimeRemaining = 20;
    roundStartTime = Date.now();
    
    // Show first dog
    await showNewDog(round);
    
    // Round timer
    roundTimer = setInterval(() => {
        roundTimeRemaining -= 0.1;
        
        if (timerText) timerText.destroy();
        timerText = gameScene.add.text(400, 70, `Time: ${Math.ceil(roundTimeRemaining)}s`, {
            fontSize: '22px',
            fontFamily: 'Inter, sans-serif',
            fontWeight: '600',
            fill: COLORS.text
        }).setOrigin(0.5);
        
        // Update error display
        if (errorText) errorText.destroy();
        const maxErrors = ROUND_CONFIG[round].maxErrors;
        const errorColor = (maxErrors - errors) <= 1 ? COLORS.error : COLORS.text;
        errorText = gameScene.add.text(400, 100, `Errors: ${errors}/${maxErrors}`, {
            fontSize: '18px',
            fontFamily: 'Inter, sans-serif',
            fontWeight: '500',
            fill: errorColor
        }).setOrigin(0.5);
        
        // Update cumulative score
        if (scoreText) scoreText.destroy();
        scoreText = gameScene.add.text(400, 130, `Total Correct: ${cumulativeCorrectAnswers}`, {
            fontSize: '18px',
            fontFamily: 'Inter, sans-serif',
            fontWeight: '500',
            fill: COLORS.success
        }).setOrigin(0.5);
        
        // Check if error limit exceeded
        if (errors > maxErrors) {
            clearInterval(roundTimer);
            endRound("error_limit");
            return;
        }
        
        // Check if round is over
        if (roundTimeRemaining <= 0) {
            clearInterval(roundTimer);
            endRound("time_up");
        }
    }, 100);
}

// Show a new dog question
async function showNewDog(round) {
    // Clear previous dog and pills
    if (dogSprite) {
        dogSprite.destroy();
        dogSprite = null;
    }
    answerPills.forEach(pill => pill.destroy());
    answerPills = [];
    
    hasAnsweredCurrentQuestion = false;
    
    let imageKey = null;
    let loadingText = null;
    
    // Use preloaded images for Round 1 when the preloaded breed is in this round's pool
    if (round === 1 && preloadedImages.length > 0) {
        const poolSet = new Set(roundBreedPool);
        for (let attempt = 0; attempt < preloadedImages.length; attempt++) {
            const idx = (preloadIndex + attempt) % preloadedImages.length;
            const preloaded = preloadedImages[idx];
            if (!poolSet.has(preloaded.breed)) continue;
            if (!gameScene.textures.exists(preloaded.key)) continue;
            imageKey = preloaded.key;
            currentDogBreed = preloaded.breed;
            preloadIndex = idx + 1;
            break;
        }
    }
    
    // Use preloaded images for Round 2 (50 images, none from Round 1)
    if (round === 2 && preloadedImagesRound2.length > 0) {
        const poolSet = new Set(roundBreedPool);
        for (let attempt = 0; attempt < preloadedImagesRound2.length; attempt++) {
            const idx = (preloadIndexRound2 + attempt) % preloadedImagesRound2.length;
            const preloaded = preloadedImagesRound2[idx];
            if (!poolSet.has(preloaded.breed)) continue;
            if (!gameScene.textures.exists(preloaded.key)) continue;
            imageKey = preloaded.key;
            currentDogBreed = preloaded.breed;
            preloadIndexRound2 = idx + 1;
            break;
        }
    }
    
    // Use preloaded images for Round 3 (150 images)
    if (round === 3 && preloadedImagesRound3.length > 0) {
        const poolSet = new Set(roundBreedPool);
        for (let attempt = 0; attempt < preloadedImagesRound3.length; attempt++) {
            const idx = (preloadIndexRound3 + attempt) % preloadedImagesRound3.length;
            const preloaded = preloadedImagesRound3[idx];
            if (!poolSet.has(preloaded.breed)) continue;
            if (!gameScene.textures.exists(preloaded.key)) continue;
            imageKey = preloaded.key;
            currentDogBreed = preloaded.breed;
            preloadIndexRound3 = idx + 1;
            break;
        }
    }
    
    // If no preloaded image available, pick a breed from pool and load its image
    if (!imageKey) {
        currentDogBreed = roundBreedPool[Math.floor(Math.random() * roundBreedPool.length)];
        
        loadingText = gameScene.add.text(400, 380, "Loading image...", {
            fontSize: '20px',
            fontFamily: 'Inter, sans-serif',
            fill: COLORS.textSecondary
        }).setOrigin(0.5);
        
        imageKey = await loadDogImage(gameScene, currentDogBreed);
        
        if (loadingText) {
            loadingText.destroy();
        }
    }
    
    // Generate choices after we know the correct breed (no duplicates). Round 1: at least 4 choices.
    answerChoices = generateChoices(currentDogBreed, round);
    
    // Display the dog image (balanced size: fit in ~280x280, aspect ratio preserved, min 100px each side)
    if (imageKey && gameScene.textures.exists(imageKey)) {
        const tex = gameScene.textures.get(imageKey);
        const scale = scaleToFitBalanced(tex, 280, 280, 100);
        dogSprite = gameScene.add.image(400, 380, imageKey).setScale(scale);
    } else {
        // Placeholder rectangle
        const graphics = gameScene.add.graphics();
        graphics.fillStyle(COLORS.hex.placeholder);
        graphics.fillRect(300, 280, 200, 200);
        dogSprite = graphics;
        
        // Add breed name text on placeholder
        gameScene.add.text(400, 380, currentDogBreed, {
            fontSize: '16px',
            fontFamily: 'Inter, sans-serif',
            fill: COLORS.text,
            wordWrap: { width: 180 }
        }).setOrigin(0.5);
    }
    
    // Create answer pills (pill-shaped); center below round metrics (y=360)
    const pillWidth = 140;
    const pillHeight = 40;
    const centerX = 400;
    const centerY = 380;  // Below Round/Time/Errors/Total Correct (metrics end ~y=155)
    const pillCircleRadius = 200;
    
    answerChoices.forEach((breed, index) => {
        const angle = (index / answerChoices.length) * Math.PI * 2;
        const pillX = centerX + Math.cos(angle) * pillCircleRadius;
        const pillY = centerY + Math.sin(angle) * pillCircleRadius;
        
        const pill = createPillShape(gameScene, pillX, pillY, pillWidth, pillHeight, COLORS.hex.pill);
        pill.setInteractive({ useHandCursor: true });
        pill.on('pointerover', () => {
            if (!hasAnsweredCurrentQuestion && pill._pillColor === COLORS.hex.pill) {
                updatePillColor(pill, COLORS.hex.pillHover);
            }
        });
        pill.on('pointerout', () => {
            if (!hasAnsweredCurrentQuestion && pill._pillColor === COLORS.hex.pillHover) {
                updatePillColor(pill, COLORS.hex.pill);
            }
        });
        pill.on('pointerdown', () => handleAnswer(breed, pill));
        
        const pillText = gameScene.add.text(pillX, pillY, breed, {
            fontSize: '14px',
            fontFamily: 'Inter, sans-serif',
            fontWeight: '500',
            fill: COLORS.text,
            wordWrap: { width: pillWidth - 20 }
        }).setOrigin(0.5);
        
        pill.breed = breed;
        pill.pillText = pillText;
        pill._pillColor = COLORS.hex.pill;
        pill._pillWidth = pillWidth;
        pill._pillHeight = pillHeight;
        answerPills.push(pill, pillText);
    });
    
    // Reset blink state
    currentQuestionStartTime = Date.now();
    blinkStartTime = currentQuestionStartTime + ROUND_CONFIG[round].displayTime * 1000;
    isBlinking = false;
    
    // Start blink timer
    blinkTimer = setTimeout(() => {
        if (!isBlinking && !hasAnsweredCurrentQuestion) {
            isBlinking = true;
            startBlinkOut(round);
        }
    }, ROUND_CONFIG[round].displayTime * 1000);
}

// Blink-out animation
function startBlinkOut(round) {
    if (!dogSprite || hasAnsweredCurrentQuestion) return;
    
    const blinkDuration = ROUND_CONFIG[round].blinkDuration * 1000;
    const startBlinkTime = Date.now();
    const baseBlinkSpeed = round === 1 ? 8 : round === 2 ? 12 : 20;
    
    const blinkInterval = setInterval(() => {
        if (!dogSprite || hasAnsweredCurrentQuestion) {
            clearInterval(blinkInterval);
            return;
        }
        
        const elapsed = Date.now() - startBlinkTime;
        
        if (elapsed < blinkDuration) {
            const progress = elapsed / blinkDuration;
            const blinkSpeed = baseBlinkSpeed * (1 + progress * 3);
            const shouldShow = Math.sin(progress * Math.PI * blinkSpeed) > 0;
            dogSprite.setAlpha(shouldShow ? 1 : 0);
        } else {
            dogSprite.setAlpha(0);
            clearInterval(blinkInterval);
            
            if (roundTimeRemaining > 1 && errors <= ROUND_CONFIG[currentRound].maxErrors) {
                setTimeout(() => {
                    showNewDog(currentRound);
                }, 500);
            }
        }
    }, 50);
}

// Handle answer selection
async function handleAnswer(selectedBreed, pill) {
    if (hasAnsweredCurrentQuestion) return;
    
    const selectionTime = (Date.now() - currentQuestionStartTime) / 1000;
    
    if (selectedBreed === currentDogBreed) {
        correctAnswers++;
        cumulativeCorrectAnswers++;
        totalTime += selectionTime;
        hasAnsweredCurrentQuestion = true;
        
        // Visual feedback
        updatePillColor(pill, COLORS.hex.pillSuccess);
        
        if (blinkTimer) {
            clearTimeout(blinkTimer);
        }
        if (dogSprite) {
            dogSprite.setAlpha(1);
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
        if (roundTimeRemaining > 0.5 && errors <= ROUND_CONFIG[currentRound].maxErrors) {
            await showNewDog(currentRound);
        } else if (errors > ROUND_CONFIG[currentRound].maxErrors) {
            if (roundTimer) clearInterval(roundTimer);
            endRound("error_limit");
        }
    } else {
        errors++;
        hasAnsweredCurrentQuestion = true;
        
        updatePillColor(pill, COLORS.hex.pillError);
        
        if (errors > ROUND_CONFIG[currentRound].maxErrors) {
            await new Promise(resolve => setTimeout(resolve, 800));
            if (roundTimer) clearInterval(roundTimer);
            endRound("error_limit");
        } else {
            await new Promise(resolve => setTimeout(resolve, 800));
            if (roundTimeRemaining > 0.5 && errors <= ROUND_CONFIG[currentRound].maxErrors) {
                await showNewDog(currentRound);
            }
        }
    }
}

// Draw a rounded-rectangle card background
function drawScoreCard(x, y, width, height) {
    const g = gameScene.add.graphics();
    g.fillStyle(0x1a1a3e, 0.95);
    g.lineStyle(2, 0x6366f1, 0.6);
    g.fillRoundedRect(x - width / 2, y - height / 2, width, height, 20);
    g.strokeRoundedRect(x - width / 2, y - height / 2, width, height, 20);
    return g;
}

// End current round — scoring card layout
function endRound(reason = "time_up") {
    if (roundTimer) clearInterval(roundTimer);
    if (blinkTimer) clearTimeout(blinkTimer);
    
    gameScene.children.removeAll();
    
    const score = correctAnswers > 0 ? (correctAnswers / totalTime).toFixed(2) : 0;
    const maxErrors = ROUND_CONFIG[currentRound].maxErrors;
    
    let endMessage = `Round ${currentRound} Complete`;
    if (reason === "error_limit") {
        endMessage = `Round ${currentRound} — Error limit reached`;
    }
    
    // Card background (centered, ~520×340)
    const cardW = 520;
    const cardH = 340;
    const cardY = 300;
    drawScoreCard(400, cardY, cardW, cardH);
    
    // Headline
    gameScene.add.text(400, cardY - 140, endMessage, {
        fontSize: '28px',
        fontFamily: 'Inter, sans-serif',
        fontWeight: '700',
        fill: COLORS.text
    }).setOrigin(0.5);
    
    // Stats row: three compact stat blocks
    const statY = cardY - 70;
    const statGap = 140;
    
    gameScene.add.text(400 - statGap, statY - 12, 'CORRECT', {
        fontSize: '12px',
        fontFamily: 'Inter, sans-serif',
        fontWeight: '600',
        fill: COLORS.textSecondary
    }).setOrigin(0.5);
    gameScene.add.text(400 - statGap, statY + 14, String(correctAnswers), {
        fontSize: '32px',
        fontFamily: 'Inter, sans-serif',
        fontWeight: '700',
        fill: COLORS.success
    }).setOrigin(0.5);
    
    gameScene.add.text(400, statY - 12, 'ERRORS', {
        fontSize: '12px',
        fontFamily: 'Inter, sans-serif',
        fontWeight: '600',
        fill: COLORS.textSecondary
    }).setOrigin(0.5);
    gameScene.add.text(400, statY + 14, `${errors} / ${maxErrors}`, {
        fontSize: '32px',
        fontFamily: 'Inter, sans-serif',
        fontWeight: '700',
        fill: errors > maxErrors ? COLORS.error : COLORS.text
    }).setOrigin(0.5);
    
    gameScene.add.text(400 + statGap, statY - 12, 'TOTAL', {
        fontSize: '12px',
        fontFamily: 'Inter, sans-serif',
        fontWeight: '600',
        fill: COLORS.textSecondary
    }).setOrigin(0.5);
    gameScene.add.text(400 + statGap, statY + 14, String(cumulativeCorrectAnswers), {
        fontSize: '32px',
        fontFamily: 'Inter, sans-serif',
        fontWeight: '700',
        fill: COLORS.success
    }).setOrigin(0.5);
    
    // Score highlight
    gameScene.add.text(400, cardY + 10, 'Round score', {
        fontSize: '13px',
        fontFamily: 'Inter, sans-serif',
        fontWeight: '600',
        fill: COLORS.textSecondary
    }).setOrigin(0.5);
    gameScene.add.text(400, cardY + 42, score, {
        fontSize: '42px',
        fontFamily: 'Inter, sans-serif',
        fontWeight: '700',
        fill: COLORS.textAccent
    }).setOrigin(0.5);
    
    // Progression message and action (below card)
    const msgY = 500;
    const btnY = 545;
    
    if (currentRound === 1) {
        const required = PROGRESSION_REQUIREMENTS[2];
        if (cumulativeCorrectAnswers >= required) {
            gameScene.add.text(400, msgY, `✓ You need ${required} correct to advance — you made it!`, {
                fontSize: '18px',
                fontFamily: 'Inter, sans-serif',
                fontWeight: '600',
                fill: COLORS.success
            }).setOrigin(0.5);
            
            const continueBtn = gameScene.add.text(400, btnY, "Continue to Round 2 →", {
                fontSize: '20px',
                fontFamily: 'Inter, sans-serif',
                fontWeight: '500',
                fill: COLORS.textSecondary
            }).setOrigin(0.5).setInteractive({ useHandCursor: true });
            
            continueBtn.on('pointerover', () => continueBtn.setFill(COLORS.accent));
            continueBtn.on('pointerout', () => continueBtn.setFill(COLORS.textSecondary));
            
            continueBtn.on('pointerdown', async () => {
                currentRound++;
                gameScene.children.removeAll();
                const progressText = gameScene.add.text(400, 300, "Preloading Round 2: 0/50", {
                    fontSize: '20px',
                    fontFamily: 'Inter, sans-serif',
                    fill: COLORS.textSecondary
                }).setOrigin(0.5);
                await preloadRound2Images(progressText);
                progressText.destroy();
                startRound(currentRound);
            });
        } else {
            gameScene.add.text(400, msgY, `Need ${required} correct to advance · you have ${cumulativeCorrectAnswers}`, {
                fontSize: '18px',
                fontFamily: 'Inter, sans-serif',
                fontWeight: '600',
                fill: COLORS.error
            }).setOrigin(0.5);
            
            const restartBtn = gameScene.add.text(400, btnY, "Play again", {
                fontSize: '20px',
                fontFamily: 'Inter, sans-serif',
                fontWeight: '500',
                fill: COLORS.textSecondary
            }).setOrigin(0.5).setInteractive({ useHandCursor: true });
            
            restartBtn.on('pointerover', () => restartBtn.setFill(COLORS.accent));
            restartBtn.on('pointerout', () => restartBtn.setFill(COLORS.textSecondary));
            
            restartBtn.on('pointerdown', () => {
                currentRound = 1;
                cumulativeCorrectAnswers = 0;
                startRound(1);
            });
        }
    } else if (currentRound === 2) {
        const required = PROGRESSION_REQUIREMENTS[3];
        if (cumulativeCorrectAnswers >= required) {
            gameScene.add.text(400, msgY, `✓ You need ${required} correct to advance — you made it!`, {
                fontSize: '18px',
                fontFamily: 'Inter, sans-serif',
                fontWeight: '600',
                fill: COLORS.success
            }).setOrigin(0.5);
            
            const continueBtn = gameScene.add.text(400, btnY, "Continue to Round 3 →", {
                fontSize: '20px',
                fontFamily: 'Inter, sans-serif',
                fontWeight: '500',
                fill: COLORS.textSecondary
            }).setOrigin(0.5).setInteractive({ useHandCursor: true });
            
            continueBtn.on('pointerover', () => continueBtn.setFill(COLORS.accent));
            continueBtn.on('pointerout', () => continueBtn.setFill(COLORS.textSecondary));
            
            continueBtn.on('pointerdown', async () => {
                currentRound++;
                gameScene.children.removeAll();
                const progressText = gameScene.add.text(400, 300, "Preloading Round 3: 0/150", {
                    fontSize: '20px',
                    fontFamily: 'Inter, sans-serif',
                    fill: COLORS.textSecondary
                }).setOrigin(0.5);
                await preloadRound3Images(progressText);
                progressText.destroy();
                startRound(currentRound);
            });
        } else {
            gameScene.add.text(400, msgY, `Need ${required} correct to advance · you have ${cumulativeCorrectAnswers}`, {
                fontSize: '18px',
                fontFamily: 'Inter, sans-serif',
                fontWeight: '600',
                fill: COLORS.error
            }).setOrigin(0.5);
            
            const restartBtn = gameScene.add.text(400, btnY, "Play again", {
                fontSize: '20px',
                fontFamily: 'Inter, sans-serif',
                fontWeight: '500',
                fill: COLORS.textSecondary
            }).setOrigin(0.5).setInteractive({ useHandCursor: true });
            
            restartBtn.on('pointerover', () => restartBtn.setFill(COLORS.accent));
            restartBtn.on('pointerout', () => restartBtn.setFill(COLORS.textSecondary));
            
            restartBtn.on('pointerdown', () => {
                currentRound = 1;
                cumulativeCorrectAnswers = 0;
                startRound(1);
            });
        }
    } else {
        const required = PROGRESSION_REQUIREMENTS.leaderboard;
        if (cumulativeCorrectAnswers >= required) {
            showLeaderboard(score);
        } else {
            gameScene.add.text(400, msgY, `Need ${required} correct for leaderboard · you have ${cumulativeCorrectAnswers}`, {
                fontSize: '18px',
                fontFamily: 'Inter, sans-serif',
                fontWeight: '600',
                fill: COLORS.error
            }).setOrigin(0.5);
            
            const restartBtn = gameScene.add.text(400, btnY, "Play again", {
                fontSize: '20px',
                fontFamily: 'Inter, sans-serif',
                fontWeight: '500',
                fill: COLORS.textSecondary
            }).setOrigin(0.5).setInteractive({ useHandCursor: true });
            
            restartBtn.on('pointerover', () => restartBtn.setFill(COLORS.accent));
            restartBtn.on('pointerout', () => restartBtn.setFill(COLORS.textSecondary));
            
            restartBtn.on('pointerdown', () => {
                currentRound = 1;
                cumulativeCorrectAnswers = 0;
                startRound(1);
            });
        }
    }
}

// Show leaderboard screen
function showLeaderboard(finalScore) {
    gameScene.children.removeAll();
    
    gameScene.add.text(400, 80, "🏆 LEADERBOARD 🏆", {
        fontSize: '48px',
        fontFamily: 'Inter, sans-serif',
        fontWeight: '700',
        fill: COLORS.warning,
        stroke: COLORS.text,
        strokeThickness: 3
    }).setOrigin(0.5);
    
    gameScene.add.text(400, 150, "Congratulations!", {
        fontSize: '36px',
        fontFamily: 'Inter, sans-serif',
        fontWeight: '700',
        fill: COLORS.text
    }).setOrigin(0.5);
    
    gameScene.add.text(400, 200, `You achieved ${cumulativeCorrectAnswers} correct answers!`, {
        fontSize: '26px',
        fontFamily: 'Inter, sans-serif',
        fontWeight: '500',
        fill: COLORS.success
    }).setOrigin(0.5);
    
    gameScene.add.text(400, 250, `Final Score: ${finalScore}`, {
        fontSize: '32px',
        fontFamily: 'Inter, sans-serif',
        fontWeight: '700',
        fill: COLORS.warning
    }).setOrigin(0.5);
    
    gameScene.add.text(400, 320, "Top Scores:", {
        fontSize: '26px',
        fontFamily: 'Inter, sans-serif',
        fontWeight: '600',
        fill: COLORS.text
    }).setOrigin(0.5);
    
    gameScene.add.text(400, 360, `1. You - ${finalScore}`, {
        fontSize: '22px',
        fontFamily: 'Inter, sans-serif',
        fontWeight: '600',
        fill: COLORS.warning
    }).setOrigin(0.5);
    
    gameScene.add.text(400, 400, "(Leaderboard storage coming soon)", {
        fontSize: '16px',
        fontFamily: 'Inter, sans-serif',
        fill: COLORS.textSecondary
    }).setOrigin(0.5);
    
    const restartBtn = gameScene.add.text(400, 480, "Click to play again", {
        fontSize: '20px',
        fontFamily: 'Inter, sans-serif',
        fontWeight: '500',
        fill: COLORS.textSecondary
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    
    restartBtn.on('pointerover', () => restartBtn.setFill(COLORS.accent));
    restartBtn.on('pointerout', () => restartBtn.setFill(COLORS.textSecondary));
    
    restartBtn.on('pointerdown', () => {
        currentRound = 1;
        cumulativeCorrectAnswers = 0;
        startRound(1);
    });
}
