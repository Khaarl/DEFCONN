// naval_units.js - Logic for Carriers, Submarines, Battleships

// --- Constants ---
const CARRIER_SPEED_KNOTS = 30; // Example speed
const SUBMARINE_SPEED_KNOTS_SURFACED = 15;
const SUBMARINE_SPEED_KNOTS_SUBMERGED = 25;
const BATTLESHIP_SPEED_KNOTS = 28;

// TODO: Convert knots to degrees per second based on map scale if needed
// Rough conversion: 1 degree latitude is ~60 nautical miles.
// Speed (deg/sec) = Speed (knots) / 60 (nm/deg) / 3600 (sec/hr)
const DEG_PER_NM = 1 / 60;
const SEC_PER_HR = 3600;
const KNOTS_TO_DPS = (knots) => knots * DEG_PER_NM / SEC_PER_HR;

const CARRIER_SPEED_DPS = KNOTS_TO_DPS(CARRIER_SPEED_KNOTS);
const SUBMARINE_SPEED_SURFACED_DPS = KNOTS_TO_DPS(SUBMARINE_SPEED_KNOTS_SURFACED);
const SUBMARINE_SPEED_SUBMERGED_DPS = KNOTS_TO_DPS(SUBMARINE_SPEED_KNOTS_SUBMERGED);
const BATTLESHIP_SPEED_DPS = KNOTS_TO_DPS(BATTLESHIP_SPEED_KNOTS);


const SUB_SLBM_AMMO = 4;
const CARRIER_AIRCRAFT_CAPACITY = 20; // Fighters/Bombers mix?

const NAVAL_UNIT_SIZE = 10; // Base size in pixels
const CARRIER_COLOR = [180, 180, 100, 220]; // Khaki-ish
const SUBMARINE_COLOR_SUBMERGED = [50, 80, 150, 150]; // Deep blue, semi-transparent
const SUBMARINE_COLOR_SURFACED = [100, 120, 180, 200]; // Lighter blue
const BATTLESHIP_COLOR = [150, 150, 150, 220]; // Grey

// --- Data ---
// Note: Naval units will likely be stored within the main `gameUnits` array in sketch.js
// This file will contain the functions to *operate* on those units.

// --- Initialization Function ---
// (Called from sketch.js's initializeGameSetup)
// This function might not be needed if placement is handled entirely within sketch.js,
// but we can keep it as a potential hook for naval-specific setup.
function initializeNavalLogic() {
    console.log("Initializing naval logic systems...");
    // Any specific setup needed for the naval module itself?
}

