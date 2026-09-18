/**
 * debug-renderer.js
 * AI Director Cartographer Alpha 0.1
 *
 * Minimal debug renderer.
 * Draws simple rectangles from SpatialLayoutEngine output.
 *
 * FILE:
 * /modules/ai-director/scripts/cartographer/debug-renderer.js
 */

export class CartographerDebugRenderer {

  /**
   * Render simple room rectangles.
   *
   * @param {Object} layoutResult
   * @param {Scene} scene
   */
  static async render(layoutResult, scene = canvas.scene) {

    if (!scene) {
      ui.notifications.error(
        "No active scene available."
      );
      return;
    }

    const drawings = [];

    for (const floor of Object.values(layoutResult.floors ?? {})) {

      for (const sector of floor.sectors) {

        const bounds =
          sector.bounds ||
          sector.pixelBounds;

        drawings.push({
          x: bounds.x,
          y: bounds.y,

          shape: {
            type: "r",
            width: bounds.width,
            height: bounds.height
          }
        });
      }
    }

    if (!drawings.length) {
      ui.notifications.warn(
        "No sectors found to render."
      );
      return;
    }

    const created =
      await scene.createEmbeddedDocuments(
        "Drawing",
        drawings
      );

    console.log(
      "Cartographer Debug Drawings:",
      created
    );

    ui.notifications.info(
      `Cartographer rendered ${created.length} rooms.`
    );
  }

  /**
   * Remove all drawings from current scene.
   */
  static async clear(scene = canvas.scene) {

    if (!scene) return;

    const ids =
      scene.drawings.contents.map(
        d => d.id
      );

    if (!ids.length) return;

    await scene.deleteEmbeddedDocuments(
      "Drawing",
      ids
    );
  }
}