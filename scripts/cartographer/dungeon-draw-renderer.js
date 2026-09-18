// modules/ai-director/scripts/dungeon-draw/dungeon-draw-renderer.js

/**
 * dungeon-draw-renderer.js
 * Programmatically renders generated dungeon floors, walls, and doors onto the Foundry canvas.
 */

import { ShapePrimitiveGenerator } from "./shape-primitive-generator.js";
import { CorridorRouterEngine } from "./corridor-router-engine.js";

export class DungeonDrawRenderer {
  /**
   * Main entry point to render an entire processed layout layout onto the active Scene.
   * 
   * @param {Object} processedLayout - Output from SpatialLayoutEngine.processLayout()
   * @param {Object} [options] - Rendering options (theme, door state, layer targeting)
   */
  static async renderToScene(processedLayout, options = {}) {
    if (!canvas.scene) {
      ui.notifications.error("AI Director | No active scene to render dungeon onto.");
      return;
    }

    const { floors } = processedLayout;
    const renderStats = { roomsRendered: 0, corridorsRendered: 0, doorsPlaced: 0 };

    // Process each floor (defaults to Floor 1 if single floor)
    for (const [floorNum, floorData] of Object.entries(floors)) {
      const { sectors } = floorData;

      // 1. Generate Corridor Routes
      const connections = this._extractConnectionsFromSectors(sectors);
      const routes = CorridorRouterEngine.routeConnections(connections, sectors);

      // 2. Render Rooms (Floors & Walls)
      for (const sector of sectors) {
        const polygon = ShapePrimitiveGenerator.generatePolygon(
          sector.pixelBounds,
          sector.shapePrimitive,
          canvas.grid.size
        );
        
        await this._drawRoomShape(polygon, sector, options);
        renderStats.roomsRendered++;
      }

      // 3. Render Corridors
      for (const route of routes) {
        await this._drawCorridorShape(route.corridorPolygon, options);
        renderStats.corridorsRendered++;

        // 4. Place Doors at Connection Anchors
        await this._placeDoorway(route, options);
        renderStats.doorsPlaced++;
      }
    }

    ui.notifications.info(
      `AI Director | Dungeon rendering complete! Built ${renderStats.roomsRendered} rooms, ${renderStats.corridorsRendered} corridors, and ${renderStats.doorsPlaced} doors.`
    );
  }

  /**
   * Integrates with Dungeon Draw API or native Drawing Document creation for Room Polygons.
   */
  static async _drawRoomShape(polygon, sector, options) {
    const flatPoints = polygon.flat();
    
    // Check if Dungeon Draw module is active
    const dungeonDrawApi = game.modules.get("dungeon-draw")?.api;

    if (dungeonDrawApi) {
      // Direct integration with Dungeon Draw API layer
      await dungeonDrawApi.createRoom({
        points: flatPoints,
        name: sector.name || sector.sectorId,
        theme: options.theme || "default"
      });
    } else {
      // Fallback: Native Foundry Drawing Document
      const drawingData = {
        type: CONST.DRAWING_TYPES.POLYGON,
        author: game.user.id,
        x: sector.pixelBounds.x,
        y: sector.pixelBounds.y,
        shape: {
          type: "p",
          points: flatPoints
        },
        fillType: CONST.DRAWING_FILL_TYPES.SOLID,
        fillColor: options.fillColor || "#222222",
        fillAlpha: 0.8,
        strokeWidth: 4,
        strokeColor: options.strokeColor || "#999999",
        text: sector.name || sector.sectorId
      };

      await canvas.scene.createEmbeddedDocuments("Drawing", [drawingData]);
    }
  }

  /**
   * Renders corridor bounding shapes.
   */
  static async _drawCorridorShape(corridorPolygon, options) {
    if (!corridorPolygon.length) return;
    const flatPoints = corridorPolygon.flat();

    const drawingData = {
      type: CONST.DRAWING_TYPES.POLYGON,
      author: game.user.id,
      shape: {
        type: "p",
        points: flatPoints
      },
      fillType: CONST.DRAWING_FILL_TYPES.SOLID,
      fillColor: options.corridorColor || "#111111",
      fillAlpha: 0.9,
      strokeWidth: 2,
      strokeColor: "#555555"
    };

    await canvas.scene.createEmbeddedDocuments("Drawing", [drawingData]);
  }

  /**
   * Creates native Foundry Door/Wall documents at connection points.
   */
  static async _placeDoorway(route, options) {
    const { source } = route.anchors;
    const doorSize = canvas.grid.size; // 1 grid unit door width

    // Calculate door wall line coordinates (orthogonal to side direction)
    let c = [source.x, source.y, source.x, source.y];

    if (source.side === "NORTH" || source.side === "SOUTH") {
      c = [source.x - doorSize / 2, source.y, source.x + doorSize / 2, source.y];
    } else {
      c = [source.x, source.y - doorSize / 2, source.x, source.y + doorSize / 2];
    }

    // Determine door type flag
    let doorType = CONST.WALL_DOOR_TYPES.DOOR;
    let doorState = CONST.WALL_DOOR_STATES.CLOSED;

    if (route.doorType === "SECRET") {
      doorType = CONST.WALL_DOOR_TYPES.SECRET;
    } else if (route.doorType === "LOCKED") {
      doorState = CONST.WALL_DOOR_STATES.LOCKED;
    }

    const wallData = {
      c,
      door: doorType,
      ds: doorState,
      sense: CONST.WALL_SENSE_TYPES.NORMAL,
      move: CONST.WALL_MOVEMENT_TYPES.NORMAL
    };

    await canvas.scene.createEmbeddedDocuments("Wall", [wallData]);
  }

  /**
   * Helper to gather connection links across manifest sectors.
   */
  static _extractConnectionsFromSectors(sectors) {
    const connections = [];
    for (const sector of sectors) {
      if (sector.connections && Array.isArray(sector.connections)) {
        for (const conn of sector.connections) {
          connections.push({
            sourceId: sector.sectorId,
            targetId: conn.targetSectorId || conn.targetId,
            doorType: conn.doorType || "STANDARD"
          });
        }
      }
    }
    return connections;
  }
}