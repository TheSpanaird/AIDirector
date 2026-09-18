import { VisionTerrainEngine } from "/modules/ai-director/scripts/engines/vision-terrain-engine.js";
import { MODULE_ID } from "/modules/ai-director/scripts/settings.js";

/**
 * AI Director - Vision Wall & Region Placer
 * Converts parsed vision objects into physical Foundry VTT Canvas Walls, 
 * Scene Regions, and Ambient Light source documents.
 */
export class VisionWallPlacer {

  /**
   * Processes an array of parsed vision objects and applies them to the active scene
   * 
   * @param {Array<Object>} visionObjects - Output array from VisionParser.parseBoundingBoxes
   * @param {Scene} scene - Target Foundry Scene (defaults to canvas.scene)
   */
  static async applyVisionObjectsToScene(visionObjects, scene = canvas.scene) {
    if (!game.user.isGM || !scene) return;

    const wallsToCreate = [];
    const lightsToCreate = [];
    const regionsToCreate = [];

    const dim = scene.dimensions;

    // Filter out all detected door and entry objects first
    const entryObjects = visionObjects?.filter(o => o.category === "DOOR_ENTRY") || [];

    // --- 1. OUTER BOUNDARY FRAME: Dynamic Sealing with Door Cutouts ---
    const outerWalls = this.buildPerimeterWalls(dim, entryObjects);
    wallsToCreate.push(...outerWalls);

    // --- 2. INTERIOR OBJECTS: Dynamic Wall & Region Assignment ---
    if (Array.isArray(visionObjects) && visionObjects.length > 0) {
      for (const obj of visionObjects) {
        const { category, bounds, center, label } = obj;

        switch (category) {
          case "STRUCTURAL_WALL": {
            // Interior Rooms, Vaults, Closets, and Wall Partitions
            const structWalls = this.buildStructuralWall(bounds, { heightTop: 10, heightBottom: 0 });
            wallsToCreate.push(...structWalls);
            break;
          }

          case "TERRAIN_OBSTACLE": {
            // Pillars, Statues, Boulders, Trees (Sight: LIMITED)
            const terrainWalls = this.buildTerrainWallBox(bounds, { heightTop: 10, heightBottom: 0 });
            wallsToCreate.push(...terrainWalls);
            break;
          }

          case "COVER": {
            // Low Furniture, Tables, Crates
            const coverWalls = this.buildTerrainWallBox(bounds, { heightTop: 4, heightBottom: 0 });
            wallsToCreate.push(...coverWalls);
            break;
          }

          case "WATER": {
            regionsToCreate.push({
              name: `Terrain: ${label || "Water"}`,
              color: "#0088ff",
              shapes: [{
                type: "rectangle",
                x: bounds.x,
                y: bounds.y,
                width: bounds.width,
                height: bounds.height,
                rotation: 0
              }],
              flags: {
                [MODULE_ID]: {
                  terrainType: "waterZone",
                  isVisionGenerated: true
                }
              }
            });
            break;
          }

          case "DOOR_ENTRY": {
            // Converts detected doors into active VTT Door Walls
            const doorWalls = this.buildDoorWall(bounds);
            wallsToCreate.push(...doorWalls);

            regionsToCreate.push({
              name: `Entry Point: ${label || "Doorway"}`,
              color: "#00ff88",
              shapes: [{
                type: "rectangle",
                x: bounds.x,
                y: bounds.y,
                width: bounds.width,
                height: bounds.height,
                rotation: 0
              }],
              flags: {
                [MODULE_ID]: {
                  isEntryAnchor: true,
                  isVisionGenerated: true
                }
              }
            });
            break;
          }

          case "LIGHT_SOURCE": {
            lightsToCreate.push({
              x: center.x,
              y: center.y,
              config: {
                dim: Math.max(bounds.width, bounds.height) * 3,
                bright: Math.max(bounds.width, bounds.height) * 1.5,
                color: "#ffaa44",
                alpha: 0.4,
                animation: { type: "torch", speed: 3, intensity: 3 }
              },
              flags: {
                [MODULE_ID]: { isVisionGenerated: true }
              }
            });
            break;
          }
        }
      }
    }

    // Execute bulk document creation queries
    if (wallsToCreate.length > 0) {
      await scene.createEmbeddedDocuments("Wall", wallsToCreate);
      console.log(`AI Director | VisionWallPlacer - Placed ${wallsToCreate.length} wall/door segments.`);
    }

    if (regionsToCreate.length > 0) {
      await scene.createEmbeddedDocuments("Region", regionsToCreate);
      console.log(`AI Director | VisionWallPlacer - Placed ${regionsToCreate.length} scene regions.`);
    }

    if (lightsToCreate.length > 0) {
      await scene.createEmbeddedDocuments("AmbientLight", lightsToCreate);
      console.log(`AI Director | VisionWallPlacer - Placed ${lightsToCreate.length} light sources.`);
    }

    ui.notifications.info(`🤖 Vision Placement Complete: Applied ${visionObjects?.length || 0} detected elements to ${scene.name}!`);
  }

