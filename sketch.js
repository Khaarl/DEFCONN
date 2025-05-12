// sketch.js

let worldGeoJSON;
let citiesGeoJSON;

// Game State
let gameState = 'MainMenu'; // Possible states: 'MainMenu', 'Options', 'Playing', 'Loading'
let selectedOption = -1; // Index of the currently hovered/selected menu item
const mainMenuOptions = ["START SIMULATION", "OPTIONS", "EXIT"];
const optionsMenuOptions = ["MASTER VOLUME", "MUSIC VOLUME", "SFX VOLUME", "BACK"];

// Placeholder volume settings (0 to 100)
let masterVolume = 75;
let musicVolume = 60;
let sfxVolume = 80;

// Map Interaction State
let zoom = 1; // Initial zoom level
let minZoom = 0.8; // Minimum zoom out
let maxZoom = 50; // Maximum zoom in
let centerLon = 0; // Center longitude of the view
let centerLat = 20; // Center latitude (slightly North bias often looks good)
let isDragging = false;
let prevMouseX, prevMouseY;

// Map Appearance
const DEFCON_BG_COLOR = [0, 0, 26];
const DEFCON_LAND_COLOR = [0, 80, 150];
const DEFCON_CITY_COLOR_TIER1 = [255, 255, 150]; // Pale Yellow (e.g., 1M+)
const DEFCON_CITY_COLOR_TIER2 = [255, 200, 100]; // Light Orange (e.g., 5M+)
const DEFCON_CITY_COLOR_TIER3 = [255, 150, 50];  // Orange (e.g., 10M+)
const DEFCON_TEXT_COLOR = [200, 200, 200]; // Light grey for text

// Population Tiers
const POP_TIER1_THRESHOLD = 1000000;
const POP_TIER2_THRESHOLD = 5000000;
const POP_TIER3_THRESHOLD = 10000000;

// Label Visibility Zoom Threshold
const LABEL_ZOOM_THRESHOLD = 4.0; // Start showing labels when zoom is > 4

// Coordinate Transformation (Revised from user plan)
const BASE_WORLD_WIDTH = 2048; // Arbitrary pixel width for the world at zoom=1
const BASE_WORLD_HEIGHT = BASE_WORLD_WIDTH / 2; // Equirectangular aspect ratio

// Menu Colors & Style
const MENU_TEXT_COLOR = [0, 200, 200]; // Cyan
const MENU_HIGHLIGHT_COLOR = [255, 255, 0]; // Yellow
const MENU_TITLE_COLOR = [0, 255, 255]; // Brighter Cyan
const MENU_BG_ALPHA = 180; // Semi-transparent background for menu area

function preload() {
    worldGeoJSON = loadJSON('countries.geojson');
    citiesGeoJSON = loadJSON('cities.geojson');
}

function setup() {
    createCanvas(windowWidth, windowHeight);
    textFont('monospace'); // Set default font for menus
    console.log("World data loaded");
    console.log("Cities data loaded");
}

function draw() {
    background(DEFCON_BG_COLOR[0], DEFCON_BG_COLOR[1], DEFCON_BG_COLOR[2]);
    drawBackgroundMapAndCities(); // Draw map in the background

    // Draw UI based on state
    if (gameState === 'MainMenu') {
        drawMainMenu();
    } else if (gameState === 'Options') {
        drawOptionsMenu();
    } else if (gameState === 'Playing') {
        drawGameUI();
    }
}

function drawBackgroundMapAndCities() {
    let mapAlpha = (gameState === 'Playing') ? 255 : 150; // Dim map if not playing

    // --- Draw Countries ---
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

    // --- Draw Cities ---
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

                if (gameState === 'Playing' && zoom > LABEL_ZOOM_THRESHOLD) {
                    let cityName = feature.properties.NAME || feature.properties.name || "Unknown City";
                    fill(DEFCON_TEXT_COLOR[0], DEFCON_TEXT_COLOR[1], DEFCON_TEXT_COLOR[2], mapAlpha - 50 > 0 ? mapAlpha - 50 : mapAlpha); // Slightly more transparent labels
                    noStroke();
                    textSize(max(6, 8 + zoom * 0.3));
                    textAlign(CENTER, BOTTOM);
                    text(cityName, screenPos.x, screenPos.y - citySize / 2 - 2);
                }
            }
        }
    }
}

