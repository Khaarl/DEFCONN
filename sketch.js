// sketch.js - Updated with Radar Functionality
let worldGeoJSON;
let citiesGeoJSON;

// Game State
let gameState = 'MainMenu'; // 'MainMenu', 'Options', 'Setup', 'Playing'
let selectedOption = -1; // For menu interaction
const mainMenuOptions = ["START SIMULATION", "OPTIONS", "EXIT"];
const optionsMenuOptions = ["MASTER VOLUME", "MUSIC VOLUME", "SFX VOLUME", "BACK"];

// Volume Settings
let masterVolume = 75;
let musicVolume = 60;
let sfxVolume = 80;

// Music Variables
let musicTracks = []; // Array to hold loaded p5.SoundFile objects
let currentTrackIndex = -1; // Index of the currently playing track
let musicFilenames = [ // *** LIST YOUR MUSIC FILES HERE ***
    'MUSIC/Al_Basrah.mp3',
    'MUSIC/Cairo_Egypt.mp3',
    'MUSIC/Finland.mp3',
    'MUSIC/Greece.mp3',
    'MUSIC/Helsinki_Sweden.mp3',
    'MUSIC/Jerusalem_Israel.mp3',
    'MUSIC/Munich_Germany.mp3',
    'MUSIC/Nakhayb_Iraq.mp3',
    'MUSIC/Naples_Italy.mp3',
    'MUSIC/Norway_Nephelim_Battle.mp3',
    'MUSIC/Rome_Italy.mp3',
    'MUSIC/Splash_Screen_Opus.mp3',
    'MUSIC/Turin_Italy.mp3',
    'MUSIC/Vienna_Austria.mp3',
    'MUSIC/Zurich_Switzerland.mp3'
];
let musicIsPlaying = false; // Flag to track if music is intended to play

// Map Interaction State
let zoom = 1;
let minZoom = 0.8;
let maxZoom = 50;
let centerLon = 0;
let centerLat = 20;
let isDragging = false;
let prevMouseX, prevMouseY;
let initialMouseX = -1; // For click vs drag detection
let initialMouseY = -1; // For click vs drag detection


// Territory & Player Data
let territories = {
    "NorthAmerica": {
        name: "North America",
        color: [0, 150, 0, 200], // Greenish
        center: { lon: -100, lat: 45 },
        placementArea: { minLon: -130, maxLon: -60, minLat: 25, maxLat: 60 }
    },
    "Eurasia": {
        name: "Eurasia",
        color: [150, 0, 0, 200], // Reddish
        center: { lon: 60, lat: 50 },
        placementArea: { minLon: 10, maxLon: 140, minLat: 30, maxLat: 65 }
    },
    "Neutral": { // For cities not in defined territories
        name: "Neutral",
        color: [128, 128, 128, 150], // Grey
    }
};
let playerTerritory = null; // Key of the player's territory
let aiTerritories = ["Eurasia"]; // List of territory keys controlled by AI
let gameUnits = []; // Holds all placed units { type, owner, lon, lat, id, ammo?, state?, range? }
let selectedUnitForFiring = null; // ID of the silo selected for firing
let gameCities = []; // Simplified list for quick lookup: { name, lon, lat, population, initialPopulation, ownerTerritory, destroyed: false, id, state? }
let selectedCityForTargeting = null; // ID of city selected for targeting


// Missile & Effects Data
let activeMissiles = []; // { id, owner, startX, startY, targetX, targetY, currentX, currentY, type, detected }
let activeABMs = []; // { id, owner, siloId, startX, startY, targetMissileId, currentX, currentY }
let activeExplosions = []; // { x, y, radius, maxRadius, duration, age, owner }
let activeIntercepts = []; // Store visual effect for successful intercepts

const MISSILE_WORLD_SPEED_DEG_PER_SEC = 5.0;
const CITY_IMPACT_RADIUS_DEG = 1.0;
const UNIT_IMPACT_RADIUS_DEG = 0.5;
const MEGADEATHS_PER_NUKE = 2.5;

// --- Constants for ABM ---
const ABM_LAUNCH_RANGE_DEG = 15; // How close an enemy missile needs to be to a defensive silo (degrees)
const ABM_SPEED_DEG_PER_SEC = 10.0; // ABMs should be faster than ICBMs
const ABM_INTERCEPT_CHANCE = 0.75; // 75% chance to destroy target on hit
const ABM_INTERCEPT_RADIUS_DEG = 0.3; // How close ABM needs to get to target missile

// Game Progression Variables
let currentDefconLevel = 5;
let gameStartTime = 0;
let elapsedGameTime = 0;
const DEFCON_TIMINGS = { 4: 180, 3: 360, 2: 540, 1: 720 };
let scores = {};


// Setup Phase Variables
let assetsToPlace = [];
let currentPlacementIndex = 0;
let setupConfirmed = false;

// Map Appearance & Constants
const DEFCON_BG_COLOR = [0, 0, 26];
const DEFCON_LAND_COLOR = [0, 80, 150];
const DEFCON_CITY_COLOR_TIER1 = [255, 255, 150];
const DEFCON_CITY_COLOR_TIER2 = [255, 200, 100];
const DEFCON_CITY_COLOR_TIER3 = [255, 150, 50];
const DEFCON_TEXT_COLOR = [200, 200, 200];
const MENU_TEXT_COLOR = [0, 200, 200];
const MENU_HIGHLIGHT_COLOR = [255, 255, 0]; // Yellow
const CITY_TARGET_HIGHLIGHT_COLOR = [255, 0, 0, 150]; // Red for target
const MENU_TITLE_COLOR = [0, 255, 255];
const MENU_BG_ALPHA = 180;
const POP_TIER1_THRESHOLD = 1000000;
const POP_TIER2_THRESHOLD = 5000000;
const POP_TIER3_THRESHOLD = 10000000;
const LABEL_ZOOM_THRESHOLD = 4.0;
const BASE_WORLD_WIDTH = 2048;
const BASE_WORLD_HEIGHT = BASE_WORLD_WIDTH / 2;

// --- P5.js Core Functions ---

function preload() {
    worldGeoJSON = loadJSON('countries.geojson');
    citiesGeoJSON = loadJSON('cities.geojson');

    // *** LOAD MUSIC TRACKS ***
    console.log("Loading music...");
    for (let filename of musicFilenames) {
        try {
            let track = loadSound(filename,
              () => console.log(`Successfully loaded: ${filename}`), // Success callback
              (err) => console.error(`Error loading sound: ${filename}`, err) // Error callback
            );
            musicTracks.push(track);
        } catch (error) {
             console.error(`Exception loading sound file ${filename}:`, error);
        }
    }
}

function setup() {
    createCanvas(windowWidth, windowHeight);
    textFont('monospace');
    console.log("World data loaded");
    console.log("Cities data loaded");

    // Music will start after user interaction (e.g., clicking Start Simulation)
}

function draw() {
    background(DEFCON_BG_COLOR[0], DEFCON_BG_COLOR[1], DEFCON_BG_COLOR[2]);

    if (gameState === 'MainMenu') {
        drawBackgroundMapAndCities();
        drawMainMenu();
    } else if (gameState === 'Options') {
        drawBackgroundMapAndCities();
        drawOptionsMenu();
    } else if (gameState === 'Setup') {
        drawSetupScreen();
    } else if (gameState === 'Playing') {
        drawGameScreen();
    }
}

// --- State Drawing Functions ---