// --- Update Function ---
// (Called from sketch.js's drawGameScreen)
function updateNavalUnits(pGameUnits, pDeltaTime) {
    if (!pGameUnits || pGameUnits.length === 0) return;
    const dtSeconds = pDeltaTime / 1000;

    for (let unit of pGameUnits) {
        if (unit.type === 'Carrier' || unit.type === 'Submarine' || unit.type === 'Battleship') {

            // Determine speed based on type and state
            let currentSpeedDPS = 0;
            if (unit.type === 'Carrier') currentSpeedDPS = CARRIER_SPEED_DPS;
            else if (unit.type === 'Battleship') currentSpeedDPS = BATTLESHIP_SPEED_DPS;
            else if (unit.type === 'Submarine') {
                currentSpeedDPS = unit.submerged ? SUBMARINE_SPEED_SUBMERGED_DPS : SUBMARINE_SPEED_SURFACED_DPS;
            }
            let speedThisFrame = currentSpeedDPS * dtSeconds;

            // --- Movement ---
            if (unit.state === 'moving' && unit.targetLon !== undefined && unit.targetLat !== undefined) {
                let targetVector = createVector(unit.targetLon - unit.lon, unit.targetLat - unit.lat);
                let distanceToTarget = targetVector.mag();
                let arrivalThreshold = speedThisFrame * 1.1; // Allow slight overshoot

                if (distanceToTarget < arrivalThreshold || distanceToTarget <= 0) {
                    // Arrived at destination
                    unit.lon = unit.targetLon;
                    unit.lat = unit.targetLat;
                    unit.state = 'idle'; // Or 'patrolling' if that's the next step
                    unit.targetLon = undefined;
                    unit.targetLat = undefined;
                    // console.log(`${unit.type} ${unit.id} arrived at destination.`); // Reduce console spam
                } else {
                    // Move towards target
                    targetVector.normalize();
                    targetVector.mult(speedThisFrame);
                    unit.lon += targetVector.x;
                    unit.lat += targetVector.y;
                    // Basic world wrapping for longitude
                    if (unit.lon > 180) unit.lon -= 360;
                    if (unit.lon < -180) unit.lon += 360;
                    // Clamp latitude
                    unit.lat = constrain(unit.lat, -90, 90);
                }
            }

            // --- Submarine Specific Logic ---
            if (unit.type === 'Submarine') {
                // SLBM Launch is handled by launchSLBM function, called from sketch.js input
                // Stealth logic would go here (e.g., checking nearby detectors)
            }

            // --- Carrier Specific Logic ---
            if (unit.type === 'Carrier') {
                // TODO: Handle aircraft launch/recovery? (Very complex - requires aircraft logic)
            }

            // --- Battleship Specific Logic ---
            if (unit.type === 'Battleship') {
                // TODO: Handle defensive actions? (Anti-ship, AA)
            }

            // TODO: Fleet logic, detection logic, combat logic
        }
    }
}
// --- Naval Detection Update Function ---
function updateNavalDetection(pGameUnits, pPlayerTerritory) {
    if (!pGameUnits || pGameUnits.length === 0) return;

    for (let detector of pGameUnits) {
        // Only units with detectionRange can detect
        if (!detector.detectionRange || detector.detectionRange <= 0) continue;
        // Naval units detect other naval units. Radars detect missiles (handled in sketch.js).
        // For now, let's assume naval units primarily detect other naval units.
        // Carriers might also detect aircraft later.

        for (let target of pGameUnits) {
            if (detector.id === target.id) continue; // Cannot detect self
            if (detector.owner === target.owner) continue; // Don't detect own units

            // Only try to detect naval units for now
            if (!(target.type === 'Carrier' || target.type === 'Submarine' || target.type === 'Battleship')) {
                continue;
            }

            // Special rule for submarines:
            // - Surfaced subs are easier to detect.
            // - Submerged subs are harder/can only be detected by specific units (e.g., other subs, ASW - not implemented yet).
            // - For now, let's say submerged subs can only be detected if the detector is very close or is also a sub.
            let effectiveDetectionRange = detector.detectionRange;
            if (target.type === 'Submarine' && target.submerged) {
                if (detector.type !== 'Submarine' && detector.type !== 'Carrier') { // Assume carriers have some ASW
                    effectiveDetectionRange *= 0.3; // Significantly reduced range for non-ASW units against submerged subs
                }
            }
            if (detector.type === 'Submarine' && detector.submerged && target.type === 'Submarine' && target.submerged) {
                // Sub vs Sub submerged detection might be even more specialized/shorter range
                effectiveDetectionRange *= 0.7;
            }


            let dLon = detector.lon - target.lon;
            let dLat = detector.lat - target.lat;
            let distSq = dLon * dLon + dLat * dLat;

            if (distSq < effectiveDetectionRange * effectiveDetectionRange) {
                // Detected!
                if (!target.detectedBy) {
                    target.detectedBy = []; // Initialize if not present
                }
                if (!target.detectedBy.includes(detector.owner)) {
                    target.detectedBy.push(detector.owner);
                    // console.log(`${detector.type} ${detector.id} (${detector.owner}) DETECTED ${target.type} ${target.id} (${target.owner})`);
                }
            } else {
                // Optional: Implement "losing" detection if out of range
                // This requires tracking who detected whom and when.
                // For simplicity now, once detected by a faction, stays detected by them.
                // Or, clear and re-detect each frame (simpler but less "sticky")
                // Let's try clearing and re-detecting for now for player visibility.
                if (target.detectedBy && target.detectedBy.includes(pPlayerTerritory) && detector.owner === pPlayerTerritory) {
                    // If this player's unit *was* detecting it, but no longer is, remove player from detectedBy
                    // This is a simplification. True "fog of war" is more complex.
                    // For now, let's just ensure player detection is updated.
                    // If any *other* player unit still detects it, it remains detected by player.
                    // This needs a more robust check across all player units.
                }
            }
        }
    }

    // Second pass to update overall player detection status for UI
    for (let unit of pGameUnits) {
        if (unit.owner !== pPlayerTerritory) { // For enemy units
            unit.isPlayerDetected = unit.detectedBy && unit.detectedBy.includes(pPlayerTerritory);
        }
    }
}

