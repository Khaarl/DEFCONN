// neutral_units.js

// --- Constants ---
const NUM_NEUTRAL_PLANES = 10;
const PLANE_SPEED_DEG_PER_SEC = 2.0; // Speed in world degrees per second
const PLANE_MAX_LEG_DIST_DEG = 45;  // Max distance for a single flight leg (degrees)
const PLANE_COLOR = [200, 200, 200, 180]; // Light grey color
const PLANE_SIZE = 6; // Base size in pixels

// --- Data ---
let neutralPlanes = []; // Array to hold plane objects

// --- Initialization Function ---
function initializeNeutralPlanes(allGameCities) {
    console.log("Initializing neutral planes...");
    neutralPlanes = []; // Clear existing planes

    if (!allGameCities || allGameCities.length === 0) {
        console.warn("Cannot initialize planes: No gameCities provided.");
        return;
    }

    for (let i = 0; i < NUM_NEUTRAL_PLANES; i++) {
        // Pick a random starting city (must not be destroyed)
        let startCity = null;
        let attempts = 0;
        while (!startCity && attempts < allGameCities.length * 2) {
             let potentialStart = random(allGameCities);
             if (!potentialStart.destroyed) {
                 startCity = potentialStart;
             }
             attempts++;
        }

        if (!startCity) {
            console.warn(`Could not find a non-destroyed starting city for plane ${i}. Skipping.`);
            continue; // Skip this plane if no suitable start found
        }


        // Find a suitable destination
        let destinationCity = findNewPlaneDestination(startCity, allGameCities);

        if (!destinationCity) {
             console.warn(`Could not find destination for plane starting at ${startCity.name}. Skipping.`);
             continue; // Skip if no destination found
        }

        neutralPlanes.push({
            id: `plane_${Date.now()}_${random(1000)}`,
            originCity: startCity,
            destinationCity: destinationCity,
            currentLon: startCity.lon,
            currentLat: startCity.lat,
            progress: 0, // Distance covered on current leg
            state: 'flying'
        });
    }
    console.log(`Initialized ${neutralPlanes.length} neutral planes.`);
}

// --- Helper: Find a new destination ---
function findNewPlaneDestination(currentCity, allGameCities) {
    let potentialDestinations = [];
    for (let city of allGameCities) {
        if (city.id === currentCity.id || city.destroyed) continue; // Don't fly to self or destroyed

        // Calculate distance (simple degrees approximation)
        let dLon = city.lon - currentCity.lon;
        let dLat = city.lat - currentCity.lat;
        let distSq = dLon*dLon + dLat*dLat;

        if (distSq < PLANE_MAX_LEG_DIST_DEG * PLANE_MAX_LEG_DIST_DEG) {
            potentialDestinations.push(city);
        }
    }

    if (potentialDestinations.length > 0) {
        return random(potentialDestinations); // Pick a random nearby city
    } else {
        // Fallback: if no city is within medium range, pick any other non-destroyed city
        let fallbackDestinations = allGameCities.filter(c => c.id !== currentCity.id && !c.destroyed);
         if(fallbackDestinations.length > 0) {
             console.log(`Plane at ${currentCity.name}: No nearby destination found, choosing random fallback.`);
             return random(fallbackDestinations);
         } else {
             return null; // No possible destinations
         }
    }
}