function drawBackgroundMapAndCities() {
    let mapAlpha = (gameState === 'Playing' || gameState === 'Setup') ? 255 : 150;

    if (worldGeoJSON && worldGeoJSON.features) {
        stroke(DEFCON_LAND_COLOR[0], DEFCON_LAND_COLOR[1], DEFCON_LAND_COLOR[2], mapAlpha);
        strokeWeight(max(0.5, 1 / zoom));
        noFill();
        for (let feature of worldGeoJSON.features) {
            let geometry = feature.geometry;
            if (geometry.type === 'Polygon') {
                drawTransformedPolygon(geometry.coordinates[0]);
            } else if (geometry.type === 'MultiPolygon') {
                for (let polygon of geometry.coordinates) {
                    drawTransformedPolygon(polygon[0]);
                }
            }
        }
    }

    if ((gameState === 'Playing' || gameState === 'Setup') && gameCities.length > 0) {
        noStroke();
        for (let city of gameCities) {
            let screenPos = worldToScreen(city.lon, city.lat);
            if (screenPos.x < -width || screenPos.x > width * 2 || screenPos.y < -height || screenPos.y > height * 2) continue; // More generous culling

            let citySize;
            if (city.destroyed) {
                citySize = 2 + zoom * 0.3; citySize = max(1, citySize);
                stroke(150, 0, 0, 200); strokeWeight(max(1, 1.5 / zoom));
                line(screenPos.x - citySize, screenPos.y - citySize, screenPos.x + citySize, screenPos.y + citySize);
                line(screenPos.x - citySize, screenPos.y + citySize, screenPos.x + citySize, screenPos.y - citySize);
                noStroke();
            } else {
                let population = city.population;
                let cityColor;
                if (population >= POP_TIER3_THRESHOLD) { citySize = 4 + zoom * 0.8; cityColor = DEFCON_CITY_COLOR_TIER3; }
                else if (population >= POP_TIER2_THRESHOLD) { citySize = 3 + zoom * 0.6; cityColor = DEFCON_CITY_COLOR_TIER2; }
                else { citySize = 2 + zoom * 0.4; cityColor = DEFCON_CITY_COLOR_TIER1; }
                citySize = max(1, citySize);
                
                if (selectedCityForTargeting === city.id) {
                    fill(CITY_TARGET_HIGHLIGHT_COLOR); // Highlight if selected for targeting
                    ellipse(screenPos.x, screenPos.y, citySize + 5/zoom, citySize + 5/zoom); // Slightly larger highlight
                } else {
                    fill(cityColor[0], cityColor[1], cityColor[2], mapAlpha);
                }
                ellipse(screenPos.x, screenPos.y, citySize, citySize);


                if (zoom > LABEL_ZOOM_THRESHOLD) {
                    let cityName = city.name;
                    fill(DEFCON_TEXT_COLOR[0], DEFCON_TEXT_COLOR[1], DEFCON_TEXT_COLOR[2], mapAlpha - 50 > 0 ? mapAlpha - 50 : mapAlpha);
                    noStroke(); textSize(max(6, 8 + zoom * 0.3)); textAlign(CENTER, BOTTOM);
                    text(cityName, screenPos.x, screenPos.y - citySize / 2 - 2);
                }
            }
        }
    } else if (gameState !== 'Playing' && gameState !== 'Setup' && citiesGeoJSON && citiesGeoJSON.features) {
        noStroke();
        for (let feature of citiesGeoJSON.features) {
            let population = feature.properties.POP_MAX || feature.properties.pop_max || feature.properties.population || 0;
            if (population >= POP_TIER1_THRESHOLD) { 
                let coords = feature.geometry.coordinates;
                let screenPos = worldToScreen(coords[0], coords[1]);
                if (screenPos.x < -width || screenPos.x > width * 2 || screenPos.y < -height || screenPos.y > height*2) continue;
                let citySize, cityColor;
                if (population >= POP_TIER3_THRESHOLD) { citySize = 4 + zoom * 0.8; cityColor = DEFCON_CITY_COLOR_TIER3; }
                else if (population >= POP_TIER2_THRESHOLD) { citySize = 3 + zoom * 0.6; cityColor = DEFCON_CITY_COLOR_TIER2; }
                else { citySize = 2 + zoom * 0.4; cityColor = DEFCON_CITY_COLOR_TIER1; }
                citySize = max(1, citySize);
                fill(cityColor[0], cityColor[1], cityColor[2], mapAlpha); 
                ellipse(screenPos.x, screenPos.y, citySize, citySize);
            }
        }
    }
}


function drawMainMenu() {
    fill(DEFCON_BG_COLOR[0], DEFCON_BG_COLOR[1], DEFCON_BG_COLOR[2], MENU_BG_ALPHA);
    noStroke(); rect(0, 0, width, height);
    textSize(48); textAlign(CENTER, CENTER); fill(MENU_TITLE_COLOR);
    text("GLOBAL CONFLICT SIMULATOR", width / 2, height * 0.25);
    textSize(28); let startY = height * 0.5; let spacingY = 50; selectedOption = -1;
    for (let i = 0; i < mainMenuOptions.length; i++) {
        let optionText = mainMenuOptions[i]; let posY = startY + i * spacingY;
        let textW = textWidth(optionText); let textH = 28;
        if (mouseX > width / 2 - textW / 2 && mouseX < width / 2 + textW / 2 && mouseY > posY - textH / 2 && mouseY < posY + textH / 2) {
            selectedOption = i; fill(MENU_HIGHLIGHT_COLOR);
        } else { fill(MENU_TEXT_COLOR); }
        text(optionText, width / 2, posY);
    }
}

function drawOptionsMenu() {
    fill(DEFCON_BG_COLOR[0], DEFCON_BG_COLOR[1], DEFCON_BG_COLOR[2], MENU_BG_ALPHA);
    noStroke(); rect(0, 0, width, height);
    textSize(40); textAlign(CENTER, CENTER); fill(MENU_TITLE_COLOR);
    text("SYSTEM OPTIONS", width / 2, height * 0.2);
    textSize(24); let startY = height * 0.4; let spacingY = 50;
    let labelX = width * 0.35; let valueX = width * 0.65; selectedOption = -1;
    for (let i = 0; i < optionsMenuOptions.length; i++) {
        let optionLabel = optionsMenuOptions[i]; let posY = startY + i * spacingY;
        let isHovering = false; let displayValue = "";
        let hoverAreaStartX = labelX - textWidth(optionLabel) - 20; let hoverAreaEndX = valueX + 120;
        if (optionLabel === "BACK") { hoverAreaStartX = width/2 - textWidth(optionLabel)/2 - 20; hoverAreaEndX = width/2 + textWidth(optionLabel)/2 + 20; }
        if (mouseX > hoverAreaStartX && mouseX < hoverAreaEndX && mouseY > posY - 15 && mouseY < posY + 15) { selectedOption = i; isHovering = true; }
        fill(isHovering ? MENU_HIGHLIGHT_COLOR : MENU_TEXT_COLOR);
        textAlign(RIGHT, CENTER); text(optionLabel, labelX, posY);
        if (i < 3) {
            let vol = (i === 0 ? masterVolume : (i === 1 ? musicVolume : sfxVolume));
            displayValue = `[ ${nf(vol, 0, 0)}% ]`; let barWidth = 100;
            let sliderStartX = valueX + textWidth(displayValue) + 10;
            textAlign(LEFT, CENTER); text(displayValue, valueX, posY);
            strokeWeight(1); stroke(MENU_TEXT_COLOR);
            fill(isHovering ? MENU_HIGHLIGHT_COLOR : MENU_TEXT_COLOR, 150);
            rect(sliderStartX, posY - 5, map(vol, 0, 100, 0, barWidth), 10);
            noFill(); rect(sliderStartX, posY - 5, barWidth, 10); noStroke();
        } else if (optionLabel === "BACK") { textAlign(CENTER, CENTER); text(optionLabel, width / 2, posY); }
    }
}

function drawSetupScreen() {
    drawBackgroundMapAndCities();
    textAlign(CENTER, TOP); textSize(20); fill(255, 255, 0, 220);
    if (!setupConfirmed) {
        if (currentPlacementIndex < assetsToPlace.length) {
            let assetToPlace = assetsToPlace[currentPlacementIndex];
            text(`PLACE ${assetToPlace.type.toUpperCase()} (${currentPlacementIndex + 1}/${assetsToPlace.length})`, width / 2, 20);
            text(`Click within your territory (${territories[playerTerritory].name})`, width / 2, 50);
            drawTerritoryBoundary(playerTerritory);
            let mouseWorld = screenToWorld(mouseX, mouseY);
            if (isCoordInTerritory(mouseWorld.lon, mouseWorld.lat, playerTerritory)) {
                 drawUnitGhost(mouseX, mouseY, assetToPlace.type);
            }
        } else {
            text("All assets placed.", width / 2, 20); textSize(24); fill(0, 255, 0, 240);
            text("CLICK TO CONFIRM DEPLOYMENT", width / 2, height - 60);
        }
    }
    gameUnits.forEach(unit => { drawUnit(unit, true); });
}

function drawGameScreen() {
    updateGameTimeAndDefcon();
    updateAI(); // <<< CALL AI LOGIC HERE
    updateDetection();
    updateDefenseActions(); // <<< CALL DEFENSE LOGIC
    updateMissiles(); // Updates ICBMs
    updateABMs(); // <<< UPDATE ABM POSITIONS (Need to create this function)
    drawBackgroundMapAndCities();
    gameUnits.forEach(unit => { drawUnit(unit); });
    drawMissiles();
    drawABMs(); // <<< DRAW ABMS (Need to create this function)
    drawExplosions(); // Includes ICBM impacts
    drawInterceptExplosions(); // <<< DRAW ABM INTERCEPTS (Need to create this function)
    drawGameUIOverlay();
}

function drawGameUIOverlay() {
    push();
    textFont('monospace');

    textSize(32); textAlign(CENTER, TOP);
    let defconColor = [255, 255, 0];
    if (currentDefconLevel === 1) defconColor = [255, 0, 0];
    if (currentDefconLevel === 2) defconColor = [255, 100, 0];
    if (currentDefconLevel === 3) defconColor = [255, 200, 0];
    if (currentDefconLevel === 4) defconColor = [0, 255, 0];
    if (currentDefconLevel === 5) defconColor = [0, 200, 255];
    fill(defconColor); text(`DEFCON ${currentDefconLevel}`, width / 2, 15);

    textSize(18); textAlign(RIGHT, TOP); fill(200);
    let minutes = floor(elapsedGameTime / 60); let seconds = floor(elapsedGameTime % 60);
    text(`T+ ${nf(minutes, 2)}:${nf(seconds, 2)}`, width - 20, 25);

    textSize(16); textAlign(LEFT, TOP);
    let scoreY = 20; let scoreX = 20;
    for (const tk in scores) {
         if (territories[tk] && scores[tk]) { 
            let territory = territories[tk];
            fill(territory.color[0], territory.color[1], territory.color[2]);
            text(`${territory.name.toUpperCase()}`, scoreX, scoreY);
            fill(200);
            text(`  Inflicted: ${scores[tk].inflicted.toFixed(1)} MD`, scoreX + 10, scoreY + 20);
            text(`  Suffered:  ${scores[tk].suffered.toFixed(1)} MD`, scoreX + 10, scoreY + 40);
            scoreY += 70;
         }
    }
    if (selectedUnitForFiring && gameState === 'Playing') {
        textAlign(CENTER, BOTTOM); fill(255, 255, 0, 200); textSize(18);
        text("SELECT TARGET LOCATION", width / 2, height - 30);
    }
     if (selectedCityForTargeting && gameState === 'Playing') { // Prompt for confirming target
        textAlign(CENTER, BOTTOM); fill(MENU_HIGHLIGHT_COLOR[0], MENU_HIGHLIGHT_COLOR[1], MENU_HIGHLIGHT_COLOR[2], 220); textSize(18);
        let city = gameCities.find(c => c.id === selectedCityForTargeting);
        if (city) text(`Target: ${city.name}. CLICK AGAIN TO LAUNCH.`, width / 2, height - 55);
    }
    pop();
}


