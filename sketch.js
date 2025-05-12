// sketch.js - Updated with Missile Launching, Tracking, and Click Debugging

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
    }
};
let playerTerritory = null; // Key of the player's territory
let gameUnits = []; // Holds all placed units { type, owner, lon, lat, id, ammo?, state? }
let selectedUnitForFiring = null; // ID of the silo selected for firing

// Missile & Effects Data
let activeMissiles = []; // { id, owner, startX, startY, targetX, targetY, currentX, currentY, type }
let activeExplosions = []; // { x, y, radius, maxRadius, duration, age, owner }
const MISSILE_WORLD_SPEED_DEG_PER_SEC = 5.0; // Degrees across globe per second

// Game Progression Variables
let currentDefconLevel = 5;
let gameStartTime = 0;
let elapsedGameTime = 0;
const DEFCON_TIMINGS = { 4: 180, 3: 360, 2: 540, 1: 720 };

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
const MENU_HIGHLIGHT_COLOR = [255, 255, 0];
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
    if (citiesGeoJSON && citiesGeoJSON.features) {
        noStroke();
        for (let feature of citiesGeoJSON.features) {
            let population = feature.properties.POP_MAX || feature.properties.pop_max || feature.properties.population || 0;
            if (population >= POP_TIER1_THRESHOLD) {
                let coords = feature.geometry.coordinates;
                let screenPos = worldToScreen(coords[0], coords[1]);
                if (screenPos.x < -20 || screenPos.x > width + 20 || screenPos.y < -20 || screenPos.y > height + 20) continue;
                let citySize, cityColor;
                if (population >= POP_TIER3_THRESHOLD) {
                    citySize = 4 + zoom * 0.8; cityColor = DEFCON_CITY_COLOR_TIER3;
                } else if (population >= POP_TIER2_THRESHOLD) {
                    citySize = 3 + zoom * 0.6; cityColor = DEFCON_CITY_COLOR_TIER2;
                } else {
                    citySize = 2 + zoom * 0.4; cityColor = DEFCON_CITY_COLOR_TIER1;
                }
                citySize = max(1, citySize);
                fill(cityColor[0], cityColor[1], cityColor[2], mapAlpha);
                ellipse(screenPos.x, screenPos.y, citySize, citySize);
                if ((gameState === 'Playing' || gameState === 'Setup') && zoom > LABEL_ZOOM_THRESHOLD) {
                    let cityName = feature.properties.NAME || feature.properties.name || "Unknown City";
                    fill(DEFCON_TEXT_COLOR[0], DEFCON_TEXT_COLOR[1], DEFCON_TEXT_COLOR[2], mapAlpha - 50 > 0 ? mapAlpha - 50 : mapAlpha);
                    noStroke(); textSize(max(6, 8 + zoom * 0.3)); textAlign(CENTER, BOTTOM);
                    text(cityName, screenPos.x, screenPos.y - citySize / 2 - 2);
                }
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
    textSize(32); textFont('monospace'); textAlign(CENTER, TOP);
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
    pop();
}

// --- Game Logic & Setup Functions ---

function initializeGameSetup(territoryKey) {
    playerTerritory = territoryKey; gameUnits = []; currentDefconLevel = 5;
    elapsedGameTime = 0; gameStartTime = 0; setupConfirmed = false; currentPlacementIndex = 0;
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
    console.log(`Impact detected for missile ${missile.id} at Lon ${missile.targetX.toFixed(2)}, Lat ${missile.targetY.toFixed(2)}`);
    activeExplosions.push({
         x: missile.targetX, y: missile.targetY, radius: 0, maxRadius: 5,
         duration: 60, age: 0, owner: missile.owner
    });
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
    let bounds = territories[territoryKey].placementArea;
    let tl = worldToScreen(bounds.minLon, bounds.maxLat); let tr = worldToScreen(bounds.maxLon, bounds.maxLat);
    let bl = worldToScreen(bounds.minLon, bounds.minLat); let br = worldToScreen(bounds.maxLon, bounds.minLat);
    stroke(territories[territoryKey].color[0], territories[territoryKey].color[1], territories[territoryKey].color[2], 100);
    strokeWeight(max(1, 2 / zoom)); noFill(); beginShape();
    vertex(tl.x, tl.y); vertex(tr.x, tr.y); vertex(br.x, br.y); vertex(bl.x, bl.y);
    endShape(CLOSE);
}

function isCoordInTerritory(lon, lat, territoryKey) {
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
    let unitColor = territories[unit.owner].color; let strokeColor = unitColor; let showHighlight = false;
    if (isSetupPhase) { unitColor = [unitColor[0], unitColor[1], unitColor[2], 150]; }
    else if (unit.state === 'selected' || selectedUnitForFiring === unit.id) { showHighlight = true; strokeColor = [255, 255, 0]; }
    else if (unit.type === 'Silo' && unit.ammo === 0) { unitColor = [100, 100, 100, 150]; strokeColor = [100, 100, 100, 150]; }
    if (showHighlight) { noFill(); stroke(strokeColor[0], strokeColor[1], strokeColor[2], 200); strokeWeight(max(1.5, 2.5 / zoom)); let r = (unit.type === 'Silo' ? 10 : 12) + zoom; r = max(8, r); ellipse(screenPos.x, screenPos.y, r * 2); }
    if (unit.type === 'Silo') {
        fill(unitColor); stroke(strokeColor); strokeWeight(max(0.5, 1 / zoom)); let size = 8 + zoom * 0.5; size = max(4, size);
        triangle(screenPos.x, screenPos.y - size*0.6, screenX - size*0.4, screenPos.y + size*0.4, screenX + size*0.4, screenPos.y + size*0.4);
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
        let trailColor = territories[m.owner].color; stroke(trailColor[0], trailColor[1], trailColor[2], 180);
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
        let screenRadius = currentRadius * zoom * (BASE_WORLD_WIDTH / 360); // Approx conversion
        let lifeRatio = exp.age / exp.duration;
        let alpha = map(lifeRatio, 0.5, 1.0, 255, 0, true);
        let r = 255; let g = map(lifeRatio, 0, 0.7, 255, 0, true); let b = 0;
        fill(r, g, b, alpha); ellipse(screenPos.x, screenPos.y, screenRadius * 2);
    }
    pop();
}

// --- Event Handlers ---

// Helper function to find which unit was clicked (REVISED - Screen Distance Focus)
function findClickedUnit(lon, lat, typeFilter = null, ownerFilter = null) {
    let clickScreenPos = worldToScreen(lon, lat);
    let closestUnit = null;
    // Use a fixed screen pixel radius for clicking. Adjust 15 if it feels too small/large.
    let minScreenDistanceSq = 15 * 15; // Click radius in screen pixels (squared)

    // Add some console logs for debugging - remove later
    // console.log(`findClickedUnit check at screen (${clickScreenPos.x.toFixed(1)}, ${clickScreenPos.y.toFixed(1)})`);

    for (let unit of gameUnits) {
        // Apply filters first
        if (typeFilter && unit.type !== typeFilter) continue;
        if (ownerFilter && unit.owner !== ownerFilter) continue;

        // Calculate unit's screen position
        let unitScreenPos = worldToScreen(unit.lon, unit.lat);

        // Calculate squared distance on screen
        let screenDSq = distSq(clickScreenPos.x, clickScreenPos.y, unitScreenPos.x, unitScreenPos.y);

        // console.log(` - Checking ${unit.type} ${unit.id} at screen (${unitScreenPos.x.toFixed(1)}, ${unitScreenPos.y.toFixed(1)}), distSq: ${screenDSq.toFixed(1)}`);

        // Check if this unit is within the click radius AND is closer than any previous candidate
        if (screenDSq < minScreenDistanceSq) {
            // console.log(`   -> Found potential unit: ${unit.id} (distSq: ${screenDSq})`);
             // Update the minimum distance found so far *for screen distance*
             minScreenDistanceSq = screenDSq; // This ensures we get the one closest on screen within radius
             closestUnit = unit;          // This unit is now the best candidate
        }
    }

     // After checking all units, return the closest one found within the radius
     if (closestUnit) {
        // console.log(`   => Returning unit: ${closestUnit.id}`);
     } else {
         // console.log("   => No unit found in click radius.");
     }
    return closestUnit;
}

// Helper for squared distance
function distSq(x1, y1, x2, y2) {
    return (x1 - x2)**2 + (y1 - y2)**2;
}

function mousePressed() {
    if (mouseButton === LEFT) {
        // Store initial position regardless of state
        initialMouseX = mouseX;
        initialMouseY = mouseY;

        // State-specific logic
        if (gameState === 'MainMenu') { handleMainMenuClick(); }
        else if (gameState === 'Options') { handleOptionsClick(); handleVolumeClick(); }
        else if (gameState === 'Setup') { handleSetupClick(); }
        else if (gameState === 'Playing') {
            // Set dragging flag *only* if starting on canvas (for panning)
            if (mouseX > 0 && mouseX < width && mouseY > 0 && mouseY < height) {
                isDragging = true; // Potential drag starts
                prevMouseX = mouseX; // Store position for panning delta calculation
                prevMouseY = mouseY;
            } else {
                isDragging = false; // Click started off-canvas, don't treat as drag start
            }
        } else {
             isDragging = false; // Default for other states or unknown
        }
    }
}

function handleVolumeClick() { // Handles direct click on slider bar
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
    // console.log(`handleGameClick - DEFCON: ${currentDefconLevel}, Selected: ${selectedUnitForFiring}`); // DEBUG

    if (currentDefconLevel <= 1) {
        if (selectedUnitForFiring) {
            // --- Second Click: Target ---
            let silo = gameUnits.find(u => u.id === selectedUnitForFiring);
            if (silo) {
                if (silo.ammo > 0) {
                    // Launch missile
                    silo.ammo--;
                    activeMissiles.push({
                        id: `missile_${Date.now()}_${random(1000)}`, owner: silo.owner,
                        startX: silo.lon, startY: silo.lat, targetX: clickWorldPos.lon, targetY: clickWorldPos.lat,
                        currentX: silo.lon, currentY: silo.lat, type: 'ICBM'
                    });
                    console.log(`Missile launched! Silo Ammo: ${silo.ammo}`);
                    silo.state = 'idle'; selectedUnitForFiring = null;
                } else {
                    console.log(`Silo ${silo.id} empty!`);
                    silo.state = 'idle'; selectedUnitForFiring = null;
                }
            } else { selectedUnitForFiring = null; } // Silo not found (shouldn't happen)
        } else {
            // --- First Click: Select Silo ---
            let clickedSilo = findClickedUnit(clickWorldPos.lon, clickWorldPos.lat, 'Silo', playerTerritory);
            if (clickedSilo) {
                if (clickedSilo.ammo > 0) {
                    console.log(`Selected Silo ${clickedSilo.id} (Ammo: ${clickedSilo.ammo}). Click target.`);
                    // Deselect previous if any
                    if(selectedUnitForFiring) { let prevSilo = gameUnits.find(u => u.id === selectedUnitForFiring); if(prevSilo) prevSilo.state = 'idle';}
                    selectedUnitForFiring = clickedSilo.id;
                    clickedSilo.state = 'selected'; // Set state *after* assigning ID
                } else {
                    console.log(`Selected Silo ${clickedSilo.id} - OUT OF AMMO.`);
                     // IMPORTANT: Don't select it for firing if empty
                     // Make sure any previously selected silo is deselected
                     if(selectedUnitForFiring) { let prevSilo = gameUnits.find(u => u.id === selectedUnitForFiring); if(prevSilo) prevSilo.state = 'idle'; selectedUnitForFiring = null;}
                }
            } else {
                // Clicked somewhere else (not on a player silo)
                if(selectedUnitForFiring) {
                    // If a silo *was* selected, deselect it
                    let silo = gameUnits.find(u => u.id === selectedUnitForFiring);
                    if(silo) silo.state = 'idle';
                    selectedUnitForFiring = null;
                    console.log("Firing cancelled.");
                }
                // Handle other potential clicks (e.g., selecting enemy units for info?)
                // console.log("Game click (no player silo selected/clicked) at:", clickWorldPos); // DEBUG
            }
        }
    } else {
        // DEFCON level too high - make sure selection is cleared if player clicks
        // console.log(`Cannot fire - DEFCON Level ${currentDefconLevel}`); // DEBUG
        if(selectedUnitForFiring) {
            let silo = gameUnits.find(u => u.id === selectedUnitForFiring);
            if(silo) silo.state = 'idle';
            selectedUnitForFiring = null;
             console.log("Selection cleared due to DEFCON level or invalid click.");
        }
        // Handle info clicks maybe?
        // console.log("Game click (DEFCON too high) at:", clickWorldPos); // DEBUG
    }
}


function mouseDragged() {
    if (gameState === 'Options' && selectedOption >= 0 && selectedOption < 3) {
        let vol = (selectedOption === 0 ? masterVolume : (selectedOption === 1 ? musicVolume : sfxVolume));
        let displayValue = `[ ${nf(vol, 0, 0)}% ]`;
        let sliderStartX = width * 0.65 + textWidth(displayValue) + 10;
        let barWidth = 100;
        // Only adjust if dragging *over* the bar
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
        const dragThreshold = 5; // Max distance in pixels to be considered a click

        // Calculate distance moved since mousePressed
        // Ensure initialMouse positions are valid before calculating distance
        let distanceMoved = (initialMouseX !== -1 && initialMouseY !== -1) ? dist(mouseX, mouseY, initialMouseX, initialMouseY) : dragThreshold + 1; // Default to > threshold if initial pos invalid

        // Only handle game clicks in 'Playing' state
        if (gameState === 'Playing') {
            // Treat as a click if mouse moved less than the threshold.
            if (distanceMoved < dragThreshold) {
                 // console.log(`mouseReleased: distanceMoved (${distanceMoved.toFixed(1)}) < threshold (${dragThreshold}). Handling as click.`); // DEBUG
                 handleGameClick();
            } else if (isDragging) {
                 // console.log(`mouseReleased: Drag finished (distance: ${distanceMoved.toFixed(1)}).`); // DEBUG
                 // It was definitely a drag, do nothing extra on release
            }
        }

        // Always reset dragging flag and initial positions
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