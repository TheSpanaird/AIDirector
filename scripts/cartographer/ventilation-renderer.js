// ventilation-renderer.js
// Renders the normalized non-overlapping duct union at a Levels elevation band.
export class VentilationRenderer {
  static NAMESPACE = "ai-director";
  static TYPE = "VENTILATION_DUCT";
  static ACCESS_TYPE = "VENTILATION_ACCESS";

  static CONFIG = Object.freeze({
    fillColor: "#56616b",
    fillAlpha: 0.22,
    accessFillColor: "#a9bac8",
    accessFillAlpha: 0.55,
    accessStrokeColor: "#d8e4ec",
    accessStrokeAlpha: 0.9,
    accessStrokeWidth: 2,
    accessScale: 0.75,
    hidden: false,
    elevationBottom: 10,
    elevationTop: 15
  });

  static async render(plan, scene = canvas.scene, customConfig = {}) {
    if (!scene || !plan?.enabled || !Array.isArray(plan.rectangles)) {
      return [];
    }

    const config = {
      ...this.CONFIG,
      ...customConfig,
      elevationBottom: Number(
        plan.elevationBottom ?? customConfig.elevationBottom ?? 10
      ),
      elevationTop: Number(
        plan.elevationTop ?? customConfig.elevationTop ?? 15
      )
    };

    const drawings = [];

    for (const [index, rectangle] of plan.rectangles.entries()) {
      drawings.push(this._drawingData({
        documentType: this.TYPE,
        stableId: `vent-union:${index}`,
        rectangle,
        config,
        fillColor: config.fillColor,
        fillAlpha: config.fillAlpha,
        strokeColor: config.fillColor,
        strokeAlpha: 0,
        strokeWidth: 0,
        properties: {
          hiddenTraversal: true,
          normalizedUnion: true
        }
      }));
    }

    for (const [index, access] of (plan.accessPoints || []).entries()) {
      const size = Math.max(
        1,
        Math.round(100 * Number(config.accessScale || 0.75))
      );
      drawings.push(this._drawingData({
        documentType: this.ACCESS_TYPE,
        stableId: `vent-access:${access.sectorId}:${index}`,
        rectangle: {
          x: access.location.x - size / 2,
          y: access.location.y - size / 2,
          width: size,
          height: size
        },
        config,
        fillColor: config.accessFillColor,
        fillAlpha: config.accessFillAlpha,
        strokeColor: config.accessStrokeColor,
        strokeAlpha: config.accessStrokeAlpha,
        strokeWidth: config.accessStrokeWidth,
        properties: {
          sectorId: access.sectorId,
          accessType: access.accessType || "VENT_GRATE"
        }
      }));
    }

    return drawings.length
      ? scene.createEmbeddedDocuments("Drawing", drawings)
      : [];
  }

  static _drawingData({
    documentType,
    stableId,
    rectangle,
    config,
    fillColor,
    fillAlpha,
    strokeColor,
    strokeAlpha,
    strokeWidth,
    properties
  }) {
    return {
      x: rectangle.x,
      y: rectangle.y,
      hidden: config.hidden === true,
      shape: {
        type: "r",
        width: rectangle.width,
        height: rectangle.height
      },
      fillType: 1,
      fillColor,
      fillAlpha,
      strokeColor,
      strokeAlpha,
      strokeWidth,
      flags: {
        levels: {
          rangeBottom: config.elevationBottom,
          rangeTop: config.elevationTop
        },
        [this.NAMESPACE]: {
          cartographer: {
            documentType,
            stableId,
            properties: {
              networkType: "AIR_DUCT",
              elevationBottom: config.elevationBottom,
              elevationTop: config.elevationTop,
              ...properties
            },
            geometry: {
              rectangle: { ...rectangle }
            }
          }
        }
      }
    };
  }

  static async clear(scene = canvas.scene) {
    if (!scene) return [];
    const types = new Set([this.TYPE, this.ACCESS_TYPE]);
    const ids = scene.drawings.contents
      .filter(drawing =>
        types.has(
          drawing.flags?.[this.NAMESPACE]?.cartographer?.documentType
        )
      )
      .map(drawing => drawing.id);
    return ids.length
      ? scene.deleteEmbeddedDocuments("Drawing", ids)
      : [];
  }
}