function drawGameUI() {
    fill(255);
    noStroke();
    textSize(24);
    textAlign(CENTER, TOP);
    // text(`DEFCON LEVEL: ${currentDefconLevel}`, width / 2, 20); // Example
    // text(`TIME: ${gameTime}`, 100, 20); // Example
}

// --- Coordinate Conversion Functions (Revised from user plan) ---
function worldToScreen(lon, lat) {
    let worldX = map(lon, -180, 180, 0, BASE_WORLD_WIDTH);
    let worldY = map(lat, 90, -90, 0, BASE_WORLD_HEIGHT);

    let centerWorldX = map(centerLon, -180, 180, 0, BASE_WORLD_WIDTH);
    let centerWorldY = map(centerLat, 90, -90, 0, BASE_WORLD_HEIGHT);

    let dx = worldX - centerWorldX;
    let dy = worldY - centerWorldY;

    let screenX = width / 2 + dx * zoom;
    let screenY = height / 2 + dy * zoom;

    return createVector(screenX, screenY);
}

function screenToWorld(x, y) {
    let dx = (x - width / 2) / zoom;
    let dy = (y - height / 2) / zoom;

    let centerWorldX = map(centerLon, -180, 180, 0, BASE_WORLD_WIDTH);
    let centerWorldY = map(centerLat, 90, -90, 0, BASE_WORLD_HEIGHT);

    let worldX = centerWorldX + dx;
    let worldY = centerWorldY + dy;

    let lon = map(worldX, 0, BASE_WORLD_WIDTH, -180, 180, true); // Use constrain=true
    let lat = map(worldY, 0, BASE_WORLD_HEIGHT, 90, -90, true);   // Use constrain=true

    return { lon, lat };
}

// Helper to draw a polygon using worldToScreen
function drawTransformedPolygon(polygonPoints) {
    beginShape();
    for (let point of polygonPoints) {
        let screenPos = worldToScreen(point[0], point[1]);
        vertex(screenPos.x, screenPos.y);
    }
    endShape(CLOSE);
}


function drawMainMenu() {
    fill(DEFCON_BG_COLOR[0], DEFCON_BG_COLOR[1], DEFCON_BG_COLOR[2], MENU_BG_ALPHA);
    noStroke();
    rect(0, 0, width, height);

    textSize(48);
    textAlign(CENTER, CENTER);
    fill(MENU_TITLE_COLOR[0], MENU_TITLE_COLOR[1], MENU_TITLE_COLOR[2]);
    text("GLOBAL CONFLICT SIMULATOR", width / 2, height * 0.25);

    textSize(28);
    let startY = height * 0.5;
    let spacingY = 50;
    selectedOption = -1;

    for (let i = 0; i < mainMenuOptions.length; i++) {
        let optionText = mainMenuOptions[i];
        let posY = startY + i * spacingY;
        let textW = textWidth(optionText);
        let textH = 28;

        if (mouseX > width / 2 - textW / 2 && mouseX < width / 2 + textW / 2 &&
            mouseY > posY - textH / 2 && mouseY < posY + textH / 2) {
            selectedOption = i;
            fill(MENU_HIGHLIGHT_COLOR[0], MENU_HIGHLIGHT_COLOR[1], MENU_HIGHLIGHT_COLOR[2]);
        } else {
            fill(MENU_TEXT_COLOR[0], MENU_TEXT_COLOR[1], MENU_TEXT_COLOR[2]);
        }
        text(optionText, width / 2, posY);
    }
}