// --- Update Function ---
function updateNeutralPlanes(allGameCities, pDeltaTime) { // Pass deltaTime
    if (!allGameCities || allGameCities.length === 0) return; // Need cities to function

    let speedThisFrame = PLANE_SPEED_DEG_PER_SEC * (pDeltaTime / 1000);

    for (let i = neutralPlanes.length - 1; i >= 0; i--) { // Iterate backwards if we might remove items
        let plane = neutralPlanes[i];

        if (!plane.originCity || !plane.destinationCity) {
            // Should not happen, but handle gracefully if data is bad
             console.warn(`Plane ${plane.id} missing origin/destination. Removing.`);
             neutralPlanes.splice(i, 1);
             continue;
        }

        // Ensure destination isn't destroyed mid-flight; pick new one if it is.
        if (plane.destinationCity.destroyed) {
             console.log(`Plane ${plane.id} destination ${plane.destinationCity.name} destroyed. Finding new destination.`);
             let newDest = findNewPlaneDestination(plane.originCity, allGameCities);
             if (newDest) {
                 plane.destinationCity = newDest;
                 plane.progress = 0; // Restart progress towards new destination
             } else {
                 console.warn(`Plane ${plane.id} cannot find any valid destination. Removing.`);
                 neutralPlanes.splice(i, 1); // Remove if no destination possible
                 continue;
             }
        }


        // Calculate vector and distance for the current leg
        let dLon = plane.destinationCity.lon - plane.originCity.lon;
        let dLat = plane.destinationCity.lat - plane.originCity.lat;
        let totalDist = sqrt(dLon*dLon + dLat*dLat);

        if (totalDist <= 0.01) { // Avoid division by zero / handle arrival at same spot?
             // Already at destination or very close, find a new one immediately
             plane.originCity = plane.destinationCity;
             plane.currentLon = plane.originCity.lon;
             plane.currentLat = plane.originCity.lat;
             let nextDest = findNewPlaneDestination(plane.originCity, allGameCities);
             if(nextDest){
                plane.destinationCity = nextDest;
                plane.progress = 0;
             } else {
                 console.warn(`Plane ${plane.id} cannot find next destination. Removing.`);
                 neutralPlanes.splice(i, 1);
                 continue;
             }
        } else {
            // Move the plane
            plane.progress += speedThisFrame;

            // Check for arrival
            if (plane.progress >= totalDist) {
                // Arrived!
                plane.originCity = plane.destinationCity; // New origin is the destination just reached
                plane.currentLon = plane.originCity.lon; // Snap to exact city location
                plane.currentLat = plane.originCity.lat;

                // Find a new destination
                let nextDest = findNewPlaneDestination(plane.originCity, allGameCities);
                if (nextDest) {
                    plane.destinationCity = nextDest;
                    plane.progress = 0; // Reset progress for the new leg
                     // console.log(`Plane ${plane.id} arrived at ${plane.originCity.name}, new destination: ${plane.destinationCity.name}`); // DEBUG
                } else {
                     // No more valid destinations? Remove the plane.
                     console.warn(`Plane ${plane.id} arrived at ${plane.originCity.name} but cannot find next destination. Removing.`);
                     neutralPlanes.splice(i, 1);
                     continue;
                }

            } else {
                // Still flying: Interpolate position
                let percentage = plane.progress / totalDist;
                plane.currentLon = lerp(plane.originCity.lon, plane.destinationCity.lon, percentage);
                plane.currentLat = lerp(plane.originCity.lat, plane.destinationCity.lat, percentage);
            }
        }
    }
}

// --- Drawing Function ---
// NOTE: This function relies on `worldToScreen` being globally available from sketch.js
// and p5 drawing functions (fill, stroke, ellipse, etc.)
function drawNeutralPlanes() {
    push(); // Isolate drawing styles
    fill(PLANE_COLOR[0], PLANE_COLOR[1], PLANE_COLOR[2], PLANE_COLOR[3]);
    noStroke();
    // Or use stroke:
    // noFill();
    // stroke(PLANE_COLOR[0], PLANE_COLOR[1], PLANE_COLOR[2], PLANE_COLOR[3]);
    // strokeWeight(max(1, 2 / zoom)); // Adjust based on zoom?

    let size = PLANE_SIZE / zoom; // Make apparent size consistent regardless of zoom
    size = max(2, size); // Ensure minimum size

    for (let plane of neutralPlanes) {
        let screenPos = worldToScreen(plane.currentLon, plane.currentLat);

        // Simple Culling
         if (screenPos.x < -20 || screenPos.x > width + 20 || screenPos.y < -20 || screenPos.y > height + 20) {
             continue;
         }

        // Draw a simple '+' shape
        rectMode(CENTER);
        rect(screenPos.x, screenPos.y, size, size / 3); // Horizontal bar
        rect(screenPos.x, screenPos.y, size / 3, size); // Vertical bar

        // // Alternative: Draw a small circle
        // ellipse(screenPos.x, screenPos.y, size, size);
    }
    pop(); // Restore previous drawing styles
}