// --- Music Playback Functions ---

function startMusic() {
    if (musicTracks.length === 0) {
        console.log("No music tracks loaded or available.");
        return;
    }
    if (!musicIsPlaying) {
        console.log("Starting music playback...");
        musicIsPlaying = true;
        // Start with a random track
        currentTrackIndex = floor(random(musicTracks.length));
        console.log(`Starting music with random track index: ${currentTrackIndex}`);
        playNextTrack(); // Start the sequence
    } else {
        // If music is already intended to be playing, ensure the current track is playing (e.g., after pausing)
        if (currentTrackIndex !== -1 && musicTracks[currentTrackIndex] && !musicTracks[currentTrackIndex].isPlaying()) {
            musicTracks[currentTrackIndex].play();
             applyMusicVolume(); // Apply volume when resuming
             console.log("Resuming music track:", musicFilenames[currentTrackIndex]);
        }
    }
}

function stopMusic() {
    if (musicIsPlaying && currentTrackIndex !== -1 && musicTracks[currentTrackIndex]) {
        console.log("Stopping music playback.");
        musicTracks[currentTrackIndex].stop();
    }
    musicIsPlaying = false;
    // currentTrackIndex = -1; // Keep index to potentially resume later? Or reset? Resetting is simpler.
    currentTrackIndex = -1;
}

function playNextTrack() {
    if (!musicIsPlaying || musicTracks.length === 0) return; // Don't proceed if music shouldn't be playing

    // Stop the previous track if it's somehow still playing (shouldn't be necessary with onended, but safe)
    if (currentTrackIndex !== -1 && musicTracks[currentTrackIndex] && musicTracks[currentTrackIndex].isPlaying()) {
        musicTracks[currentTrackIndex].stop();
    }

    // Increment index and loop around
    currentTrackIndex = (currentTrackIndex + 1) % musicTracks.length;

    let trackToPlay = musicTracks[currentTrackIndex];

    if (trackToPlay && trackToPlay.isLoaded()) {
        console.log("Playing next track:", musicFilenames[currentTrackIndex]);
        applyMusicVolume(); // Set volume before playing
        trackToPlay.play();
        // Set the callback for when this track finishes
        trackToPlay.onended(playNextTrack); // Automatically plays the next one when this ends
    } else {
         console.warn(`Track ${currentTrackIndex} (${musicFilenames[currentTrackIndex]}) not loaded or invalid, skipping.`);
         // Immediately try the next track to avoid silence
         // Use setTimeout to avoid potential infinite loop if all tracks fail
         setTimeout(playNextTrack, 100);
    }
}

function applyMusicVolume() {
    if (currentTrackIndex !== -1 && musicTracks[currentTrackIndex] && musicTracks[currentTrackIndex].isLoaded()) {
        // Calculate combined volume (0.0 to 1.0 range)
        let combinedVolume = (musicVolume / 100) * (masterVolume / 100);
        // Clamp volume between 0 and 1
        combinedVolume = constrain(combinedVolume, 0, 1);
        musicTracks[currentTrackIndex].setVolume(combinedVolume);
        console.log(`Applying volume: ${combinedVolume.toFixed(3)} (Music: ${musicVolume.toFixed(0)}%, Master: ${masterVolume.toFixed(0)}%) to track ${currentTrackIndex}`); // DEBUG log
    }
}

// --- Game Logic & Setup Functions ---

function initializeGameSetup(playerTerritoryKey) {
    playerTerritory = playerTerritoryKey;
    gameUnits = []; // Clear units for all players
    currentDefconLevel = 5;
    elapsedGameTime = 0; gameStartTime = 0; setupConfirmed = false; currentPlacementIndex = 0;
    gameCities = []; activeMissiles = []; activeExplosions = [];
    
    scores = {}; 
    for (const tk_init in territories) {
        scores[tk_init] = { inflicted: 0, suffered: 0 };
    }

    if (citiesGeoJSON && citiesGeoJSON.features) {
        console.log("Processing cities for game data...");
        let processedCount = 0;
        let unownedCount = 0;
        for (let feature of citiesGeoJSON.features) {
            let population = feature.properties.POP_MAX || feature.properties.pop_max || feature.properties.population || 0;
            let cityName = feature.properties.NAME || feature.properties.name || "Unknown City";
            let coords = feature.geometry.coordinates;

            if (population >= POP_TIER1_THRESHOLD) {
                // console.log(`City: ${cityName}, Pop: ${population}, Coords: ${coords[0].toFixed(2)},${coords[1].toFixed(2)} - meets pop threshold.`); 
                let owner = null;
                for (const tk_owner in territories) { 
                     if (tk_owner !== "Neutral" && isCoordInTerritory(coords[0], coords[1], tk_owner)) { // Exclude "Neutral" from direct assignment here
                          owner = tk_owner;
                          // console.log(`  -> Assigned to territory: ${tk_owner}`); 
                          break;
                     }
                }
                // If no specific territory owns it, assign to "Neutral" or handle as unowned
                if (!owner) {
                    // For now, let's add all >1M pop cities, and assign "Neutral" if not in a territory's placementArea
                    // This ensures they are part of gameCities and can be targeted/destroyed.
                    owner = "Neutral"; // Assign to Neutral if not in defined territory placementArea
                    // console.log(`  -> City ${cityName} (Pop: ${population}) at ${coords[0].toFixed(2)},${coords[1].toFixed(2)} assigned to Neutral.`);
                    unownedCount++; // Still count them as "unassigned" from player/AI territories for logging
                }
                
                gameCities.push({
                    name: cityName, lon: coords[0], lat: coords[1], population: population,
                    initialPopulation: population, ownerTerritory: owner, destroyed: false,
                    id: `city_${Date.now()}_${random(1000)}`, state: 'idle' // Add state for cities
                });
                if (owner !== "Neutral") processedCount++; // Only count if assigned to a specific territory for this log
                
            }
        }
        console.log(`Added ${gameCities.length} cities to gameCities (pop >= ${POP_TIER1_THRESHOLD}). ${processedCount} assigned to specific territories. ${unownedCount} initially unassigned from main territories (now Neutral).`);
    }

    // --- Initialize Player Assets ---
    // (Only need to define assets for the human player to place)
    let playerAssetsConfig = [
        { type: 'Silo', count: 3, ammo: 10, mode: 'OFFENSIVE', state: 'idle' }, // <<< Add default mode
        { type: 'Radar', count: 2, range: 25, state: 'active' }
    ];
    assetsToPlace = []; // Reset player's placement list
    playerAssetsConfig.forEach(assetGroup => {
        for (let i = 0; i < assetGroup.count; i++) {
            let unitData = { type: assetGroup.type };
            if (assetGroup.type === 'Silo') {
                 unitData.ammo = assetGroup.ammo || 10;
                 unitData.state = assetGroup.state || 'idle';
                 unitData.mode = assetGroup.mode || 'OFFENSIVE'; // <<< Add mode
            }
            else if (assetGroup.type === 'Radar') { unitData.range = assetGroup.range || 20; unitData.state = assetGroup.state || 'active'; }
            assetsToPlace.push(unitData);
        }
    });

    // --- Initialize AI Assets Automatically ---
    console.log("Placing AI units...");
    for (const aiTerritoryKey of aiTerritories) {
        placeAIUnits(aiTerritoryKey); // Call the new function to place AI units
    }

    // --- Reset view for player ---
    zoom = 1.5; centerLon = territories[playerTerritory].center.lon; centerLat = territories[playerTerritory].center.lat;
    console.log(`Initializing setup for Player: ${territories[playerTerritory].name}. Place ${assetsToPlace.length} assets.`);
}


// --- Add this new function ---
function placeAIUnits(aiTerritoryKey) {
    if (!territories[aiTerritoryKey]) return;

    // Define the assets the AI gets (can be same or different from player)
    let aiAssetsConfig = [
        { type: 'Silo', count: 3, ammo: 10, mode: 'OFFENSIVE', state: 'idle' },
        { type: 'Radar', count: 2, range: 25, state: 'active' }
    ];

    let bounds = territories[aiTerritoryKey].placementArea;
    let placedCount = 0;

    aiAssetsConfig.forEach(assetGroup => {
        for (let i = 0; i < assetGroup.count; i++) {
            // Find a random valid location within bounds (simple random placement)
            // Could add checks later to avoid placing units too close together
            let lon = random(bounds.minLon, bounds.maxLon);
            let lat = random(bounds.minLat, bounds.maxLat);

            let newUnit = {
                type: assetGroup.type,
                owner: aiTerritoryKey,
                lon: lon,
                lat: lat,
                id: `unit_${aiTerritoryKey}_${Date.now()}_${random(1000)}`,
                ammo: assetGroup.ammo, // Copy specific properties
                state: assetGroup.state,
                range: assetGroup.range
            };
             // Ensure default state if somehow missed
             if (!newUnit.state) {
                 newUnit.state = (newUnit.type === 'Radar' ? 'active' : 'idle');
             }

            gameUnits.push(newUnit);
            placedCount++;
        }
    });
    console.log(`Placed ${placedCount} units for AI territory: ${aiTerritoryKey}`);
}

