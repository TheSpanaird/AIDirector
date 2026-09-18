/**
 * room-label-renderer.js
 * AI Director Cartographer Alpha 0.1
 * FILE: /modules/ai-director/scripts/cartographer/room-label-renderer.js
 * Renders centered room labels with stable Cartographer metadata.
 */

import { CartographerMetadata }
  from "/modules/ai-director/scripts/cartographer/cartographer-metadata.js";

export class RoomLabelRenderer {

  static CONFIG = {
    fontFamily: "Signika",
    fontSize: 32,
    textColor: "#FFFFFF",
    strokeColor: "#000000",
    strokeWidth: 4,
    textAlpha: 1,
    generationId: null,
    manifestId: null
  };

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

        if (!bounds) {
          continue;
        }

        const text = String(
          sector.name ||
          sector.sectorId ||
          "Room"
        );

        const width = Math.max(
          200,
          Number(bounds.width) || 200
        );

        const height = Math.max(
          50,
          Number(config.fontSize) * 2
        );

        const center =
          sector.center || {
            x:
              bounds.x +
              bounds.width / 2,
            y:
              bounds.y +
              bounds.height / 2
          };

        const floorNumber =
          Number(sector.floor ?? floorKey) || 1;

        drawings.push({
          x:
            center.x -
            width / 2,
          y:
            center.y -
            height / 2,

          shape: {
            type: "r",
            width,
            height
          },

          fillType: 0,
          fillAlpha: 0,
          strokeAlpha: 0,
          strokeWidth: 0,
          hidden: false,
          locked: true,
          sort: 100000,

          text,
          fontFamily:
            config.fontFamily,
          fontSize:
            config.fontSize,
          textColor:
            config.textColor,
          textAlpha:
            config.textAlpha,
          textStroke:
            config.strokeColor,
          textStrokeThickness:
            config.strokeWidth,

          flags:
            CartographerMetadata
              .createRoomLabelFlags({
                sector,
                floor: floorNumber,
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
        "No room labels generated."
      );
      return [];
    }

    const created =
      await scene.createEmbeddedDocuments(
        "Drawing",
        drawings
      );

    console.log(
      "Cartographer Room Labels",
      created
    );

    ui.notifications.info(
      `Cartographer rendered ${created.length} room labels.`
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
                .ROOM_LABEL
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
      "Cartographer room labels cleared."
    );
  }
}
