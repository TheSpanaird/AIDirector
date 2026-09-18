// stacked-floor-renderer.js
// Renders a completed STACKED_CANVAS presentation in combined passes.
import { SpaceshipHullRenderer } from "./spaceship-hull-renderer.js";

export class StackedFloorRenderer {
  static async render(presentation, scene, options = {}) {
    if (!scene) throw new Error("StackedFloorRenderer requires a scene.");
    if (!presentation?.floors?.length) {
      throw new Error("StackedFloorRenderer requires planned floors.");
    }

    const gridSize = Math.max(1, Number(options.gridSize) || 100);
    const manifestId = options.manifestId || "multi-level-stacked";
    const generationId = options.generationId || "multi-level-stacked";
    const structureId = options.structureId || manifestId;

    const sectors = presentation.floors.flatMap(floorItem => floorItem.result.sectors);
    const openings = presentation.floors.flatMap(floorItem => floorItem.result.openings || []);
    const rectangles = presentation.floors.flatMap(
      floorItem => floorItem.result.normalizedTopology?.rectangles || []
    );
    const junctions = presentation.floors.flatMap(
      floorItem => floorItem.result.normalizedTopology?.junctions || []
    );
    const floors = Object.fromEntries(
      presentation.floors.map(floorItem => [
        floorItem.floor,
        { floor: floorItem.floor, sectors: floorItem.result.sectors }
      ])
    );
    const layoutResult = { sectors, floors };

    await CartographerRoomRenderer.render(layoutResult, scene, {
      gridSize,
      generationId: `${generationId}-rooms`,
      manifestId
    });
    await RoomLabelRenderer.render(layoutResult, scene, {
      gridSize,
      generationId: `${generationId}-labels`,
      manifestId
    });
    await CartographerWallRenderer.render(
      layoutResult,
      { gridSize, rectangles, junctions },
      { openings },
      options.boundaryFeaturePlan || { features: [] },
      scene,
      {
        generationId: `${generationId}-walls`,
        manifestId,
        replaceExisting: options.replaceExistingWalls !== false
      }
    );

    const hullReports = options.renderHulls === false
      ? []
      : await SpaceshipHullRenderer.renderPresentation(presentation, scene, {
          structureId,
          manifestId,
          generationId: `${generationId}-hulls`,
          fillAlpha: options.hullFillAlpha ?? 0.25,
          strokeAlpha: options.hullStrokeAlpha ?? 0.8,
          sort: options.hullSort ?? -100000
        });

    if (options.renderPresentation !== false) {
      await this._renderPresentation(presentation, scene, { manifestId, generationId });
    }
    if (options.renderIsolationWalls === true) {
      await this._renderIsolationWalls(presentation, scene, { manifestId, generationId });
    }

    return {
      sectors,
      openings,
      floors,
      hullReports,
      roomCount: sectors.length,
      openingCount: openings.length,
      hullCount: hullReports.filter(report => report.rendered).length
    };
  }

  static async _renderPresentation(presentation, scene, metadata) {
    const drawings = [];
    for (const floorItem of presentation.floors) {
      drawings.push({
        x: floorItem.label.x,
        y: floorItem.label.y,
        shape: { type: "r", width: floorItem.label.width, height: floorItem.label.height },
        fillType: 0,
        strokeWidth: 0,
        text: `${floorItem.label.text} | ${floorItem.label.role}`,
        fontSize: 30,
        textColor: "#ffffff",
        flags: {
          "ai-director": {
            cartographer: {
              documentType: "FLOOR_LABEL",
              floor: floorItem.floor,
              ...metadata
            }
          }
        }
      });
      for (const anchor of floorItem.result.verticalAnchors || []) {
        drawings.push({
          x: anchor.location.x - 50,
          y: anchor.location.y - 50,
          shape: { type: "e", width: 100, height: 100 },
          fillType: 1,
          fillColor: "#00b7ff",
          fillAlpha: 0.65,
          strokeColor: "#ffffff",
          strokeAlpha: 1,
          strokeWidth: 4,
          text: `${anchor.connectionType}\n${anchor.anchorId}`,
          fontSize: 16,
          textColor: "#ffffff",
          flags: {
            "ai-director": {
              cartographer: {
                documentType: "VERTICAL_CONNECTOR_MARKER",
                connectionId: anchor.connectionId,
                anchorId: anchor.anchorId,
                floor: anchor.floor,
                ...metadata
              }
            }
          }
        });
      }
    }
    if (drawings.length) await scene.createEmbeddedDocuments("Drawing", drawings);
  }

  static async _renderIsolationWalls(presentation, scene, metadata) {
    const walls = presentation.floors.flatMap(floorItem =>
      floorItem.isolationSegments.map(segment => ({
        c: [segment.x1, segment.y1, segment.x2, segment.y2],
        move: CONST.WALL_SENSE_TYPES.NORMAL,
        sight: CONST.WALL_SENSE_TYPES.NORMAL,
        sound: CONST.WALL_SENSE_TYPES.NORMAL,
        light: CONST.WALL_SENSE_TYPES.NORMAL,
        door: CONST.WALL_DOOR_TYPES.NONE,
        ds: CONST.WALL_DOOR_STATES.CLOSED,
        flags: {
          "ai-director": {
            cartographer: {
              documentType: "FLOOR_ISOLATION_WALL",
              floor: segment.floor,
              ...metadata
            }
          }
        }
      }))
    );
    if (walls.length) await scene.createEmbeddedDocuments("Wall", walls);
  }
}