// --- Drawing Function ---
// (Called from sketch.js's drawGameScreen)
// Relies on worldToScreen from sketch.js
function drawNavalUnits(pGameUnits, pSelectedNavalUnitId) { // Add selected ID parameter
    if (!pGameUnits || pGameUnits.length === 0) return;

    const HIGHLIGHT_COLOR = [255, 255, 0, 180]; // Yellow highlight

    push(); // Isolate drawing styles
    rectMode(CENTER); // Set once

    for (let unit of pGameUnits) {
        // Basic visibility check - don't draw submerged subs unless detected? (Needs detection logic)
        // For now, draw all player subs, maybe hide enemy submerged ones later.
        let isPlayer = unit.owner === playerTerritory; // Assumes playerTerritory is globally accessible or passed
        if (unit.type === 'Submarine' && unit.submerged && !isPlayer && !unit.isPlayerDetected) {
             continue; // Don't draw enemy submerged subs if not detected by player
        }
        // For other enemy naval units, draw them if player has detected them, or always draw if no detection system yet
        if (!isPlayer && !unit.isPlayerDetected && !(unit.type === 'Submarine' && unit.submerged) ) {
            // For now, let's draw non-submerged enemy units even if not "formally" detected by player,
            // as a full fog of war isn't implemented.
            // Later, this could be: if (!unit.isPlayerDetected) continue;
        }

        let screenPos = worldToScreen(unit.lon, unit.lat);
        let size = NAVAL_UNIT_SIZE / zoom;
        size = max(3, size); // Ensure minimum visible size

        // Simple Culling
        if (screenPos.x < -size*2 || screenPos.x > width + size*2 || screenPos.y < -size*2 || screenPos.y > height + size*2) {
            continue;
        }

        noStroke(); // Apply to all naval units for now

        let unitBaseColor;
        if (unit.type === 'Carrier') unitBaseColor = CARRIER_COLOR;
        else if (unit.type === 'Submarine') unitBaseColor = unit.submerged ? SUBMARINE_COLOR_SUBMERGED : SUBMARINE_COLOR_SURFACED;
        else if (unit.type === 'Battleship') unitBaseColor = BATTLESHIP_COLOR;
        else unitBaseColor = [100,100,100,200]; // Default fallback

        // Modify color if detected by player (for enemy units)
        let displayColor = [...unitBaseColor]; // Create a copy
        if (!isPlayer && unit.isPlayerDetected) {
            // Example: make it slightly brighter or add a tint
            displayColor[0] = min(255, displayColor[0] + 30);
            displayColor[1] = min(255, displayColor[1] + 30);
            displayColor[2] = min(255, displayColor[2] + 30);
            // Or add a specific "detected" marker later
        }
        fill(displayColor);


        if (unit.type === 'Carrier') {
            rect(screenPos.x, screenPos.y, size * 1.5, size * 0.6); // Longer, thinner rectangle
        } else if (unit.type === 'Submarine') {
            ellipse(screenPos.x, screenPos.y, size * 1.2, size * 0.5); // Elliptical shape
            if (unit.ammo !== undefined && unit.ammo <= 1 && (isPlayer || unit.isPlayerDetected)) { // Show ammo if player's or detected
                 fill(255, 0, 0, 200); // Red indicator
                 ellipse(screenPos.x + size * 0.5, screenPos.y - size * 0.2, size * 0.2);
            }
        } else if (unit.type === 'Battleship') {
            rect(screenPos.x, screenPos.y, size, size * 0.7); // Stubbier rectangle
        }

        // --- Selection Highlight ---
        if (unit.id === pSelectedNavalUnitId) {
            stroke(HIGHLIGHT_COLOR);
            strokeWeight(max(1, 2 / zoom)); // Make highlight visible
            noFill();
            // Draw highlight slightly larger than the unit icon
            if (unit.type === 'Carrier') {
                 rect(screenPos.x, screenPos.y, size * 1.5 + 4/zoom, size * 0.6 + 4/zoom);
            } else if (unit.type === 'Submarine') {
                 ellipse(screenPos.x, screenPos.y, size * 1.2 + 4/zoom, size * 0.5 + 4/zoom);
            } else if (unit.type === 'Battleship') {
                 rect(screenPos.x, screenPos.y, size + 4/zoom, size * 0.7 + 4/zoom);
            }
        }
    }

    pop(); // Restore previous drawing styles
}

