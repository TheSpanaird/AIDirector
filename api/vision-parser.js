import { MODULE_ID } from "/modules/ai-director/scripts/settings.js";

/**
 * AI Director - Vision Extraction & Coordinate Parser (Task 4B.2)
 * Converts Florence-2/SAM 2 normalized coordinates (0..1000) into 
 * exact pixel coordinates mapped against Foundry VTT Scene Dimensions.
 */
export class VisionParser {

  /**
   * Intelligently classifies vision detections into tactical categories and structural wall profiles.
   * Evaluates semantic labels, aspect ratios, and surface areas to distinguish rooms/walls from terrain.
   * 
   * @param {string} label - Detected object label
   * @param {Object} bounds - Calculated scene canvas bounds {x, y, width, height}
   * @returns {string} Fine-grained category identifier
   */
  static classifyLabel(label = "", bounds = { width: 100, height: 100 }) {
    const l = label.toLowerCase().trim();
    const width = bounds.width || 100;
    const height = bounds.height || 100;
    
    // Calculate aspect ratio and area for geometric classification
    const maxDim = Math.max(width, height);
    const minDim = Math.min(width, height);
    const aspectRatio = maxDim / Math.max(1, minDim);
    const area = width * height;

    // 1. Doors, Entries, and Stairs
    if (l.includes("door") || l.includes("entrance") || l.includes("exit") || l.includes("stair") || l.includes("gate")) {
      return "DOOR_ENTRY";
    }

    // 2. Ambient Light Sources
    if (l.includes("light") || l.includes("chandelier") || l.includes("torch") || l.includes("lamp") || l.includes("fire") || l.includes("brazier")) {
      return "LIGHT_SOURCE";
    }

    // 3. Water and Fluid Terrain Zones
    if (l.includes("water") || l.includes("pool") || l.includes("river") || l.includes("stream") || l.includes("swamp") || l.includes("lake")) {
      return "WATER";
    }

    // 4. Structural Hard Walls & Interior Enclosures (Standard Normal Walls)
    if (l.includes("wall") || l.includes("vault") || l.includes("closet") || l.includes("room") || l.includes("partition") || l.includes("corridor")) {
      return "STRUCTURAL_WALL";
    }

    // Geometric Fallback: Long, narrow interior features (aspect ratio >= 2.5) are wall fragments/partitions
    if (aspectRatio >= 2.5 && area >= 20000) {
      return "STRUCTURAL_WALL";
    }

    // 5. Interior Terrain Obstacles (Trees, Pillars, Boulders, Statues) -> Terrain Walls
    if (l.includes("pillar") || l.includes("column") || l.includes("statue") || l.includes("tree") || l.includes("boulder") || l.includes("rock") || l.includes("obelisk")) {
      return "TERRAIN_OBSTACLE";
    }

    // 6. Low Cover & Furniture (Tables, Crates, Bar Counters, Benches) -> Low Terrain Walls
    if (l.includes("table") || l.includes("bar") || l.includes("counter") || l.includes("crate") || l.includes("chest") || l.includes("bench") || l.includes("bed") || l.includes("barrel") || l.includes("sofa") || l.includes("throne")) {
      return "COVER";
    }

    // Default fallback: Compact items act as low terrain cover
    return "COVER";
  }

  /**
   * Main Parsing Method: Converts 0..1000 normalized coordinates (JSON or Florence Token String)
   * to Foundry scene canvas space.
   * 
   * @param {Object|string} florenceOutput - Raw payload or string from Florence-2 / Node 18
   * @param {Scene} scene - Target Foundry Scene (defaults to canvas.scene)
   * @returns {Array<Object>} Extracted semantic objects with exact pixel bounds
   */
  static parseBoundingBoxes(florenceOutput, scene = canvas.scene) {
    if (!florenceOutput || !scene) return [];

    let detections = {};

    // 1. Parse Input Data Structure
    if (typeof florenceOutput === "string") {
      const trimmed = florenceOutput.trim();
      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        try {
          const parsed = JSON.parse(trimmed);
          detections = parsed["<OPEN_VOCABULARY_DETECTION>"] || parsed;
        } catch (e) {
          console.warn("AI Director | VisionParser - Failed to parse JSON, falling back to raw token parsing.");
          detections = this._parseTokenString(trimmed);
        }
      } else {
        detections = this._parseTokenString(trimmed);
      }
    } else if (typeof florenceOutput === "object") {
      detections = florenceOutput["<OPEN_VOCABULARY_DETECTION>"] || florenceOutput;
    }

