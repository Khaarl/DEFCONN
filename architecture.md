# DEFCON Map Tribute Architecture

This document outlines the architecture, core logic, file structure, and data flow of the DEFCON Map Tribute project.

## 1. Overview

The project is a web-based simulation inspired by the game DEFCON, built using the p5.js library for graphics and interaction. It simulates a global conflict scenario on a world map, involving territory control, unit placement (silos, radars, naval units), missile launches, defense systems (ABMs), and scoring based on population casualties.

## 2. Folder Structure

The project follows a relatively flat structure:

```
.
├── MUSIC/                  # Contains background music tracks (.mp3)
│   ├── Al_Basrah.mp3
│   ├── Cairo_Egypt.mp3
│   └── ... (other tracks)
├── cities.geojson          # GeoJSON data for city locations and populations
├── countries.geojson       # GeoJSON data for country borders
├── index.html              # Main HTML entry point
├── naval_units.js          # Logic for naval units (Carriers, Subs, Battleships)
├── neutral_units.js        # Logic for neutral aircraft simulation
├── p5.js                   # p5.js library (full version)
├── p5.min.js               # p5.js library (minified version)
├── p5.sound.js             # p5.js sound library (full version)
├── p5.sound.min.js         # p5.js sound library (minified version)
├── serve.py                # Simple Python HTTP server for local development
└── sketch.js               # Core application logic, game state, rendering
```

-   **Root Directory**: Contains the main HTML file, core JavaScript logic (`sketch.js`), specialized unit logic (`naval_units.js`, `neutral_units.js`), p5.js library files, GeoJSON map data, and a helper Python server script.
-   **`MUSIC/`**: Stores all audio files used for background music.

## 3. Core Logic and File Responsibilities

The application logic is primarily driven by `sketch.js` and modularized into specific files for different unit types.

-   **[`index.html`](index.html)**:
    -   Sets up the basic HTML structure.
    -   Includes the p5.js core and sound libraries ([`p5.min.js`](p5.min.js), [`p5.sound.min.js`](p5.sound.min.js)).
    -   Includes the JavaScript files containing the game logic: [`neutral_units.js`](neutral_units.js), [`naval_units.js`](naval_units.js), and the main [`sketch.js`](sketch.js).
    -   Defines basic CSS for layout.

-   **[`sketch.js`](sketch.js)**: This is the central hub of the application.
    -   **Initialization (`preload`, `setup`)**: Loads assets ([`countries.geojson`](countries.geojson), [`cities.geojson`](cities.geojson), music files from [`MUSIC/`](MUSIC/)) and sets up the p5.js canvas.
    -   **Game State Management**: Manages the overall game state (`gameState`: 'MainMenu', 'Options', 'Setup', 'Playing') and transitions between states.
    -   **Main Loop (`draw`)**: The core rendering loop that calls appropriate drawing functions based on the `gameState`. In the 'Playing' state, it orchestrates updates and drawing for all game elements.
    -   **Map Rendering**: Draws the world map using GeoJSON data and handles zooming/panning transformations ([`drawBackgroundMapAndCities`](sketch.js:222), [`worldToScreen`](sketch.js:1028), [`screenToWorld`](sketch.js:1035)).
    -   **User Input Handling**: Manages mouse clicks ([`mousePressed`](sketch.js:1365)), drags ([`mouseDragged`](sketch.js:1655)), releases ([`mouseReleased`](sketch.js:1688)), mouse wheel ([`mouseWheel`](sketch.js:1759)), and keyboard input ([`keyPressed`](sketch.js:1778), [`handleKeyboardPanning`](sketch.js:171)) for interaction, unit selection/placement, targeting, and map navigation.
    -   **Unit Management**: Stores and manages data for all game units (`gameUnits`) and cities (`gameCities`). Handles unit placement during the 'Setup' phase.
    -   **Core Gameplay Logic**: Updates game time, DEFCON level ([`updateGameTimeAndDefcon`](sketch.js:761)), AI actions ([`updateAI`](sketch.js:692)), detection logic ([`updateDetection`](sketch.js:776)), defensive actions (ABM launches - [`updateDefenseActions`](sketch.js:906)), missile movement/impact ([`updateMissiles`](sketch.js:957), [`updateABMs`](sketch.js:1893)), and scoring.
    -   **Drawing Orchestration**: Calls drawing functions for the map, units ([`drawUnit`](sketch.js:1140)), missiles ([`drawMissiles`](sketch.js:1237)), ABMs ([`drawABMs`](sketch.js:1945)), explosions ([`drawExplosions`](sketch.js:1289)), and UI elements ([`drawGameUIOverlay`](sketch.js:387)).
    -   **Module Integration**: Calls update and draw functions from [`neutral_units.js`](neutral_units.js) and [`naval_units.js`](naval_units.js).
    -   **Music Control**: Manages background music playback ([`startMusic`](sketch.js:443), [`stopMusic`](sketch.js:465), [`playNextTrack`](sketch.js:475)).