let aiActionTimers = {}; // Track time since last action for each AI territory

function updateAI() {
    if (gameState !== 'Playing') return;

    let currentTime = millis();

    for (const aiTerritoryKey of aiTerritories) {
        // Initialize timer if not present
        if (!aiActionTimers[aiTerritoryKey]) {
             aiActionTimers[aiTerritoryKey] = { lastFireCheck: currentTime, fireCooldown: 15000 + random(10000) }; // Cooldown in ms (15-25s)
        }

        // --- AI Firing Logic ---
        // Check if enough time has passed since last check and if DEFCON allows firing
        // (AI might cheat or follow rules - let's make it follow rules for now)
        // TEMP: Allow firing at DEFCON 5 for testing
        if (currentDefconLevel <= 5 && currentTime - aiActionTimers[aiTerritoryKey].lastFireCheck > aiActionTimers[aiTerritoryKey].fireCooldown) {
            aiActionTimers[aiTerritoryKey].lastFireCheck = currentTime; // Reset timer
            aiActionTimers[aiTerritoryKey].fireCooldown = 15000 + random(10000); // Set next cooldown

             console.log(`AI Check: ${aiTerritoryKey} considering firing...`); // DEBUG

            // 1. Find an available AI silo with ammo
            let availableSilos = gameUnits.filter(u =>
                u.owner === aiTerritoryKey &&
                u.type === 'Silo' &&
                u.state === 'idle' && // Could be refined later
                u.ammo > 0
            );

            if (availableSilos.length > 0) {
                let firingSilo = random(availableSilos); // Pick a random available silo

                // 2. Find a target (e.g., a random non-destroyed enemy city)
                let potentialTargets = gameCities.filter(c =>
                    !c.destroyed &&
                    c.ownerTerritory !== aiTerritoryKey && // Not own or Neutral (target player/other AIs)
                    c.ownerTerritory !== "Neutral" // Or maybe target Neutral? Choose based on desired difficulty
                );

                if (potentialTargets.length > 0) {
                    let targetCity = random(potentialTargets); // Pick a random valid target city

                    console.log(`AI ACTION: ${aiTerritoryKey} launching from Silo ${firingSilo.id} at City ${targetCity.name} (${targetCity.ownerTerritory})`);

                    // 3. Launch Missile
                    firingSilo.ammo--;
                    activeMissiles.push({
                        id: `missile_${aiTerritoryKey}_${Date.now()}_${random(1000)}`,
                        owner: aiTerritoryKey,
                        startX: firingSilo.lon, startY: firingSilo.lat,
                        targetX: targetCity.lon, targetY: targetCity.lat,
                        currentX: firingSilo.lon, currentY: firingSilo.lat,
                        type: 'ICBM',
                        detected: false // AI missiles also start undetected
                    });
                    // Maybe set silo state to 'reloading' for a period later
                } else {
                     console.log(`AI Check: ${aiTerritoryKey} found silo but no valid city targets.`); // DEBUG
                }
            } else {
                console.log(`AI Check: ${aiTerritoryKey} has no available silos to fire.`); // DEBUG
            }
        }

        // TODO: Add AI logic for other units (moving fleets, launching bombers) later
        // TODO: Add AI radar detection logic (AI detecting player missiles)
    }
}

function updateGameTimeAndDefcon() {
    if (gameStartTime === 0 || gameState !== 'Playing') return;
    let now = millis(); elapsedGameTime = (now - gameStartTime) / 1000;
    let nextDefconLevel = currentDefconLevel;
    if (currentDefconLevel === 5 && elapsedGameTime >= DEFCON_TIMINGS[4]) nextDefconLevel = 4;
    if (currentDefconLevel === 4 && elapsedGameTime >= DEFCON_TIMINGS[3]) nextDefconLevel = 3;
    if (currentDefconLevel === 3 && elapsedGameTime >= DEFCON_TIMINGS[2]) nextDefconLevel = 2;
    if (currentDefconLevel === 2 && elapsedGameTime >= DEFCON_TIMINGS[1]) nextDefconLevel = 1;
    if (nextDefconLevel !== currentDefconLevel) {
        currentDefconLevel = nextDefconLevel;
        console.log(`DEFCON LEVEL ${currentDefconLevel} REACHED at ${elapsedGameTime.toFixed(0)}s`);
    }
}