  /**
   * Outer Boundary Frame: Auto-seals canvas edges while accurately leaving openings 
   * at any boundary edge where doors/entrances exist.
   */
  static buildPerimeterWalls(dim, entryObjects = []) {
    const minX = dim.sceneX;
    const minY = dim.sceneY;
    const maxX = dim.sceneX + dim.sceneWidth;
    const maxY = dim.sceneY + dim.sceneHeight;
    const threshold = 100; // Pixel proximity to canvas boundary edge

    // Define initial intact boundary sides
    let topSegments = [[minX, minY, maxX, minY]];
    let bottomSegments = [[minX, maxY, maxX, maxY]];
    let leftSegments = [[minX, minY, minX, maxY]];
    let rightSegments = [[maxX, minY, maxX, maxY]];

    for (const entry of entryObjects) {
      const e = entry.bounds;

      // Bottom Wall Check
      if (Math.abs((e.y + e.height) - maxY) < threshold || Math.abs(e.y - maxY) < threshold) {
        bottomSegments = this._subtractSegment(bottomSegments, e.x, e.x + e.width, "horizontal", maxY);
      }
      // Top Wall Check
      else if (Math.abs(e.y - minY) < threshold) {
        topSegments = this._subtractSegment(topSegments, e.x, e.x + e.width, "horizontal", minY);
      }
      // Left Wall Check
      else if (Math.abs(e.x - minX) < threshold) {
        leftSegments = this._subtractSegment(leftSegments, e.y, e.y + e.height, "vertical", minX);
      }
      // Right Wall Check
      else if (Math.abs((e.x + e.width) - maxX) < threshold || Math.abs(e.x - maxX) < threshold) {
        rightSegments = this._subtractSegment(rightSegments, e.y, e.y + e.height, "vertical", maxX);
      }
    }

    const allCoords = [...topSegments, ...bottomSegments, ...leftSegments, ...rightSegments];

    return allCoords.map(c => ({
      c: c,
      move: CONST.WALL_MOVEMENT_TYPES.NORMAL,
      sense: CONST.WALL_SENSE_TYPES.NORMAL,
      flags: { [MODULE_ID]: { isPerimeterWall: true } }
    }));
  }

  /**
   * Helper function to punch a gap into a perimeter segment for door openings.
   * @private
   */
  static _subtractSegment(segments, start, end, orientation, fixedCoord) {
    const result = [];
    for (const seg of segments) {
      const segStart = orientation === "horizontal" ? seg[0] : seg[1];
      const segEnd = orientation === "horizontal" ? seg[2] : seg[3];

      if (end <= segStart || start >= segEnd) {
        result.push(seg); // No overlap
      } else {
        // Overlap detected: split segment around gap
        if (start > segStart) {
          result.push(orientation === "horizontal" 
            ? [segStart, fixedCoord, start, fixedCoord] 
            : [fixedCoord, segStart, fixedCoord, start]);
        }
        if (end < segEnd) {
          result.push(orientation === "horizontal" 
            ? [end, fixedCoord, segEnd, fixedCoord] 
            : [fixedCoord, end, fixedCoord, segEnd]);
        }
      }
    }
    return result;
  }

  /**
   * Builds Interactive Openable Door Walls across detected doorways or entryways.
   */
  static buildDoorWall(bounds) {
    const { x, y, width, height } = bounds;
    let c = [];

    // Orient door along its longest dimension
    if (width >= height) {
      const midY = y + (height / 2);
      c = [x, midY, x + width, midY];
    } else {
      const midX = x + (width / 2);
      c = [midX, y, midX, y + height];
    }

    return [{
      c: c,
      move: CONST.WALL_MOVEMENT_TYPES.NORMAL,
      sense: CONST.WALL_SENSE_TYPES.NORMAL,
      door: CONST.WALL_DOOR_TYPES.DOOR,
      ds: CONST.WALL_DOOR_STATES.CLOSED,
      flags: { [MODULE_ID]: { isDoorWall: true } }
    }];
  }

  /**
   * Builds Normal Structural Walls for internal rooms, vaults, closets, or partition fragments.
   */
  static buildStructuralWall(bounds, { heightTop = 10, heightBottom = 0 } = {}) {
    const { x, y, width, height } = bounds;
    const aspectRatio = Math.max(width / height, height / width);

    let segments = [];

    // Single partition wall vs enclosed room box
    if (aspectRatio >= 2.2) {
      if (width >= height) {
        const midY = y + (height / 2);
        segments.push([x, midY, x + width, midY]);
      } else {
        const midX = x + (width / 2);
        segments.push([midX, y, midX, y + height]);
      }
    } else {
      segments.push(
        [x, y, x + width, y],
        [x + width, y, x + width, y + height],
        [x + width, y + height, x, y + height],
        [x, y + height, x, y]
      );
    }

    return segments.map(c => {
      const wallData = {
        c: c,
        move: CONST.WALL_MOVEMENT_TYPES.NORMAL,
        sense: CONST.WALL_SENSE_TYPES.NORMAL,
        flags: { [MODULE_ID]: { isStructuralWall: true } }
      };

      if (heightTop !== null || heightBottom !== null) {
        wallData.flags["wall-height"] = { top: heightTop, bottom: heightBottom };
      }

      return wallData;
    });
  }

  /**
   * Builds Terrain Walls for pillars, trees, boulders, and furniture (Sight: LIMITED).
   */
  static buildTerrainWallBox(bounds, { heightTop = 5, heightBottom = 0 } = {}) {
    const { x, y, width, height } = bounds;

    const segments = [
      [x, y, x + width, y],
      [x + width, y, x + width, y + height],
      [x + width, y + height, x, y + height],
      [x, y + height, x, y]
    ];

    return segments.map(c => {
      const wallData = {
        c: c,
        move: CONST.WALL_MOVEMENT_TYPES.NORMAL,
        sense: CONST.WALL_SENSE_TYPES.LIMITED,
        flags: { [MODULE_ID]: { isTerrainWall: true } }
      };

      if (heightTop !== null || heightBottom !== null) {
        wallData.flags["wall-height"] = { top: heightTop, bottom: heightBottom };
      }

      return wallData;
    });
  }
}