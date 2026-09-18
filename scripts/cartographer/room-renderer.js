/**
 * room-renderer.js
 * AI Director Cartographer Alpha 0.1
 *
 * FILE:
 * /modules/ai-director/scripts/cartographer/room-renderer.js
 *
 * Renders room floor polygons with stable Cartographer metadata.
 */

import { ShapePrimitiveGenerator }
  from "/modules/ai-director/scripts/cartographer/shape-primitive-generator.js";

import { CartographerMetadata }
  from "/modules/ai-director/scripts/cartographer/cartographer-metadata.js";

export class CartographerRoomRenderer {

  static CONFIG = {
    gridSize: 100,
    fillAlpha: 0.25,
    strokeWidth: 4,
    connectorOutlineOnly: true,
    connectorStrokeColor: "#00B7FF",
    connectorStrokeWidth: 4,
    generationId: null,
    manifestId: null
  };

  static COLORS = {
    ENTRY: "#00AA00",
    HUB: "#0066FF",
    OBJECTIVE: "#CC3333",
    OPTIONAL: "#E6C200",
    DEAD_END: "#777777",
    SECRET: "#8000FF",
    EXIT: "#00CCCC"
  };

  static getShapeType(sector = {}) {
    if (sector.shapeType) {
      return String(
        sector.shapeType
      ).toUpperCase();
    }

    const purpose = String(
      sector.purpose ||
      sector.sectorPurpose ||
      sector.roomType ||
      ""
    ).toUpperCase();

    const footprint = sector.footprintContract || {};
    const archetype = String(footprint.archetype || "").toUpperCase();
    const architectural = Boolean(archetype) && archetype !== "NATURAL_BRANCHING";

    if (purpose.includes("TOWER")) return "TOWER_SQUARE";
    if (purpose.includes("COURTYARD")) return "RECTANGLE";
    if (purpose.includes("CORRIDOR") || purpose.includes("HALL")) return "RECTANGLE";

    if (architectural && sector.allowComplexShape !== true) {
      return "RECTANGLE";
    }

    switch (
      String(
        sector.graphRole || ""
      ).toUpperCase()
    ) {
      case "OBJECTIVE":
        return "OCTAGON";

      case "HUB":
        return "CROSS";

      case "OPTIONAL":
        return "L_SHAPE";

      case "SECRET":
        return "T_SHAPE";

      case "ENTRY":
      case "EXIT":
      default:
        return "RECTANGLE";
    }
  }

  static async render(
    layoutResult,
    scene = canvas.scene,
    customConfig = {}
  ) {
    if (!scene) {
      ui.notifications.error(
        "No active scene available."
      );
      return [];
    }

    const config = {
      ...this.CONFIG,
      ...customConfig
    };

    config.gridSize = Math.max(
      1,
      Number(config.gridSize) ||
      Number(scene.grid?.size) ||
      100
    );

    const drawings = [];

    for (const [floorKey, floor] of Object.entries(
      layoutResult?.floors || {}
    )) {
      if (!Array.isArray(floor?.sectors)) {
        continue;
      }

      for (const sector of floor.sectors) {
        const bounds =
          sector.bounds ||
          sector.pixelBounds;

        if (!this._isValidBounds(bounds)) {
          continue;
        }

        const graphRole = String(
          sector.graphRole || ""
        ).toUpperCase();

        const color =
          this.COLORS[graphRole] ||
          "#999999";

        const connectorOutlineOnly =
          config.connectorOutlineOnly !== false &&
          graphRole === "CONNECTOR";

        const fillType =
          connectorOutlineOnly ? 0 : 1;

        const fillAlpha =
          connectorOutlineOnly
            ? 0
            : config.fillAlpha;

        const strokeColor =
          connectorOutlineOnly
            ? config.connectorStrokeColor
            : color;

        const strokeWidth =
          connectorOutlineOnly
            ? config.connectorStrokeWidth
            : config.strokeWidth;

        const shapeType =
          this.getShapeType(sector);

        const polygon =
          ShapePrimitiveGenerator.generatePolygon(
            bounds,
            shapeType,
            config.gridSize
          );

        if (
          !Array.isArray(polygon) ||
          polygon.length < 3
        ) {
          continue;
        }

        const closedPolygon = [
          ...polygon,
          polygon[0]
        ];

        const flatPoints =
          closedPolygon.flatMap(point => [
            point[0] - bounds.x,
            point[1] - bounds.y
          ]);

        const floorNumber =
          Number(
            sector.floor ??
            floorKey
          ) || 1;

        drawings.push({
          x: bounds.x,
          y: bounds.y,

          shape: {
            type: "p",
            points: flatPoints
          },

          fillType,
          fillColor: color,
          fillAlpha,
          strokeColor,
          strokeAlpha: 1,
          strokeWidth,

          flags:
            CartographerMetadata
              .createRoomFloorFlags({
                sector,
                floor: floorNumber,
                shapeType,
                bounds,
                polygon,
                generationId:
                  config.generationId,
                manifestId:
                  config.manifestId
              })
        });
      }
    }

    if (!drawings.length) {
      ui.notifications.warn(
        "No rooms generated."
      );
      return [];
    }

    const created =
      await scene.createEmbeddedDocuments(
        "Drawing",
        drawings
      );

    console.log(
      "Cartographer Room Renderer",
      created
    );

    ui.notifications.info(
      `Cartographer rendered ${created.length} rooms.`
    );

    return created;
  }

  static async clear(
    scene = canvas.scene
  ) {
    if (!scene) {
      return;
    }

    const ids =
      scene.drawings.contents
        .filter(drawing =>
          CartographerMetadata
            .isCartographerDocument(
              drawing,
              CartographerMetadata
                .DOCUMENT_TYPES
                .ROOM_FLOOR
            )
        )
        .map(drawing => drawing.id);

    if (!ids.length) {
      return;
    }

    await scene.deleteEmbeddedDocuments(
      "Drawing",
      ids
    );

    ui.notifications.info(
      "Cartographer room floors cleared."
    );
  }

  static _isValidBounds(bounds) {
    return Boolean(
      bounds &&
      Number.isFinite(bounds.x) &&
      Number.isFinite(bounds.y) &&
      Number.isFinite(bounds.width) &&
      Number.isFinite(bounds.height) &&
      bounds.width > 0 &&
      bounds.height > 0
    );
  }
}