// Create this new function
function updateDetection() {
    if (gameState !== 'Playing') return;

    // Reset detection each frame? Or keep persistent? Let's try persistent.
    // For persistent: iterate through missiles and check if they are *currently* inside range.
    // For simplicity now: If detected once, stays detected.

    // Iterate through all player radar stations
    for (let radar of gameUnits) {
        // Check if it's an active player radar
        if (radar.type === 'Radar' && radar.owner === playerTerritory && radar.state === 'active') {
            // Check against all active enemy missiles
            for (let missile of activeMissiles) {
                // Only detect missiles owned by OTHER territories AND not already detected
                if (missile.owner !== playerTerritory && !missile.detected) {
                    // Check distance (using squared distance for efficiency)
                    let dLon = radar.lon - missile.currentX;
                    let dLat = radar.lat - missile.currentY;
                    let distSq = dLon*dLon + dLat*dLat;
                    // Convert radar range (degrees) to squared degrees for comparison
                    // This assumes a flat projection locally, which is inaccurate over large distances but okay for game purposes
                    let rangeSq = radar.range * radar.range;

                    if (distSq < rangeSq) {
                        missile.detected = true; // Mark as detected by the player
                        console.log(`Radar ${radar.id} detected enemy missile ${missile.id}`);
                    }
                }
            
                // --- AI Detection of Player Missiles ---
                for (const aiTerritoryKey of aiTerritories) {
                    for (let radar of gameUnits) {
                        // Check if it's an active AI radar owned by this specific AI
                        if (radar.type === 'Radar' && radar.owner === aiTerritoryKey && radar.state === 'active') {
                            for (let missile of activeMissiles) {
                                // Detect player missiles (owner is playerTerritory)
                                // We might need a separate flag like `detectedByAI` later if AI needs private detection info
                                if (missile.owner === playerTerritory && !missile.detected) { // For now, use same 'detected' flag
                                    let dLon = radar.lon - missile.currentX;
                                    let dLat = radar.lat - missile.currentY;
                                    let distSq = dLon*dLon + dLat*dLat;
                                    let rangeSq = radar.range * radar.range;
                                    if (distSq < rangeSq) {
                                        // missile.detected = true; // Does player need to know AI detected it? Maybe not.
                                        // Instead, log or trigger AI reaction later.
                                        console.log(`AI Radar ${radar.id} (${aiTerritoryKey}) detected player missile ${missile.id}`);
                                        // Set a flag for AI reaction?
                                        // missile.detectedByAI = true; // Add this property if needed
                                        // Or trigger an immediate AI response check?
                                    }
                                }
                            
                                // --- AI Detection of Player Missiles ---
                                for (const aiTerritoryKey of aiTerritories) {
                                    for (let radar of gameUnits) {
                                        // Check if it's an active AI radar owned by this specific AI
                                        if (radar.type === 'Radar' && radar.owner === aiTerritoryKey && radar.state === 'active') {
                                            for (let missile of activeMissiles) {
                                                // Detect player missiles (owner is playerTerritory)
                                                // We might need a separate flag like `detectedByAI` later if AI needs private detection info
                                                if (missile.owner === playerTerritory && !missile.detected) { // For now, use same 'detected' flag
                                                    let dLon = radar.lon - missile.currentX;
                                                    let dLat = radar.lat - missile.currentY;
                                                    let distSq = dLon*dLon + dLat*dLat;
                                                    let rangeSq = radar.range * radar.range;
                                                    if (distSq < rangeSq) {
                                                        // missile.detected = true; // Does player need to know AI detected it? Maybe not.
                                                        // Instead, log or trigger AI reaction later.
                                                        console.log(`AI Radar ${radar.id} (${aiTerritoryKey}) detected player missile ${missile.id}`);
                                                        // Set a flag for AI reaction?
                                                        // missile.detectedByAI = true; // Add this property if needed
                                                        // Or trigger an immediate AI response check?
                                                    }
                                                }
                                            
                                                // --- AI Detection of Player Missiles ---
                                                for (const aiTerritoryKey of aiTerritories) {
                                                    for (let radar of gameUnits) {
                                                        // Check if it's an active AI radar owned by this specific AI
                                                        if (radar.type === 'Radar' && radar.owner === aiTerritoryKey && radar.state === 'active') {
                                                            for (let missile of activeMissiles) {
                                                                // Detect player missiles (owner is playerTerritory)
                                                                // We might need a separate flag like `detectedByAI` later if AI needs private detection info
                                                                if (missile.owner === playerTerritory && !missile.detected) { // For now, use same 'detected' flag
                                                                    let dLon = radar.lon - missile.currentX;
                                                                    let dLat = radar.lat - missile.currentY;
                                                                    let distSq = dLon*dLon + dLat*dLat;
                                                                    let rangeSq = radar.range * radar.range;
                                                                    if (distSq < rangeSq) {
                                                                        // missile.detected = true; // Does player need to know AI detected it? Maybe not.
                                                                        // Instead, log or trigger AI reaction later.
                                                                        console.log(`AI Radar ${radar.id} (${aiTerritoryKey}) detected player missile ${missile.id}`);
                                                                        // Set a flag for AI reaction?
                                                                        // missile.detectedByAI = true; // Add this property if needed
                                                                        // Or trigger an immediate AI response check?
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            // TODO: Add detection logic for other enemy units (bombers, subs) when they are implemented
        }
    }

    // --- Placeholder for AI Detection ---
    // Iterate through AI radars (when AI exists)
    // Check against player missiles
    // Set missile.detected = true (or missile.detectedByAI = true)
}

// Helper function to check if a missile is already targeted by an active ABM
function isActiveABMTarget(missileId) {
    for (let abm of activeABMs) {
        if (abm.targetMissileId === missileId) {
            return true;
        }
    }
    return false;
}

function updateDefenseActions() {
    if (gameState !== 'Playing') return;

     // --- ABM Launching ---
     // Check each DETECTED enemy missile
     for (let missile of activeMissiles) {
         // Only consider detected enemy missiles that are not already targeted by an ABM
         if (missile.owner !== playerTerritory && missile.detected && !isActiveABMTarget(missile.id)) {

             // Find the *closest* available player defensive silo within range
             let bestSilo = null;
             let minDistSq = ABM_LAUNCH_RANGE_DEG * ABM_LAUNCH_RANGE_DEG;

             for (let silo of gameUnits) {
                  // Check if it's player's, defensive, has ammo, and is idle
                 if (silo.owner === playerTerritory &&
                     silo.type === 'Silo' &&
                     silo.mode === 'DEFENSIVE' &&
                     silo.ammo > 0 &&
                     silo.state === 'idle') { // Use state later for cooldown?

                     let dLon = silo.lon - missile.currentX;
                     let dLat = silo.lat - missile.currentY;
                     let distSq = dLon*dLon + dLat*dLat;

                     if (distSq < minDistSq) {
                         minDistSq = distSq;
                         bestSilo = silo;
                     }
                 }
             }

             // If a suitable silo was found, launch an ABM
             if (bestSilo) {
                 console.log(`DEFENSE: Silo ${bestSilo.id} launching ABM at Missile ${missile.id}`);
                 bestSilo.ammo--; // Use shared ammo pool
                 // bestSilo.state = 'reloading'; // Set state for cooldown later
                 activeABMs.push({
                     id: `abm_${Date.now()}_${random(1000)}`,
                     owner: playerTerritory,
                     siloId: bestSilo.id,
                     startX: bestSilo.lon, startY: bestSilo.lat,
                     targetMissileId: missile.id, // Track which missile it's going after
                     currentX: bestSilo.lon, currentY: bestSilo.lat
                 });
             }
         }
     }
      // TODO: AI ABM Launch Logic
}

function updateMissiles() {
    if (activeMissiles.length === 0) return;
    let speedThisFrame = MISSILE_WORLD_SPEED_DEG_PER_SEC * (deltaTime / 1000);
    for (let i = activeMissiles.length - 1; i >= 0; i--) {
        let m = activeMissiles[i];
        let targetVector = createVector(m.targetX - m.currentX, m.targetY - m.currentY);
        let distanceToTarget = targetVector.mag();
        let arrivalThreshold = speedThisFrame * 1.1;
        if (distanceToTarget < arrivalThreshold) {
            handleMissileImpact(m); activeMissiles.splice(i, 1); continue;
        }
        targetVector.normalize(); targetVector.mult(speedThisFrame);
        m.currentX += targetVector.x; m.currentY += targetVector.y;
        m.currentX = constrain(m.currentX, -180, 180); m.currentY = constrain(m.currentY, -90, 90);
    }
}

function handleMissileImpact(missile) {
    console.log(`Impact detected for missile ${missile.id} at Lon ${missile.targetX.toFixed(2)}, Lat ${missile.targetY.toFixed(2)} by ${missile.owner}`);
    activeExplosions.push({
         x: missile.targetX, y: missile.targetY, radius: 0, maxRadius: 5, 
         duration: 90, age: 0, owner: missile.owner 
    });
    let megadeathsInflictedThisImpact = 0;
    let unitsDestroyedThisImpact = 0;

    for (let city of gameCities) {
        if (city.destroyed || city.ownerTerritory === missile.owner) continue; // Don't hit own or already destroyed
        let dLon = city.lon - missile.targetX; let dLat = city.lat - missile.targetY;
        let distSq = dLon*dLon + dLat*dLat;
        if (distSq < CITY_IMPACT_RADIUS_DEG * CITY_IMPACT_RADIUS_DEG) {
            console.log(`>>> Missile ${missile.id} HIT City: ${city.name} (Owner: ${city.ownerTerritory})`);
            city.destroyed = true;
            let casualties = MEGADEATHS_PER_NUKE;
            megadeathsInflictedThisImpact += casualties;
            if (scores[missile.owner]) scores[missile.owner].inflicted += casualties; else console.error("Attacker score object missing for: " + missile.owner);
            if (scores[city.ownerTerritory]) scores[city.ownerTerritory].suffered += casualties; else console.error("Defender score object missing for: " + city.ownerTerritory);
        }
    }
    // --- Unit Hit Check ---
    for (let i = gameUnits.length - 1; i >= 0; i--) {
        let unit = gameUnits[i];
        // Skip own units and units already destroyed (if applicable)
        if (unit.owner === missile.owner || unit.state === 'destroyed') continue;

        let dLon = unit.lon - missile.targetX; let dLat = unit.lat - missile.targetY;
        let distSq = dLon*dLon + dLat*dLat;

        if (distSq < UNIT_IMPACT_RADIUS_DEG * UNIT_IMPACT_RADIUS_DEG) {
            console.log(`>>> Missile ${missile.id} HIT Enemy Unit: ${unit.type} ${unit.id} (Owner: ${unit.owner})`);

            // *** MODIFY RADAR DESTRUCTION ***
            if (unit.type === 'Radar') {
                 unit.state = 'destroyed'; // Mark radar as destroyed/inactive
                 console.log(`    Radar ${unit.id} state set to destroyed.`);
                 unitsDestroyedThisImpact++; // Still count it as a "destroyed" unit impact
            } else {
                 // For silos or other units, remove them entirely for now
                 gameUnits.splice(i, 1);
                 unitsDestroyedThisImpact++;
            }
            // Optional scoring updates...
        }
    }
    if (megadeathsInflictedThisImpact > 0) console.log(`   Total Megadeaths this impact: ${megadeathsInflictedThisImpact.toFixed(2)}`);
    if (unitsDestroyedThisImpact > 0) console.log(`   Total Enemy Units destroyed this impact: ${unitsDestroyedThisImpact}`);
}


// --- Coordinate & Geometry Helpers ---

function worldToScreen(lon, lat) {
    let worldX = map(lon, -180, 180, 0, BASE_WORLD_WIDTH); let worldY = map(lat, 90, -90, 0, BASE_WORLD_HEIGHT);
    let centerWorldX = map(centerLon, -180, 180, 0, BASE_WORLD_WIDTH); let centerWorldY = map(centerLat, 90, -90, 0, BASE_WORLD_HEIGHT);
    let dx = worldX - centerWorldX; let dy = worldY - centerWorldY;
    return createVector(width / 2 + dx * zoom, height / 2 + dy * zoom);
}

function screenToWorld(x, y) {
    let dx = (x - width / 2) / zoom; let dy = (y - height / 2) / zoom;
    let centerWorldX = map(centerLon, -180, 180, 0, BASE_WORLD_WIDTH); let centerWorldY = map(centerLat, 90, -90, 0, BASE_WORLD_HEIGHT);
    let worldX = centerWorldX + dx; let worldY = centerWorldY + dy;
    let lon = map(worldX, 0, BASE_WORLD_WIDTH, -180, 180, true); let lat = map(worldY, 0, BASE_WORLD_HEIGHT, 90, -90, true);
    return { lon, lat };
}

function drawTransformedPolygon(polygonPoints) {
    beginShape();
    for (let point of polygonPoints) { let screenPos = worldToScreen(point[0], point[1]); vertex(screenPos.x, screenPos.y); }
    endShape(CLOSE);
}

function drawTerritoryBoundary(territoryKey) {
    if (!territories[territoryKey]) return; // Guard
    let bounds = territories[territoryKey].placementArea;
    let tl = worldToScreen(bounds.minLon, bounds.maxLat); let tr = worldToScreen(bounds.maxLon, bounds.maxLat);
    let bl = worldToScreen(bounds.minLon, bounds.minLat); let br = worldToScreen(bounds.maxLon, bounds.minLat);
    stroke(territories[territoryKey].color[0], territories[territoryKey].color[1], territories[territoryKey].color[2], 100);
    strokeWeight(max(1, 2 / zoom)); noFill(); beginShape();
    vertex(tl.x, tl.y); vertex(tr.x, tr.y); vertex(br.x, br.y); vertex(bl.x, bl.y);
    endShape(CLOSE);
}

function isCoordInTerritory(lon, lat, territoryKey) {
    if (!territories[territoryKey] || !territories[territoryKey].placementArea) return false;
    let bounds = territories[territoryKey].placementArea;
    return (lon >= bounds.minLon && lon <= bounds.maxLon && lat >= bounds.minLat && lat <= bounds.maxLat);
}

function drawUnitGhost(screenX, screenY, type) {
    push();
    if (type === 'Silo') { 
        fill(0, 255, 0, 100); 
        noStroke(); 
        let size = 10 + zoom; 
        triangle(screenX, screenY - size*0.6, screenX - size*0.4, screenY + size*0.4, screenX + size*0.4, screenY + size*0.4); 
    } else if (type === 'Radar') { 
        let size = 12 + zoom; 
        // Draw ellipse first
        fill(0, 150, 255, 100); 
        noStroke(); 
        ellipse(screenX, screenY, size, size); 
        // Then set stroke and draw line
        stroke(0, 150, 255, 100); 
        strokeWeight(1); 
        line(screenX, screenY, screenX + size*0.5, screenY - size*0.5); // Adjusted line slightly to match drawUnit
    }
    pop();
}

function drawUnit(unit, isSetupPhase = false) {
    let screenPos = worldToScreen(unit.lon, unit.lat); push();
    let unitColor = (territories[unit.owner] && territories[unit.owner].color) ? territories[unit.owner].color : [128,128,128,200];
    let strokeColor = unitColor; let showHighlight = false;

    if (isSetupPhase) { unitColor = [unitColor[0], unitColor[1], unitColor[2], 150]; }
    else if (unit.state === 'selected' || selectedUnitForFiring === unit.id) { showHighlight = true; strokeColor = [255, 255, 0]; }
    else if (unit.type === 'Silo' && unit.ammo === 0) { unitColor = [100, 100, 100, 150]; strokeColor = [100, 100, 100, 150]; }
    // *** ADD check for destroyed state for radars ***
    else if (unit.type === 'Radar' && unit.state === 'destroyed') { unitColor = [100, 100, 100, 150]; strokeColor = [100, 100, 100, 150]; }

    if (showHighlight) { noFill(); stroke(strokeColor[0], strokeColor[1], strokeColor[2], 200); strokeWeight(max(1.5, 2.5 / zoom)); let r = (unit.type === 'Silo' ? 10 : 12) + zoom; r = max(8, r); ellipse(screenPos.x, screenPos.y, r * 2); }

    // --- Draw Base Unit Icons ---
    if (unit.type === 'Silo') {
        let currentUnitColor = [...unitColor];
        let currentStrokeColor = [...strokeColor];
        if (!isSetupPhase && unit.mode === 'DEFENSIVE') {
            currentStrokeColor = [0, 150, 255];
            currentUnitColor = [unitColor[0]*0.7, unitColor[1]*0.7, unitColor[2]*0.7, unitColor[3]];
        }

        fill(currentUnitColor); stroke(currentStrokeColor); strokeWeight(max(0.5, 1 / zoom)); let size = 8 + zoom * 0.5; size = max(4, size);
        triangle(screenPos.x, screenPos.y - size*0.6, screenPos.x - size*0.4, screenPos.y + size*0.4, screenPos.x + size*0.4, screenPos.y + size*0.4);
        
        noStroke();
        let ammoTextSize = max(9, 14 / zoom); // Further Increased ammo text size
        let modeTextSize = max(10, 18 / zoom); // Further Increased mode text size
        
        let textYPosition = screenPos.y + size * 0.6; // Start Y position below the silo tip, adjusted for TOP alignment

        if (unit.ammo > 0 && zoom > 0.8 && !isSetupPhase) { // Show ammo even earlier and larger
            fill(255);
            textSize(ammoTextSize);
            textAlign(CENTER, TOP);
            text(unit.ammo, screenPos.x, textYPosition);
            textYPosition += ammoTextSize + (4 / zoom); // Increased spacing for the mode text
        }
        
        // Display Silo Mode for player units
        if (unit.owner === playerTerritory && zoom > 0.5 && !isSetupPhase) {
            fill(220, 220, 220, 250); // Brighter alpha
            textSize(modeTextSize);
            textAlign(CENTER, TOP);
            let modeText = unit.mode === 'OFFENSIVE' ? "OFF" : "DEF";
            // If ammo wasn't shown, adjust Y to be closer to silo base
            if (!(unit.ammo > 0 && zoom > 0.8 && !isSetupPhase)){
                 textYPosition = screenPos.y + size * 0.6 + modeTextSize * 0.5; // Center it more if no ammo
            }
            text(modeText, screenPos.x, textYPosition);
        }

    } else if (unit.type === 'Radar') {
        let size = 10 + zoom * 0.5; size = max(5, size);
        if(unit.state === 'destroyed') {
            // *** Draw Destroyed Radar ***
             fill(unitColor); // Greyed out color set above
             stroke(strokeColor); strokeWeight(max(0.5, 1 / zoom));
             ellipse(screenPos.x, screenPos.y, size, size);
             stroke(150,0,0, 200); strokeWeight(max(1, 1.5/zoom)); // Red X
             line(screenPos.x-size*0.5, screenPos.y-size*0.5, screenPos.x+size*0.5, screenPos.y+size*0.5);
             line(screenPos.x-size*0.5, screenPos.y+size*0.5, screenPos.x+size*0.5, screenPos.y-size*0.5);
        } else {
            // *** Draw Active Radar ***
            fill(unitColor); stroke(strokeColor); strokeWeight(max(0.5, 1 / zoom));
            ellipse(screenPos.x, screenPos.y, size, size);
            stroke(unitColor); strokeWeight(max(1, 1 / zoom)); line(screenPos.x, screenPos.y, screenPos.x + size*0.5, screenPos.y - size*0.5); // Dish

             // *** Draw Radar Range Circle (Optional) ***
             if (unit.owner === playerTerritory && !isSetupPhase && zoom > 1.2 && unit.range) { // Check unit.range exists
                 let rangeInDegrees = unit.range;
                 // Estimate screen distance: This is tricky with map projections.
                 // A simple approach: find a point 'range' degrees east and measure screen distance.
                 // This is inaccurate near poles or dateline but might suffice visually.
                 let edgePointLon = unit.lon + rangeInDegrees;
                 // Simple wrap around dateline for visualization
                 if (edgePointLon > 180) edgePointLon -= 360;
                 if (edgePointLon < -180) edgePointLon += 360;

                 let edgePoint = worldToScreen(edgePointLon, unit.lat);
                 let screenRange = dist(screenPos.x, screenPos.y, edgePoint.x, edgePoint.y);

                 // Alternative: Approximate degrees to pixels at current zoom/center (less accurate)
                 // let approxDegPerPixel = (screenToWorld(width/2 + 10, height/2).lon - screenToWorld(width/2, height/2).lon) / 10;
                 // let screenRange = rangeInDegrees / approxDegPerPixel;


                 noFill();
                 stroke(0, 100, 150, 80); // Faint blue radar circle
                 strokeWeight(max(0.5, 1 / zoom));
                 ellipse(screenPos.x, screenPos.y, screenRange * 2);
             }
        }
    }
    pop();
}

function drawMissiles() {
    push();
    strokeWeight(max(1, 2 / zoom));

    for (let m of activeMissiles) {
        let startScreen = worldToScreen(m.startX, m.startY);
        let currentScreen = worldToScreen(m.currentX, m.currentY);
        let isEnemy = m.owner !== playerTerritory;
        let isDetected = m.detected; // Use the missile's detected property
        let drawFull = false; // Default to not drawing clearly

        if (m.owner === playerTerritory) {
             drawFull = true; // Always draw player's own missiles fully
        } else { // It's an enemy missile
            if (isDetected) {
                 drawFull = true; // Draw detected enemy missiles fully
            } else {
                 drawFull = false; // Undetected enemy missiles are drawn faintly or not at all
            }
        }

        if (drawFull) {
            // --- Draw Trail ---
            let trailColorAlpha = (isEnemy && isDetected) ? 220 : 180; // Make detected enemy trail slightly more opaque?
            let trailColor = (territories[m.owner] && territories[m.owner].color) ? territories[m.owner].color : [128,128,128,180];
            stroke(trailColor[0], trailColor[1], trailColor[2], trailColorAlpha);
            line(startScreen.x, startScreen.y, currentScreen.x, currentScreen.y);

            // --- Draw Missile Head ---
            noStroke();
            let headColor = [255, 255, 0]; // Default Yellow
            if (isEnemy && isDetected) {
                headColor = [255, 100, 0]; // Orange head for detected enemy
            }
            fill(headColor[0], headColor[1], headColor[2]);
            let headSize = max(3, 6 / zoom);
            ellipse(currentScreen.x, currentScreen.y, headSize, headSize);
        } else if (isEnemy && !isDetected) {
             // Optional: Draw undetected enemy missiles very faintly
             /*
             stroke(100, 100, 100, 50); // Very faint grey trail
             line(startScreen.x, startScreen.y, currentScreen.x, currentScreen.y);
             fill(150, 150, 150, 80); // Faint grey head
             noStroke();
             let headSize = max(2, 4 / zoom);
             ellipse(currentScreen.x, currentScreen.y, headSize, headSize);
             */
        }
    }
    pop();
}

function drawExplosions() {
    push();
    noStroke();
    for (let i = activeExplosions.length - 1; i >= 0; i--) {
        let exp = activeExplosions[i];
        let screenPos = worldToScreen(exp.x, exp.y);
        exp.age++;
        if (exp.age > exp.duration) { activeExplosions.splice(i, 1); continue; }
        let progress = exp.age / exp.duration;
        let currentRadius = lerp(0, exp.maxRadius, pow(progress, 0.5)); // Grow fast, fade slow
        let alpha = lerp(255, 0, pow(progress, 1.5));
        let size = currentRadius * zoom * 10; // Adjust multiplier for visual scale
        size = max(1, size);
        fill(255, lerp(255, 100, progress), 0, alpha);
        ellipse(screenPos.x, screenPos.y, size, size);
    }
    pop();
}

// --- Unit & City Interaction ---

function findClickedUnit(lon, lat, typeFilter = null, ownerFilter = null) {
    // console.log(`findClickedUnit: Searching near ${lon.toFixed(2)}, ${lat.toFixed(2)}`);
    let clickRadiusDeg = 1.0 / zoom; // Click radius in degrees (adjust as needed)
    let clickRadiusSq = clickRadiusDeg * clickRadiusDeg;
    let closestUnit = null;
    let closestDistSq = Infinity;

    for (let unit of gameUnits) {
        // console.log(`  Checking unit: ${unit.id} (${unit.type}) at ${unit.lon.toFixed(2)}, ${unit.lat.toFixed(2)}`);
        if (typeFilter && unit.type !== typeFilter) { /*console.log("    -> Type mismatch");*/ continue; }
        if (ownerFilter && unit.owner !== ownerFilter) { /*console.log("    -> Owner mismatch");*/ continue; }

        let dLon = unit.lon - lon;
        let dLat = unit.lat - lat;
        let distSq = dLon * dLon + dLat * dLat;
        // console.log(`    Distance squared: ${distSq.toFixed(4)} (Radius squared: ${clickRadiusSq.toFixed(4)})`);

        if (distSq < clickRadiusSq && distSq < closestDistSq) {
            // console.log(`    -> Found potential match: ${unit.id}`);
            closestUnit = unit;
            closestDistSq = distSq;
        }
    }
    // console.log("  -> findClickedUnit returning:", closestUnit ? closestUnit.id : null);
    return closestUnit;
}

function findClickedCity(lon, lat) {
    let clickRadiusDeg = 1.0 / zoom; // Click radius in degrees
    let clickRadiusSq = clickRadiusDeg * clickRadiusDeg;
    let closestCity = null;
    let closestDistSq = Infinity;

    for (let city of gameCities) {
        if (city.destroyed) continue; // Ignore destroyed cities

        let dLon = city.lon - lon;
        let dLat = city.lat - lat;
        let distSq = dLon * dLon + dLat * dLat;

        if (distSq < clickRadiusSq && distSq < closestDistSq) {
            closestCity = city;
            closestDistSq = distSq;
        }
    }
    return closestCity;
}


// --- Input Handling ---

function mousePressed() {
    // Resume AudioContext if it was suspended due to browser policy
    if (getAudioContext().state !== 'running') {
        userStartAudio();
        console.log("AudioContext resumed on user gesture.");
    }

    initialMouseX = mouseX; initialMouseY = mouseY;
    prevMouseX = mouseX; // Initialize prevMouse for drag calculation
    prevMouseY = mouseY; // Initialize prevMouse for drag calculation
    isDragging = false; // Reset drag flag on new press

    if (gameState === 'MainMenu') {
        handleMainMenuClick();
    } else if (gameState === 'Options') {
        handleOptionsClick();
    } else if (gameState === 'Setup') {
        handleSetupClick();
    } else if (gameState === 'Playing') {
        handleGameClick();
    }
}

function handleVolumeClick() {
    if (selectedOption >= 0 && selectedOption < 3) {
        let vol = (selectedOption === 0 ? masterVolume : (selectedOption === 1 ? musicVolume : sfxVolume));
        let displayValue = `[ ${nf(vol, 0, 0)}% ]`;
        let sliderStartX = width * 0.65 + textWidth(displayValue) + 10;
        let barWidth = 100;
        if (mouseX >= sliderStartX && mouseX <= sliderStartX + barWidth) {
           let newVolume = map(mouseX, sliderStartX, sliderStartX + barWidth, 0, 100, true);
           if (selectedOption === 0) masterVolume = newVolume;
           else if (selectedOption === 1) musicVolume = newVolume;
           else if (selectedOption === 2) sfxVolume = newVolume;
        }
    }
}

function handleMainMenuClick() {
    if (selectedOption === 0) { // START
        gameState = 'Setup';
        initializeGameSetup("NorthAmerica"); // Default to North America for now
        startMusic(); // Start music when entering setup/game
    } else if (selectedOption === 1) { // OPTIONS
        gameState = 'Options';
    } else if (selectedOption === 2) { // EXIT
        // In a browser context, we can't truly exit. Maybe go back to a blank screen or show a message.
        console.log("Exit selected (no action in browser)");
    }
}

function handleOptionsClick() {
    if (selectedOption === 3) { // BACK
        gameState = 'MainMenu';
    } else {
        handleVolumeClick(); // Handle clicks on the volume bars/values
    }
}

function handleSetupClick() {
    if (!setupConfirmed) {
        if (currentPlacementIndex < assetsToPlace.length) {
            let mouseWorld = screenToWorld(mouseX, mouseY);
            if (isCoordInTerritory(mouseWorld.lon, mouseWorld.lat, playerTerritory)) {
                let assetData = assetsToPlace[currentPlacementIndex];
                // Create the new unit object with explicit defaults
                let newUnit = {
                    type: assetData.type,
                    owner: playerTerritory,
                    lon: mouseWorld.lon,
                    lat: mouseWorld.lat,
                    id: `unit_${Date.now()}_${random(1000)}`,
                    // Set properties based on type, defaulting others to null
                    ammo: (assetData.type === 'Silo' ? assetData.ammo : null),
                    state: assetData.state, // State is set during initialization for both
                    range: (assetData.type === 'Radar' ? assetData.range : null)
                };
                 // Ensure default state if somehow missed during initialization
                 if (!newUnit.state) {
                     newUnit.state = (newUnit.type === 'Radar' ? 'active' : 'idle');
                 }

                gameUnits.push(newUnit);
                currentPlacementIndex++;
            } else { console.log("Cannot place outside territory."); }
        } else { 
            // Confirmation logic
            setupConfirmed = true; gameState = 'Playing'; gameStartTime = millis();
            console.log("Setup confirmed. Game starting!");
            console.log("Current Units:", gameUnits);
            console.log("Current Cities:", gameCities);
         }
    }
}

function handleGameClick() {
    let clickWorldPos = screenToWorld(mouseX, mouseY);
    // console.log(`handleGameClick called. World Pos: ${clickWorldPos.lon.toFixed(2)}, ${clickWorldPos.lat.toFixed(2)}. DEFCON: ${currentDefconLevel}`);

    if (true) { // TESTING: Allow at any DEFCON level
        if (selectedUnitForFiring) { // A silo is already selected, this click is for the target
            let silo = gameUnits.find(u => u.id === selectedUnitForFiring);
            let targetCity = findClickedCity(clickWorldPos.lon, clickWorldPos.lat);

            if (targetCity && targetCity.ownerTerritory !== playerTerritory) { // Target is a valid enemy/neutral city
                console.log(`Targeting city: ${targetCity.name}`);
                selectedCityForTargeting = targetCity.id; // Highlight city
                // Launch missile on this same click if a city is identified
                if (silo && silo.ammo > 0) {
                    silo.ammo--;
                    activeMissiles.push({
                        id: `missile_${Date.now()}_${random(1000)}`, owner: silo.owner,
                        startX: silo.lon, startY: silo.lat, 
                        targetX: targetCity.lon, targetY: targetCity.lat, // Target city coords
                        currentX: silo.lon, currentY: silo.lat, type: 'ICBM',
                        // *** ADD DETECTION STATUS ***
                        detected: false // Initially not detected
                    });
                    console.log(`Missile launched at ${targetCity.name}! Silo Ammo: ${silo.ammo}`);
                    silo.state = 'idle'; selectedUnitForFiring = null; selectedCityForTargeting = null;
                } else if (silo) {
                     console.log(`Silo ${silo.id} empty!`);
                     silo.state = 'idle'; selectedUnitForFiring = null; selectedCityForTargeting = null;
                }
            } else if (silo && silo.ammo > 0) { // No city clicked, target raw coordinates
                 activeMissiles.push({
                    id: `missile_${Date.now()}_${random(1000)}`, owner: silo.owner,
                    startX: silo.lon, startY: silo.lat, targetX: clickWorldPos.lon, targetY: clickWorldPos.lat,
                    currentX: silo.lon, currentY: silo.lat, type: 'ICBM',
                    // *** ADD DETECTION STATUS ***
                    detected: false // Initially not detected
                });
                console.log(`Missile launched at coordinates! Silo Ammo: ${silo.ammo}`);
                silo.state = 'idle'; selectedUnitForFiring = null; selectedCityForTargeting = null;
            } else if (silo) { // Silo selected but out of ammo
                console.log(`Silo ${silo.id} empty! Cannot target.`);
                silo.state = 'idle'; selectedUnitForFiring = null; selectedCityForTargeting = null;
            } else { // Should not happen
                 selectedUnitForFiring = null; selectedCityForTargeting = null;
            }

        } else { // No silo selected yet, this click is to select a silo or a city (for future info)
            let clickedSilo = findClickedUnit(clickWorldPos.lon, clickWorldPos.lat, 'Silo', playerTerritory);
            // console.log("Clicked Silo result from findClickedUnit:", clickedSilo);
            if (clickedSilo) {
                if (clickedSilo.ammo > 0) {
                    console.log(`Selected Silo ${clickedSilo.id} (Ammo: ${clickedSilo.ammo}). Click target city or location.`);
                    if(selectedUnitForFiring && selectedUnitForFiring !== clickedSilo.id) {
                        let prevSilo = gameUnits.find(u => u.id === selectedUnitForFiring);
                        if(prevSilo) prevSilo.state = 'idle';
                    }
                    selectedUnitForFiring = clickedSilo.id;
                    clickedSilo.state = 'selected';
                    selectedCityForTargeting = null; // Clear city target when selecting a new silo
                    // console.log(`Silo ${clickedSilo.id} state set to: ${clickedSilo.state}`);
                } else {
                    console.log(`Selected Silo ${clickedSilo.id} - OUT OF AMMO.`);
                     if(selectedUnitForFiring) { let prevSilo = gameUnits.find(u => u.id === selectedUnitForFiring); if(prevSilo) prevSilo.state = 'idle'; selectedUnitForFiring = null;}
                     selectedCityForTargeting = null;
                }
            } else { // Click was not on a player silo
                if(selectedUnitForFiring) { // If a silo was selected, this click might be a target or cancel
                    // This case is now handled by the (selectedUnitForFiring) block above.
                    // If we reach here, it means a silo was selected, but this click was not on a valid city target.
                    // So, we can interpret this as cancelling the silo selection or targeting raw coords.
                    // The above block already handles raw coord targeting if no city found.
                    // To cancel selection if clicking empty space:
                    let silo = gameUnits.find(u => u.id === selectedUnitForFiring);
                    if(silo) silo.state = 'idle';
                    selectedUnitForFiring = null;
                    selectedCityForTargeting = null;
                    console.log("Firing cancelled by clicking empty space.");
                } else {
                    // No silo selected, and no silo clicked. Could be for city info in future.
                    selectedCityForTargeting = null; // Clear city target if clicking elsewhere
                }
            }
        }
    } 
}


function mouseDragged() {
    if (mouseX === initialMouseX && mouseY === initialMouseY) {
        // If the mouse hasn't moved significantly, don't start dragging yet
        // This helps distinguish clicks from small drags
        return; 
    }
    isDragging = true; // Set drag flag if mouse moved significantly

    if (gameState === 'Playing' || gameState === 'Setup' || gameState === 'MainMenu' || gameState === 'Options') {
        let dx = mouseX - prevMouseX;
        let dy = mouseY - prevMouseY;
        let worldDx = dx / zoom;
        let worldDy = dy / zoom;
        let lonPerPixel = 360 / (BASE_WORLD_WIDTH); // Approximate degrees per world pixel
        let latPerPixel = 180 / (BASE_WORLD_HEIGHT); // Approximate degrees per world pixel
        centerLon -= worldDx * lonPerPixel;
        centerLat += worldDy * latPerPixel; // Latitude increases upwards in screen coords, downwards in world coords
        centerLon = constrain(centerLon, -180, 180);
        centerLat = constrain(centerLat, -90, 90);
    } else if (gameState === 'Options') {
         handleVolumeClick(); // Allow dragging on volume sliders
    }
    prevMouseX = mouseX;
    prevMouseY = mouseY;
}

function mouseReleased() {
    if (!isDragging) {
        // This was a click, not a drag.
        // The actual click logic is handled in mousePressed.
        // We might add logic here if needed for actions *after* a click is confirmed.
    }
    isDragging = false; // Reset drag flag
    initialMouseX = -1; // Reset initial click position
    initialMouseY = -1;
}

function mouseWheel(event) {
    if (gameState === 'Playing' || gameState === 'Setup' || gameState === 'MainMenu' || gameState === 'Options') {
        let factor = pow(1.001, -event.delta);
        let newZoom = zoom * factor;
        newZoom = constrain(newZoom, minZoom, maxZoom);

        // Zoom towards the mouse cursor
        let mouseWorldBefore = screenToWorld(mouseX, mouseY);
        zoom = newZoom;
        let mouseWorldAfter = screenToWorld(mouseX, mouseY);

        centerLon += mouseWorldBefore.lon - mouseWorldAfter.lon;
        centerLat += mouseWorldBefore.lat - mouseWorldAfter.lat;
        centerLon = constrain(centerLon, -180, 180);
        centerLat = constrain(centerLat, -90, 90);

        return false; // Prevent default browser scroll
    }
}
function keyPressed() {
    if (keyCode === 32) { // 32 is the keyCode for SPACE
        // Allow mode switching in Setup or Playing phase, or any phase where units might be visible
        if (gameState === 'Playing' || gameState === 'Setup' || gameState === 'MainMenu' || gameState === 'Options') {
            let hoveredSilo = null;
            const clickRadius = 15; // Screen pixels - fixed size for easier hover regardless of zoom

            // Iterate in reverse so top-most unit is selected if overlapping
            for (let i = gameUnits.length - 1; i >= 0; i--) {
                const unit = gameUnits[i];
                if (unit.owner === playerTerritory && unit.type === 'Silo') {
                    let unitScreenPos = worldToScreen(unit.lon, unit.lat);
                    if (dist(mouseX, mouseY, unitScreenPos.x, unitScreenPos.y) < clickRadius) {
                        hoveredSilo = unit;
                        break;
                    }
                }
            }
            
            if (hoveredSilo) {
                if (hoveredSilo.mode === 'OFFENSIVE') {
                    hoveredSilo.mode = 'DEFENSIVE';
                    console.log(`Silo ${hoveredSilo.id} mode set to DEFENSIVE via SPACE key.`);
                } else {
                    hoveredSilo.mode = 'OFFENSIVE';
                    console.log(`Silo ${hoveredSilo.id} mode set to OFFENSIVE via SPACE key.`);
                }
                // Deselect if it was selected for firing
                if (selectedUnitForFiring === hoveredSilo.id) {
                    selectedUnitForFiring = null;
                    hoveredSilo.state = 'idle'; // Reset selection state
                    console.log("Firing selection cancelled due to mode change.");
                }
            }
        }
    }
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
}
// --- Create ABM Update Function ---
function updateABMs() {
    if (activeABMs.length === 0) return;
    let speedThisFrame = ABM_SPEED_DEG_PER_SEC * (deltaTime / 1000);

    for (let i = activeABMs.length - 1; i >= 0; i--) {
        let abm = activeABMs[i];

        // Find the target missile (it might have been destroyed already)
        let targetMissile = activeMissiles.find(m => m.id === abm.targetMissileId);

        if (!targetMissile) {
            // Target gone, remove ABM
            console.log(`ABM ${abm.id} target lost.`);
            activeABMs.splice(i, 1);
            continue;
        }

        // Calculate direction towards target missile's *current* position
        let targetVector = createVector(targetMissile.currentX - abm.currentX, targetMissile.currentY - abm.currentY);
        let distanceToTarget = targetVector.mag();

        // --- Interception Check ---
        if (distanceToTarget < ABM_INTERCEPT_RADIUS_DEG) {
            console.log(`ABM ${abm.id} attempting intercept on Missile ${targetMissile.id}`);
            if (random() < ABM_INTERCEPT_CHANCE) { // Roll for success
                console.log(`   >>> SUCCESS! Missile ${targetMissile.id} intercepted!`);
                // Remove the target missile
                let targetIndex = activeMissiles.findIndex(m => m.id === targetMissile.id);
                if (targetIndex !== -1) activeMissiles.splice(targetIndex, 1);
                // Add intercept visual effect
                activeIntercepts.push({ x: abm.currentX, y: abm.currentY, age: 0, duration: 30 });
            } else {
                console.log(`   >>> FAILED intercept!`);
                // ABM missed, just remove ABM
            }
            activeABMs.splice(i, 1); // Remove ABM after attempt
            continue;
        }

        // --- Move ABM ---
        targetVector.normalize();
        targetVector.mult(speedThisFrame);
        abm.currentX += targetVector.x;
        abm.currentY += targetVector.y;
        abm.currentX = constrain(abm.currentX, -180, 180);
        abm.currentY = constrain(abm.currentY, -90, 90);

        // Optional: Remove ABM if it flies too far past target?
    }
}

// --- Create ABM Drawing Function ---
function drawABMs() {
    push();
    strokeWeight(max(0.5, 1 / zoom)); // Thinner trail for ABMs?

    for (let abm of activeABMs) {
        let startScreen = worldToScreen(abm.startX, abm.startY);
        let currentScreen = worldToScreen(abm.currentX, abm.currentY);

        // Trail color (e.g., player's color but brighter/different?)
        let trailColor = territories[abm.owner] ? territories[abm.owner].color : [200,200,200];
        stroke(trailColor[0], trailColor[1]+50, trailColor[2]+50, 200); // Brighter version?
        line(startScreen.x, startScreen.y, currentScreen.x, currentScreen.y);

        // Head color (e.g., white or light blue?)
        noStroke();
        fill(180, 220, 255); // Light blue head
        let headSize = max(2, 4 / zoom);
        ellipse(currentScreen.x, currentScreen.y, headSize, headSize);
    }
    pop();
}

// --- Create Intercept Explosion Drawing Function ---
function drawInterceptExplosions() {
     push();
     noStroke();
     for (let i = activeIntercepts.length - 1; i >= 0; i--) {
         let icept = activeIntercepts[i];
         icept.age++;
         if (icept.age > icept.duration) {
             activeIntercepts.splice(i, 1);
             continue;
         }

         let screenPos = worldToScreen(icept.x, icept.y);
         let progress = icept.age / icept.duration;
         // Small, quick flash - maybe white/blue?
         let radius = lerp(0, 15, sqrt(progress)) / zoom ; // Small screen radius
         let alpha = lerp(255, 0, progress * progress); // Fade out quickly

         fill(200, 220, 255, alpha); // White-blue flash
         ellipse(screenPos.x, screenPos.y, radius*2);
     }
     pop();
}