// --- Helper Functions (Example) ---

function setNavalUnitDestination(unitId, targetLon, targetLat, pGameUnits) {
     let unit = pGameUnits.find(u => u.id === unitId);
     if (unit && (unit.type === 'Carrier' || unit.type === 'Submarine' || unit.type === 'Battleship')) {
         unit.targetLon = targetLon;
         unit.targetLat = targetLat;
         unit.state = 'moving';
         console.log(`Setting destination for ${unit.type} ${unit.id} to ${targetLon.toFixed(2)}, ${targetLat.toFixed(2)}`);
         return true;
     }
     return false;
}

// --- SLBM Launch Function ---
// Needs access to the main activeMissiles array from sketch.js
function launchSLBM(submarineUnit, targetLon, targetLat, pActiveMissiles) {
    if (!submarineUnit || submarineUnit.type !== 'Submarine') {
        console.error("Invalid unit provided to launchSLBM");
        return false;
    }
    if (submarineUnit.ammo === undefined || submarineUnit.ammo <= 0) {
        console.log(`Submarine ${submarineUnit.id} is out of SLBMs.`);
        return false;
    }
    // Optional: Check if submerged? DEFCON level?
    // if (!submarineUnit.submerged) {
    //     console.log(`Submarine ${submarineUnit.id} must be submerged to launch.`);
    //     return false;
    // }
    if (currentDefconLevel > 3) { // Example: Only allow SLBM launch at DEFCON 3 or lower
         console.log(`Cannot launch SLBM from ${submarineUnit.id} at DEFCON ${currentDefconLevel}`);
         return false;
    }


    console.log(`Submarine ${submarineUnit.id} launching SLBM at Lon ${targetLon.toFixed(2)}, Lat ${targetLat.toFixed(2)}`);
    submarineUnit.ammo--;

    // Add missile to the main game's activeMissiles array
    pActiveMissiles.push({
        id: `missile_${submarineUnit.owner}_${Date.now()}_${random(1000)}`,
        owner: submarineUnit.owner,
        startX: submarineUnit.lon, startY: submarineUnit.lat,
        targetX: targetLon, targetY: targetLat,
        currentX: submarineUnit.lon, currentY: submarineUnit.lat,
        type: 'SLBM', // Distinguish from ICBM if needed
        detected: false // Start undetected
    });

    // submarineUnit.state = 'reloading_slbm'; // Optional state change/cooldown

    return true; // Launch successful
}