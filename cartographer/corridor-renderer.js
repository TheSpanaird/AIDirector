// corridor-renderer.js
// AI Director Cartographer Alpha 0.1
// FILE: /modules/ai-director/scripts/cartographer/corridor-renderer.js
// Renders normalized corridor and junction geometry with stable metadata.

import { CartographerMetadata }
  from "/modules/ai-director/scripts/cartographer/cartographer-metadata.js";

export class CorridorRenderer {

  static CONFIG = {
    corridorColor: "#444444",
    junctionColor: "#444444",
    fillAlpha: 0.60,
    strokeColor: "#444444",
    strokeWidth: 0,
    generationId: null,
    manifestId: null
  };

  static async render(
    normalizedTopology = {},
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

    const rectangles =
      Array.isArray(normalizedTopology.rectangles)
        ? normalizedTopology.rectangles
        : [];

    const drawings = [];

    for (
      let index = 0;
      index < rectangles.length;
      index++
    ) {
      const rectangle = rectangles[index];

      if (!this._isValidRectangle(rectangle)) {
        continue;
      }

      const isJunction =
        rectangle.type === "JUNCTION" ||
        rectangle.type === "NODE_FILL";

      const metadataRectangle = {
        ...rectangle,
        type: isJunction
          ? "JUNCTION"
          : rectangle.type
      };

      const color = isJunction
        ? config.junctionColor
        : config.corridorColor;

      drawings.push({
        x: rectangle.x,
        y: rectangle.y,

        shape: {
          type: "r",
          width: rectangle.width,
          height: rectangle.height
        },

        fillType: 1,
        fillColor: color,
        fillAlpha: config.fillAlpha,
        strokeColor: config.strokeColor,
        strokeAlpha: 0,
        strokeWidth: config.strokeWidth,

        flags:
          CartographerMetadata
            .createCorridorFloorFlags({
              rectangle: metadataRectangle,
              index,
              generationId:
                config.generationId,
              manifestId:
                config.manifestId
            })
      });
    }

    if (!drawings.length) {
      ui.notifications.warn(
        "No normalized corridor geometry found."
      );
      return [];
    }

    const created =
      await scene.createEmbeddedDocuments(
        "Drawing",
        drawings
      );

    console.log(
      "Cartographer Normalized Corridor Renderer",
      created
    );

    ui.notifications.info(
      `Rendered ${created.length} normalized corridor shapes.`
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
                .CORRIDOR_FLOOR
            ) ||
          CartographerMetadata
            .isCartographerDocument(
              drawing,
              CartographerMetadata
                .DOCUMENT_TYPES
                .JUNCTION_FLOOR
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
      "Cartographer corridor geometry cleared."
    );
  }

  static _isValidRectangle(rectangle) {
    return Boolean(
      rectangle &&
      Number.isFinite(rectangle.x) &&
      Number.isFinite(rectangle.y) &&
      Number.isFinite(rectangle.width) &&
      Number.isFinite(rectangle.height) &&
      rectangle.width > 0 &&
      rectangle.height > 0
    );
  }
}
