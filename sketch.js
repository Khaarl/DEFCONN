// sketch.js

let worldGeoJSON;
let citiesGeoJSON;

let mapImage; // To draw the map onto once, for performance

const DEFCON_BG_COLOR = [0, 0, 26]; // Very dark navy
const DEFCON_LAND_COLOR = [0, 80, 150]; // A medium blue
const DEFCON_CITY_COLOR = [200, 200, 100]; // Pale yellow for cities

function preload() {
    worldGeoJSON = loadJSON('countries.geojson');
    citiesGeoJSON = loadJSON('cities.geojson');
}

function setup() {
    createCanvas(windowWidth, windowHeight);
    // Create a graphics buffer to draw the static map onto
    mapImage = createGraphics(width, height);
    drawMapToBuffer(); // Draw the map once
    console.log("World data loaded:", worldGeoJSON);
    console.log("Cities data loaded:", citiesGeoJSON);
}

function draw() {
    background(DEFCON_BG_COLOR[0], DEFCON_BG_COLOR[1], DEFCON_BG_COLOR[2]);
    image(mapImage, 0, 0); // Draw the pre-rendered map
    // In future phases, dynamic elements (units, missiles) will be drawn on top here
}

function drawMapToBuffer() {
    mapImage.clear(); // Clear the buffer if redrawing
    mapImage.background(DEFCON_BG_COLOR[0], DEFCON_BG_COLOR[1], DEFCON_BG_COLOR[2]); // Not strictly needed if clearing

    // --- Draw Countries ---
    if (worldGeoJSON && worldGeoJSON.features) {
        mapImage.stroke(DEFCON_LAND_COLOR[0], DEFCON_LAND_COLOR[1], DEFCON_LAND_COLOR[2]);
        mapImage.strokeWeight(0.5); // Thin lines
        mapImage.noFill();

        for (let feature of worldGeoJSON.features) {
            let geometry = feature.geometry;
            if (geometry.type === 'Polygon') {
                drawPolygon(geometry.coordinates[0], mapImage);
            } else if (geometry.type === 'MultiPolygon') {
                for (let polygon of geometry.coordinates) {
                    drawPolygon(polygon[0], mapImage);
                }
            }
        }
    }

    // --- Draw Cities (Population > 1 Million) ---
    if (citiesGeoJSON && citiesGeoJSON.features) {
        mapImage.noStroke();
        mapImage.fill(DEFCON_CITY_COLOR[0], DEFCON_CITY_COLOR[1], DEFCON_CITY_COLOR[2]);
        const cityDotSize = 3; // Size of the city dot

        for (let feature of citiesGeoJSON.features) {
            // Check the property name for population in your specific GeoJSON file!
            // Common names: pop_max, POP_MAX, population
            let population = feature.properties.POP_MAX;

            if (population && population > 1000000) {
                let coords = feature.geometry.coordinates; // [longitude, latitude]
                let x = map(coords[0], -180, 180, 0, width);
                let y = map(coords[1], 90, -90, 0, height); // Latitude is inverted for screen Y

                mapImage.ellipse(x, y, cityDotSize, cityDotSize);
            }
        }
    }
}

// Helper function to draw a polygon (list of points)
function drawPolygon(polygonPoints, buffer) {
    buffer.beginShape();
    for (let point of polygonPoints) {
        let lon = point[0];
        let lat = point[1];
        // Equirectangular projection:
        let x = map(lon, -180, 180, 0, width);
        let y = map(lat, 90, -90, 0, height); // Invert Y-axis for latitude
        buffer.vertex(x, y);
    }
    buffer.endShape(CLOSE);
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
    // Re-create and re-draw the map buffer on resize
    mapImage = createGraphics(width, height);
    drawMapToBuffer();
}