// sketch.js - Updated with Damage Calculation, Scoring, and City Targeting Logic

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
let gameUnits = []; // Holds all placed units { type, owner, lon, lat, id, ammo?, state? }
let selectedUnitForFiring = null; // ID of the silo selected for firing
let gameCities = []; // Simplified list for quick lookup: { name, lon, lat, population, initialPopulation, ownerTerritory, destroyed: false, id, state? }
let selectedCityForTargeting = null; // ID of city selected for targeting


// Missile & Effects Data
let activeMissiles = []; // { id, owner, startX, startY, targetX, targetY, currentX, currentY, type }
let activeExplosions = []; // { x, y, radius, maxRadius, duration, age, owner }
const MISSILE_WORLD_SPEED_DEG_PER_SEC = 5.0; 
const CITY_IMPACT_RADIUS_DEG = 1.0; 
const UNIT_IMPACT_RADIUS_DEG = 0.5; 
const MEGADEATHS_PER_NUKE = 2.5;

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
}

function setup() {
    createCanvas(windowWidth, windowHeight);
    textFont('monospace');
    console.log("World data loaded");
    console.log("Cities data loaded");
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
    updateMissiles();
    drawBackgroundMapAndCities(); 
    gameUnits.forEach(unit => { drawUnit(unit); });
    drawMissiles();
    drawExplosions();
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

// --- Game Logic & Setup Functions ---

function initializeGameSetup(territoryKey) {
    playerTerritory = territoryKey; gameUnits = []; currentDefconLevel = 5;
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

    let initialAssets = [ { type: 'Silo', count: 3 }, { type: 'Radar', count: 2 } ];
    assetsToPlace = [];
    initialAssets.forEach(assetGroup => {
        for(let i = 0; i < assetGroup.count; i++) {
            let unitData = { type: assetGroup.type };
            if (assetGroup.type === 'Silo') { unitData.ammo = 10; unitData.state = 'idle'; }
            assetsToPlace.push(unitData);
        }
    });
    zoom = 1.5; centerLon = territories[playerTerritory].center.lon; centerLat = territories[playerTerritory].center.lat;
    console.log(`Initializing setup for ${territories[playerTerritory].name}. Place ${assetsToPlace.length} assets.`);
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
    for (let i = gameUnits.length - 1; i >= 0; i--) {
        let unit = gameUnits[i];
        if (unit.owner === missile.owner) continue;
        let dLon = unit.lon - missile.targetX; let dLat = unit.lat - missile.targetY;
        let distSq = dLon*dLon + dLat*dLat;
        if (distSq < UNIT_IMPACT_RADIUS_DEG * UNIT_IMPACT_RADIUS_DEG) {
            console.log(`>>> Missile ${missile.id} HIT Enemy Unit: ${unit.type} ${unit.id} (Owner: ${unit.owner})`);
            gameUnits.splice(i, 1); unitsDestroyedThisImpact++;
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
    if (type === 'Silo') { fill(0, 255, 0, 100); noStroke(); let size = 10 + zoom; triangle(screenX, screenY - size*0.6, screenX - size*0.4, screenY + size*0.4, screenX + size*0.4, screenY + size*0.4); }
    else if (type === 'Radar') { fill(0, 150, 255, 100); noStroke(); let size = 12 + zoom; ellipse(screenX, screenY, size, size); stroke(0, 150, 255, 100); strokeWeight(1); line(screenX, screenY, screenX + size*0.7, screenY - size*0.7); }
    pop();
}

function drawUnit(unit, isSetupPhase = false) {
    let screenPos = worldToScreen(unit.lon, unit.lat); push();
    let unitColor = (territories[unit.owner] && territories[unit.owner].color) ? territories[unit.owner].color : [128,128,128,200]; 
    let strokeColor = unitColor; let showHighlight = false;
    if (isSetupPhase) { unitColor = [unitColor[0], unitColor[1], unitColor[2], 150]; }
    else if (unit.state === 'selected' || selectedUnitForFiring === unit.id) { showHighlight = true; strokeColor = [255, 255, 0]; }
    else if (unit.type === 'Silo' && unit.ammo === 0) { unitColor = [100, 100, 100, 150]; strokeColor = [100, 100, 100, 150]; }
    if (showHighlight) { noFill(); stroke(strokeColor[0], strokeColor[1], strokeColor[2], 200); strokeWeight(max(1.5, 2.5 / zoom)); let r = (unit.type === 'Silo' ? 10 : 12) + zoom; r = max(8, r); ellipse(screenPos.x, screenPos.y, r * 2); }
    if (unit.type === 'Silo') {
        fill(unitColor); stroke(strokeColor); strokeWeight(max(0.5, 1 / zoom)); let size = 8 + zoom * 0.5; size = max(4, size);
        triangle(screenPos.x, screenPos.y - size*0.6, screenPos.x - size*0.4, screenPos.y + size*0.4, screenPos.x + size*0.4, screenPos.y + size*0.4);
        if (unit.ammo > 0 && zoom > 1.5 && !isSetupPhase) { fill(255); textSize(max(6, 8 + zoom*0.2)); textAlign(CENTER, TOP); noStroke(); text(unit.ammo, screenPos.x, screenPos.y + size*0.5); }
    } else if (unit.type === 'Radar') {
        fill(unitColor); stroke(strokeColor); strokeWeight(max(0.5, 1 / zoom)); let size = 10 + zoom * 0.5; size = max(5, size);
        ellipse(screenPos.x, screenPos.y, size, size); stroke(unitColor); strokeWeight(max(1, 1 / zoom)); line(screenPos.x, screenPos.y, screenPos.x + size*0.5, screenPos.y - size*0.5);
    }
    pop();
}

function drawMissiles() {
    push(); strokeWeight(max(1, 2 / zoom));
    for (let m of activeMissiles) {
        let startScreen = worldToScreen(m.startX, m.startY); let currentScreen = worldToScreen(m.currentX, m.currentY);
        let trailColor = (territories[m.owner] && territories[m.owner].color) ? territories[m.owner].color : [128,128,128,180];
        stroke(trailColor[0], trailColor[1], trailColor[2], 180);
        line(startScreen.x, startScreen.y, currentScreen.x, currentScreen.y);
        noStroke(); fill(255, 255, 0); let headSize = max(3, 6 / zoom); ellipse(currentScreen.x, currentScreen.y, headSize, headSize);
    }
    pop();
}

function drawExplosions() {
    if (activeExplosions.length === 0) return; push(); noStroke();
    for (let i = activeExplosions.length - 1; i >= 0; i--) {
        let exp = activeExplosions[i]; exp.age++;
        if (exp.age > exp.duration) { activeExplosions.splice(i, 1); continue; }
        let screenPos = worldToScreen(exp.x, exp.y);
        let currentRadius = map(exp.age, 0, exp.duration, 0, exp.maxRadius);
        let screenRadius = currentRadius * zoom * (BASE_WORLD_WIDTH / 360); 
        let lifeRatio = exp.age / exp.duration;
        let alpha = map(lifeRatio, 0.5, 1.0, 255, 0, true);
        let r = 255; let g = map(lifeRatio, 0, 0.7, 255, 0, true); let b = 0;
        fill(r, g, b, alpha); ellipse(screenPos.x, screenPos.y, screenRadius * 2);
    }
    pop();
}

// --- Event Handlers ---

function findClickedUnit(lon, lat, typeFilter = null, ownerFilter = null) {
    let clickScreenPos = worldToScreen(lon, lat);
    let closestUnit = null;
    let minScreenDistanceSq = 15 * 15; 

    // console.log(`findClickedUnit: Checking at screen (${clickScreenPos.x.toFixed(1)}, ${clickScreenPos.y.toFixed(1)}) for type: ${typeFilter}`); 

    for (let unit of gameUnits) {
        if (typeFilter && unit.type !== typeFilter) continue;
        if (ownerFilter && unit.owner !== ownerFilter) continue;

        let unitScreenPos = worldToScreen(unit.lon, unit.lat);
        let screenDSq = distSq(clickScreenPos.x, clickScreenPos.y, unitScreenPos.x, unitScreenPos.y);

        // console.log(`findClickedUnit: Checking ${unit.type} ${unit.id} at screen (${unitScreenPos.x.toFixed(1)}, ${unitScreenPos.y.toFixed(1)}), distSq: ${screenDSq.toFixed(1)} vs minScreenDistanceSq: ${minScreenDistanceSq}`); 
        
        if (screenDSq < minScreenDistanceSq) {
            // console.log(`findClickedUnit: Potential unit ${unit.id} (distSq: ${screenDSq})`); 
            minScreenDistanceSq = screenDSq;
            closestUnit = unit;
        }
    }

    // if (closestUnit) {
    //     console.log(`findClickedUnit: Returning unit: ${closestUnit.id}`); 
    // } else {
    //     console.log("findClickedUnit: No unit found in click radius."); 
    // }
    return closestUnit;
}

function findClickedCity(lon, lat) {
    let clickScreenPos = worldToScreen(lon, lat);
    let closestCity = null;
    let minScreenDistanceSq = 20 * 20; // Slightly larger click radius for cities

    // console.log(`findClickedCity: Checking at screen (${clickScreenPos.x.toFixed(1)}, ${clickScreenPos.y.toFixed(1)})`);

    for (let city of gameCities) {
        if (city.destroyed) continue; // Cannot target destroyed cities

        let cityScreenPos = worldToScreen(city.lon, city.lat);
        let screenDSq = distSq(clickScreenPos.x, clickScreenPos.y, cityScreenPos.x, cityScreenPos.y);

        // console.log(`findClickedCity: Checking ${city.name} at screen (${cityScreenPos.x.toFixed(1)}, ${cityScreenPos.y.toFixed(1)}), distSq: ${screenDSq.toFixed(1)}`);

        if (screenDSq < minScreenDistanceSq) {
            minScreenDistanceSq = screenDSq;
            closestCity = city;
        }
    }
    // if (closestCity) {
    //     console.log(`findClickedCity: Returning city: ${closestCity.name}`);
    // } else {
    //     console.log("findClickedCity: No city found in click radius.");
    // }
    return closestCity;
}


function distSq(x1, y1, x2, y2) { 
    return (x1 - x2)**2 + (y1 - y2)**2;
}

function mousePressed() {
    if (mouseButton === LEFT) {
        initialMouseX = mouseX;
        initialMouseY = mouseY;

        if (gameState === 'MainMenu') { handleMainMenuClick(); }
        else if (gameState === 'Options') { handleOptionsClick(); handleVolumeClick(); }
        else if (gameState === 'Setup') { handleSetupClick(); }
        else if (gameState === 'Playing') {
            if (mouseX > 0 && mouseX < width && mouseY > 0 && mouseY < height) {
                isDragging = true;
                prevMouseX = mouseX;
                prevMouseY = mouseY;
            } else {
                isDragging = false;
            }
        } else {
             isDragging = false;
        }
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
    if (selectedOption !== -1) {
        let choice = mainMenuOptions[selectedOption];
        if (choice === "START SIMULATION") { initializeGameSetup("NorthAmerica"); gameState = 'Setup'; }
        else if (choice === "OPTIONS") { gameState = 'Options'; selectedOption = -1; }
        else if (choice === "EXIT") { console.log("Exit selected"); }
    }
}

function handleOptionsClick() {
    if (selectedOption !== -1) {
        let choice = optionsMenuOptions[selectedOption];
        if (choice === "BACK") { gameState = 'MainMenu'; selectedOption = -1; }
    }
}

function handleSetupClick() {
    if (!setupConfirmed) {
        if (currentPlacementIndex < assetsToPlace.length) {
            let mouseWorld = screenToWorld(mouseX, mouseY);
            if (isCoordInTerritory(mouseWorld.lon, mouseWorld.lat, playerTerritory)) {
                let assetData = assetsToPlace[currentPlacementIndex];
                gameUnits.push({
                    type: assetData.type, owner: playerTerritory, lon: mouseWorld.lon, lat: mouseWorld.lat,
                    id: `unit_${Date.now()}_${random(1000)}`, ammo: assetData.ammo, state: assetData.state
                });
                currentPlacementIndex++;
            } else { console.log("Cannot place outside territory."); }
        } else {
            console.log("Deployment Confirmed!"); setupConfirmed = true; gameState = 'Playing';
            gameStartTime = millis(); elapsedGameTime = 0; currentDefconLevel = 5;
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
                        currentX: silo.lon, currentY: silo.lat, type: 'ICBM'
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
                    currentX: silo.lon, currentY: silo.lat, type: 'ICBM'
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
                    // let silo = gameUnits.find(u => u.id === selectedUnitForFiring);
                    // if(silo) silo.state = 'idle';
                    // selectedUnitForFiring = null;
                    // selectedCityForTargeting = null;
                    // console.log("Firing cancelled by clicking empty space.");
                } else {
                    // No silo selected, and no silo clicked. Could be for city info in future.
                    selectedCityForTargeting = null; // Clear city target if clicking elsewhere
                }
            }
        }
    } 
}


function mouseDragged() {
    if (gameState === 'Options' && selectedOption >= 0 && selectedOption < 3) {
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
    } else if ((gameState === 'Playing' || gameState === 'Setup') && isDragging) {
        let dx = mouseX - prevMouseX; let dy = mouseY - prevMouseY;
        let worldWidthAtZoom = BASE_WORLD_WIDTH * zoom; let worldHeightAtZoom = BASE_WORLD_HEIGHT * zoom;
        let degPerPixelX = 360 / worldWidthAtZoom; let degPerPixelY = -180 / worldHeightAtZoom;
        centerLon -= dx * degPerPixelX; centerLat -= dy * degPerPixelY;
        centerLon = ((centerLon + 180 + 360) % 360) - 180; centerLat = constrain(centerLat, -85, 85);
        prevMouseX = mouseX; prevMouseY = mouseY;
    }
}

function mouseReleased() {
    if (mouseButton === LEFT) {
        const dragThreshold = 5;
        let distanceMoved = (initialMouseX !== -1 && initialMouseY !== -1) ? dist(mouseX, mouseY, initialMouseX, initialMouseY) : dragThreshold + 1;

        if (gameState === 'Playing') {
            if (distanceMoved < dragThreshold) {
                 // console.log(`mouseReleased: Click detected. Distance: ${distanceMoved.toFixed(1)}. Calling handleGameClick.`); 
                 handleGameClick();
            } else if (isDragging) {
                 // console.log(`mouseReleased: Drag detected. Distance: ${distanceMoved.toFixed(1)}. Not calling handleGameClick.`); 
            }
        }
        isDragging = false;
        initialMouseX = -1;
        initialMouseY = -1;
    }
}

function mouseWheel(event) {
    if (gameState === 'Playing' || gameState === 'Setup') {
        let scaleFactor = 1.1; let zoomDelta = (event.delta < 0) ? scaleFactor : 1 / scaleFactor;
        let mouseWorldBefore = screenToWorld(mouseX, mouseY); zoom *= zoomDelta; zoom = constrain(zoom, minZoom, maxZoom);
        let mouseWorldAfter = screenToWorld(mouseX, mouseY);
        centerLon += mouseWorldBefore.lon - mouseWorldAfter.lon; centerLat += mouseWorldBefore.lat - mouseWorldAfter.lat;
        centerLon = ((centerLon + 180 + 360) % 360) - 180; centerLat = constrain(centerLat, -85, 85);
        return false;
    }
    return true;
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
}