/**
 * connection-renderer.js
 * AI Director Cartographer Alpha 0.1
 *
 * FILE:
 * /modules/ai-director/scripts/cartographer/connection-renderer.js
 *
 * Debug visualization of room relationships.
 *
 * Draws connection lines from room edge to room edge.
 *
 * NOT corridors.
 * NOT doors.
 * NOT walls.
 *
 * Purpose:
 * Visualize topology and graph structure.
 */

export class CartographerConnectionRenderer {

  /**
   * Render all room connections.
   *
   * @param {Object} layoutResult
   * @param {Scene} scene
   */
  static async render(
    layoutResult,
    scene = canvas.scene
  ) {

    if (!scene) {

      ui.notifications.error(
        "No active scene available."
      );

      return;
    }

    const drawings = [];

    for (const floor of Object.values(layoutResult.floors ?? {})) {

      const sectorMap = new Map();

      for (const sector of floor.sectors) {

        sectorMap.set(
          sector.sectorId,
          sector
        );
      }

      for (const sector of floor.sectors) {

        if (!Array.isArray(sector.connections)) {
          continue;
        }

        for (const connection of sector.connections) {

          const targetId =
            connection.to ||
            connection.targetSectorId ||
            connection.targetId;

          const target =
            sectorMap.get(targetId);

          if (!target) continue;

          const start =
            this._getRoomEdgePoint(
              sector,
              target
            );

          const end =
            this._getRoomEdgePoint(
              target,
              sector
            );

          drawings.push({

            x: start.x,
            y: start.y,

            shape: {
              type: "p",

              points: [
                0,
                0,

                end.x - start.x,
                end.y - start.y
              ]
            },

            strokeWidth: 4,
            strokeColor: "#FFFFFF",

            fillType: 0

          });
        }
      }
    }

    if (!drawings.length) {

      ui.notifications.warn(
        "No connections found."
      );

      return [];
    }

    const created =
      await scene.createEmbeddedDocuments(
        "Drawing",
        drawings
      );

    console.log(
      "Cartographer Connection Renderer",
      created
    );

    ui.notifications.info(
      `Rendered ${created.length} connections.`
    );

    return created;
  }

  /**
   * Determine the best edge point on the
   * source room facing the target room.
   */
  static _getRoomEdgePoint(
    source,
    target
  ) {

    const s =
      source.bounds ||
      source.pixelBounds;

    const t =
      target.bounds ||
      target.pixelBounds;

    if (!s || !t) {

      return {
        x: 0,
        y: 0
      };
    }

    const sourceCenter = {

      x:
        s.x +
        (s.width / 2),

      y:
        s.y +
        (s.height / 2)

    };

    const targetCenter = {

      x:
        t.x +
        (t.width / 2),

      y:
        t.y +
        (t.height / 2)

    };

    const dx =
      targetCenter.x -
      sourceCenter.x;

    const dy =
      targetCenter.y -
      sourceCenter.y;

    // Horizontal relationship

    if (
      Math.abs(dx) >
      Math.abs(dy)
    ) {

      return {

        x:
          dx > 0
            ? s.x + s.width
            : s.x,

        y:
          sourceCenter.y

      };
    }

    // Vertical relationship

    return {

      x:
        sourceCenter.x,

      y:
        dy > 0
          ? s.y + s.height
          : s.y

    };
  }

  /**
   * Remove all connection drawings.
   *
   * WARNING:
   * This removes ALL drawings currently
   * in the scene.
   */
  static async clear(
    scene = canvas.scene
  ) {

    if (!scene) return;

    const ids =
      scene.drawings.contents.map(
        drawing => drawing.id
      );

    if (!ids.length) return;

    await scene.deleteEmbeddedDocuments(
      "Drawing",
      ids
    );

    ui.notifications.info(
      "Cartographer connections cleared."
    );
  }
}