function drawOptionsMenu() {
    fill(DEFCON_BG_COLOR[0], DEFCON_BG_COLOR[1], DEFCON_BG_COLOR[2], MENU_BG_ALPHA);
    noStroke();
    rect(0, 0, width, height);

    textSize(40);
    textAlign(CENTER, CENTER);
    fill(MENU_TITLE_COLOR[0], MENU_TITLE_COLOR[1], MENU_TITLE_COLOR[2]);
    text("SYSTEM OPTIONS", width / 2, height * 0.2);

    textSize(24);
    let startY = height * 0.4;
    let spacingY = 50;
    let labelX = width * 0.35;
    let valueX = width * 0.65; // For the start of the value/slider display
    selectedOption = -1;

    for (let i = 0; i < optionsMenuOptions.length; i++) {
        let optionLabel = optionsMenuOptions[i];
        let posY = startY + i * spacingY;
        let displayValue = "";
        let isHovering = false;

        // Hitbox for the whole row
        let rowHeight = 30;
        // Approximate width from label start to value end for hover
        let hoverAreaStartX = labelX - textWidth(optionLabel) - 20; // A bit left of label
        let hoverAreaEndX = valueX + 120; // A bit right of typical slider/value
        if (optionLabel === "BACK") { // Special case for centered BACK button
            hoverAreaStartX = width/2 - textWidth(optionLabel)/2 - 20;
            hoverAreaEndX = width/2 + textWidth(optionLabel)/2 + 20;
        }


        if (mouseX > hoverAreaStartX && mouseX < hoverAreaEndX &&
            mouseY > posY - rowHeight / 2 && mouseY < posY + rowHeight / 2) {
            selectedOption = i;
            isHovering = true;
        }

        fill(isHovering ? MENU_HIGHLIGHT_COLOR[0] : MENU_TEXT_COLOR[0],
             isHovering ? MENU_HIGHLIGHT_COLOR[1] : MENU_TEXT_COLOR[1],
             isHovering ? MENU_HIGHLIGHT_COLOR[2] : MENU_TEXT_COLOR[2]);

        textAlign(RIGHT, CENTER);
        text(optionLabel, labelX, posY);

        if (i < 3) { // Volume options
            let vol = (i === 0 ? masterVolume : (i === 1 ? musicVolume : sfxVolume));
            displayValue = `[ ${nf(vol, 0, 0)}% ]`;
            let barWidth = 100;
            let barX = valueX; // Slider starts at valueX
            let filledWidth = map(vol, 0, 100, 0, barWidth);

            textAlign(LEFT, CENTER);
            text(displayValue, barX, posY); // Display value next to label

            // Draw visual slider to the right of the percentage
            let sliderStartX = barX + textWidth(displayValue) + 10;
            strokeWeight(1);
            stroke(MENU_TEXT_COLOR[0], MENU_TEXT_COLOR[1], MENU_TEXT_COLOR[2]);
            fill(isHovering ? MENU_HIGHLIGHT_COLOR[0] : MENU_TEXT_COLOR[0],
                 isHovering ? MENU_HIGHLIGHT_COLOR[1] : MENU_TEXT_COLOR[1],
                 isHovering ? MENU_HIGHLIGHT_COLOR[2] : MENU_TEXT_COLOR[2], 150);
            rect(sliderStartX, posY - 5, filledWidth, 10);
            noFill();
            rect(sliderStartX, posY - 5, barWidth, 10);
            noStroke();
        } else if (optionLabel === "BACK") {
            textAlign(CENTER, CENTER);
            text(optionLabel, width / 2, posY);
        }
    }
}

function mousePressed() {
    if (mouseButton === LEFT) {
        if (gameState === 'MainMenu') {
            handleMainMenuClick();
        } else if (gameState === 'Options') {
            handleOptionsClick();
            // If clicking on a slider, set volume directly
            if (selectedOption >= 0 && selectedOption < 3) {
                let optionLabel = optionsMenuOptions[selectedOption];
                let displayValue = "";
                 if (selectedOption === 0) displayValue = `[ ${nf(masterVolume, 0, 0)}% ]`;
                 else if (selectedOption === 1) displayValue = `[ ${nf(musicVolume, 0, 0)}% ]`;
                 else if (selectedOption === 2) displayValue = `[ ${nf(sfxVolume, 0, 0)}% ]`;

                let sliderStartX = width * 0.65 + textWidth(displayValue) + 10;
                let barWidth = 100;
                if (mouseX >= sliderStartX && mouseX <= sliderStartX + barWidth) {
                    let newVolume = map(mouseX, sliderStartX, sliderStartX + barWidth, 0, 100, true);
                    if (selectedOption === 0) masterVolume = newVolume;
                    else if (selectedOption === 1) musicVolume = newVolume;
                    else if (selectedOption === 2) sfxVolume = newVolume;
                }
            }
        } else if (gameState === 'Playing') {
            // Only set isDragging if click is on canvas for map panning
            if (mouseX > 0 && mouseX < width && mouseY > 0 && mouseY < height) {
                isDragging = true;
                prevMouseX = mouseX;
                prevMouseY = mouseY;
            }
            // Call game click handler if not starting a drag (or if drag is very short)
            // This logic is refined in mouseReleased
        }
    }
}