-   **[`neutral_units.js`](neutral_units.js)**:
    -   Manages the simulation of neutral civilian aircraft flying between cities.
    -   Initializes plane positions ([`initializeNeutralPlanes`](neutral_units.js:14)).
    -   Updates plane positions and destinations each frame ([`updateNeutralPlanes`](neutral_units.js:94)).
    -   Draws the planes on the map ([`drawNeutralPlanes`](neutral_units.js:180)).
    -   Depends on `sketch.js` for city data (`gameCities`) and the `worldToScreen` function.

-   **[`naval_units.js`](naval_units.js)**:
    -   Handles logic specific to naval units (Carriers, Submarines, Battleships).
    -   Updates naval unit movement based on speed and target destination ([`updateNavalUnits`](naval_units.js:46)).
    -   Manages submarine states (submerged/surfaced) and SLBM ammo/launching ([`launchSLBM`](naval_units.js:297)).
    -   Implements naval detection logic ([`updateNavalDetection`](naval_units.js:111)).
    -   Draws naval units with appropriate icons and states ([`drawNavalUnits`](naval_units.js:187)).
    -   Provides helper functions for naval actions (e.g., [`setNavalUnitDestination`](naval_units.js:283)).
    -   Relies on `sketch.js` for the main `gameUnits` array, `activeMissiles` array, `playerTerritory`, DEFCON level, and drawing functions like `worldToScreen`.

-   **[`serve.py`](serve.py)**:
    -   A simple Python script using the built-in `http.server` module.
    -   Used to run a local web server. This is necessary because web browsers restrict loading local files (like GeoJSON or sound files via `loadJSON`, `loadSound`) directly from the filesystem (`file:///`) for security reasons. Running a local server bypasses these restrictions during development.

## 4. Data Flow

1.  **Initialization**: `index.html` loads scripts -> `sketch.js` preloads GeoJSON/Music -> `sketch.js` sets up the canvas.
2.  **Game Start**: User interacts with the Main Menu -> `gameState` changes -> `initializeGameSetup` in `sketch.js` populates `gameCities` and `gameUnits` (including initial naval/land assets), potentially calling initialization functions in modules like `initializeNeutralPlanes`.
3.  **Setup Phase**: User clicks on the map -> `handleSetupClick` in `sketch.js` places units within their territory.
4.  **Playing Phase**:
    -   `draw()` loop runs continuously.
    -   `updateGameTimeAndDefcon` updates timers and game state.
    -   `updateAI` makes decisions for AI territories (e.g., launching missiles).
    -   `updateDetection` checks for radar/naval detections.
    -   `updateDefenseActions` launches ABMs against detected threats.
    -   `updateMissiles` / `updateABMs` move projectiles.
    -   `updateNeutralPlanes` (from `neutral_units.js`) moves civilian aircraft.
    -   `updateNavalUnits` / `updateNavalDetection` (from `naval_units.js`) moves ships, handles sub states, and updates naval visibility.
    -   Various `draw...` functions render the current state to the canvas using data from `gameUnits`, `gameCities`, `activeMissiles`, etc., transforming world coordinates to screen coordinates.
5.  **User Interaction**: Clicks/keys trigger event handlers in `sketch.js` -> State variables (e.g., `selectedUnitForFiring`, `selectedCityForTargeting`, map `zoom`/`centerLon`/`centerLat`) are updated -> Actions are triggered (e.g., `launchSLBM` in `naval_units.js` is called, adding to `activeMissiles`).

## 5. Key Libraries/Technologies

-   **p5.js**: Core library for drawing, animation, and user interaction.
-   **p5.sound.js**: Add-on library for loading and playing audio.
-   **JavaScript (ES6+)**: Primary programming language.
-   **HTML5/CSS3**: For structuring the web page and basic styling.
-   **GeoJSON**: Standard format for encoding geographic data structures, used for map borders and city data.
-   **(Optional) Python**: Used via `serve.py` for a simple development server.