    if (!detections || typeof detections !== "object") return [];

    const parsedObjects = [];
    const dim = scene.dimensions;
    const gridSize = dim.size || 100;

    // 2. Map Coordinates to Scene Canvas Space
    for (const [label, boxes] of Object.entries(detections)) {
      if (!Array.isArray(boxes)) continue;

      for (const box of boxes) {
        if (!Array.isArray(box) || box.length < 4) continue;

        // Florence-2 output format: [ymin, xmin, ymax, xmax] normalized (0..1000)
        const [ymin, xmin, ymax, xmax] = box;

        // Map 0..1000 normalized coordinates directly to raw map image dimensions
        const imgX = (xmin / 1000) * dim.sceneWidth;
        const imgY = (ymin / 1000) * dim.sceneHeight;
        const imgW = ((xmax - xmin) / 1000) * dim.sceneWidth;
        const imgH = ((ymax - ymin) / 1000) * dim.sceneHeight;

        // Add scene.dimensions offsets (sceneX, sceneY) created by canvas padding
        const canvasX = dim.sceneX + imgX;
        const canvasY = dim.sceneY + imgY;

        // Snap coordinates cleanly to grid
        const gridX = Math.floor(canvasX / gridSize) * gridSize;
        const gridY = Math.floor(canvasY / gridSize) * gridSize;
        const gridW = Math.max(gridSize, Math.ceil(imgW / gridSize) * gridSize);
        const gridH = Math.max(gridSize, Math.ceil(imgH / gridSize) * gridSize);

        const tempBounds = { x: gridX, y: gridY, width: gridW, height: gridH };
        const category = this.classifyLabel(label, tempBounds);

        parsedObjects.push({
          id: `vision_${label.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          label: label.toLowerCase().trim(),
          category: category,
          bounds: tempBounds,
          center: { x: gridX + (gridW / 2), y: gridY + (gridH / 2) },
          rawBox: [ymin, xmin, ymax, xmax]
        });
      }
    }

    console.log(`AI Director | VisionParser - Extracted ${parsedObjects.length} semantic objects with v13 dimension alignment.`);
    return parsedObjects;
  }

  /**
   * Helper Parser: Converts raw Florence-2 loc token strings into structured detection map objects.
   * Example: "door <loc_100><loc_200><loc_150><loc_250>" -> { "door": [[100, 200, 150, 250]] }
   * 
   * @param {string} rawString 
   * @returns {Object} Structured detection map
   * @private
   */
  static _parseTokenString(rawString) {
    const map = {};
    const regex = /([a-zA-Z0-9_\s]+)<loc_(\d+)><loc_(\d+)><loc_(\d+)><loc_(\d+)>/g;
    let match;

    while ((match = regex.exec(rawString)) !== null) {
      const label = match[1].trim().toLowerCase();
      const ymin = parseInt(match[2], 10);
      const xmin = parseInt(match[3], 10);
      const ymax = parseInt(match[4], 10);
      const xmax = parseInt(match[5], 10);

      if (!map[label]) map[label] = [];
      map[label].push([ymin, xmin, ymax, xmax]);
    }

    return map;
  }

  /**
   * Reads a raw text vision payload and applies wall/region/light placements on the scene.
   * 
   * @param {string|Object} visionPayloadRaw - Output string or JSON from Node 18
   * @param {Scene} scene - Target Foundry Scene (defaults to canvas.scene)
   * @returns {Promise<Array<Object>>} Parsed vision objects applied to scene
   */
  static async parseAndApplyVision(visionPayloadRaw, scene = canvas.scene) {
    if (!game.user.isGM || !scene) {
      ui.notifications.warn("AI Director | Only the GM can execute vision parsing.");
      return [];
    }

    if (!visionPayloadRaw) {
      ui.notifications.error("AI Director | Vision parser received an empty payload.");
      return [];
    }

    try {
      // 1. Parse bounding boxes into V13 scene canvas space
      const parsedObjects = this.parseBoundingBoxes(visionPayloadRaw, scene);

      // 2. Place walls, lights, and regions dynamically via VisionWallPlacer
      const { VisionWallPlacer } = await import('/modules/ai-director/scripts/engines/vision-wall-placer.js');
      await VisionWallPlacer.applyVisionObjectsToScene(parsedObjects, scene);

      return parsedObjects;
    } catch (err) {
      console.error("AI Director | Failed to parse and apply vision payload:", err);
      ui.notifications.error("AI Director | Error occurred while parsing vision payload.");
      return [];
    }
  }
}