function handleMainMenuClick() {
    if (selectedOption !== -1) {
        let choice = mainMenuOptions[selectedOption];
        if (choice === "START SIMULATION") {
            gameState = 'Playing';
        } else if (choice === "OPTIONS") {
            gameState = 'Options';
            selectedOption = -1;
        } else if (choice === "EXIT") {
            console.log("Exit selected (no direct action in browser)");
        }
    }
}

function handleOptionsClick() {
    if (selectedOption !== -1) {
        let choice = optionsMenuOptions[selectedOption];
        if (choice === "BACK") {
            gameState = 'MainMenu';
            selectedOption = -1;
        }
        // Clicking volume label/value itself doesn't change volume here, only dragging/clicking bar
    }
}

function handleGameClick() {
    // This function would contain logic for interacting with the game map
    // e.g., selecting units, firing missiles, etc.
    // This is called from mouseReleased if it was a short click and not a drag.
    console.log("Game click at (world coords):", screenToWorld(mouseX, mouseY));
}

function mouseDragged() {
    if (gameState === 'Options' && selectedOption >= 0 && selectedOption < 3) {
        let optionLabel = optionsMenuOptions[selectedOption];
        let displayValue = "";
         if (selectedOption === 0) displayValue = `[ ${nf(masterVolume, 0, 0)}% ]`;
         else if (selectedOption === 1) displayValue = `[ ${nf(musicVolume, 0, 0)}% ]`;
         else if (selectedOption === 2) displayValue = `[ ${nf(sfxVolume, 0, 0)}% ]`;

        let sliderStartX = width * 0.65 + textWidth(displayValue) + 10;
        let barWidth = 100;
        if (mouseX >= sliderStartX && mouseX <= sliderStartX + barWidth) {
            let newVolume = map(mouseX, sliderStartX, sliderStartX + barWidth, 0, 100, true);
            if (selectedOption === 0) masterVolume = newVolume;
            else if (selectedOption === 1) musicVolume = newVolume;
            else if (selectedOption === 2) sfxVolume = newVolume;
        }
    } else if (gameState === 'Playing' && isDragging) {
        let dx = mouseX - prevMouseX;
        let dy = mouseY - prevMouseY;
        let worldWidthAtZoom = BASE_WORLD_WIDTH * zoom;
        let worldHeightAtZoom = BASE_WORLD_HEIGHT * zoom;
        let degPerPixelX = 360 / worldWidthAtZoom;
        let degPerPixelY = -180 / worldHeightAtZoom; // Y is inverted
        centerLon -= dx * degPerPixelX;
        centerLat -= dy * degPerPixelY;
        centerLon = ((centerLon + 180 + 360) % 360) - 180; // Wrap longitude
        centerLat = constrain(centerLat, -85, 85);
        prevMouseX = mouseX;
        prevMouseY = mouseY;
    }
}

function mouseReleased() {
    if (gameState === 'Playing' && isDragging) {
        // Check if it was a drag or a click
        const dragThreshold = 5; // Pixels
        if (abs(mouseX - prevMouseX) < dragThreshold && abs(mouseY - prevMouseY) < dragThreshold) {
            handleGameClick(); // It was a short click, not a drag
        }
    }
    isDragging = false;
}

function mouseWheel(event) {
    if (gameState === 'Playing') {
        let scaleFactor = 1.1;
        let zoomDelta = (event.delta < 0) ? scaleFactor : 1 / scaleFactor;
        let mouseWorldBefore = screenToWorld(mouseX, mouseY);
        zoom *= zoomDelta;
        zoom = constrain(zoom, minZoom, maxZoom);
        let mouseWorldAfter = screenToWorld(mouseX, mouseY); // Recalculate with new zoom, old center
        centerLon += mouseWorldBefore.lon - mouseWorldAfter.lon;
        centerLat += mouseWorldBefore.lat - mouseWorldAfter.lat;
        centerLon = ((centerLon + 180 + 360) % 360) - 180; // Wrap longitude
        centerLat = constrain(centerLat, -85, 85);
        return false; // Prevent page scroll
    }
    return true; // Allow default scroll if not in 'Playing' state
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
}