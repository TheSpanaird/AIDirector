/**
 * corridor-wall-renderer.js
 * AI Director Cartographer Alpha 0.1
 *
 * Generates corridor wall segments from
 * CorridorRouterEngine route geometry.
 */

export class CorridorWallRenderer {

  static async render(
    routes = [],
    scene = canvas.scene
  ) {

    if (!scene) {

      ui.notifications.error(
        "No active scene available."
      );

      return [];
    }

    const walls = [];

    for (const route of routes) {

      if (!Array.isArray(route.polygon)) {
        continue;
      }

      for (const segment of route.polygon) {

        const width =
          segment.width || 200;

        const halfWidth =
          width / 2;

        const horizontal =
          segment.y1 === segment.y2;

        if (horizontal) {

          const minX =
            Math.min(
              segment.x1,
              segment.x2
            );

          const maxX =
            Math.max(
              segment.x1,
              segment.x2
            );

          const topY =
            segment.y1 -
            halfWidth;

          const bottomY =
            segment.y1 +
            halfWidth;

          walls.push({

            c: [
              minX,
              topY,
              maxX,
              topY
            ],

            move: 20,
            sight: 20,
            sound: 20,

            door: 0,
            ds: 0

          });

          walls.push({

            c: [
              minX,
              bottomY,
              maxX,
              bottomY
            ],

            move: 20,
            sight: 20,
            sound: 20,

            door: 0,
            ds: 0

          });

        } else {

          const minY =
            Math.min(
              segment.y1,
              segment.y2
            );

          const maxY =
            Math.max(
              segment.y1,
              segment.y2
            );

          const leftX =
            segment.x1 -
            halfWidth;

          const rightX =
            segment.x1 +
            halfWidth;

          walls.push({

            c: [
              leftX,
              minY,
              leftX,
              maxY
            ],

            move: 20,
            sight: 20,
            sound: 20,

            door: 0,
            ds: 0

          });

          walls.push({

            c: [
              rightX,
              minY,
              rightX,
              maxY
            ],

            move: 20,
            sight: 20,
            sound: 20,

            door: 0,
            ds: 0

          });

        }
      }
    }

    if (!walls.length) {

      ui.notifications.warn(
        "No corridor walls generated."
      );

      return [];
    }

    const created =
      await scene.createEmbeddedDocuments(
        "Wall",
        walls
      );

    console.log(
      "Cartographer Corridor Walls",
      created
    );

    ui.notifications.info(
      `Created ${created.length} corridor wall segments.`
    );

    return created;
  }

  static async clear(
    scene = canvas.scene
  ) {

    if (!scene) return;

    const ids =
      scene.walls.contents.map(
        wall => wall.id
      );

    if (!ids.length) return;

    await scene.deleteEmbeddedDocuments(
      "Wall",
      ids
    );

    ui.notifications.info(
      "Cartographer corridor walls cleared."
    );
  }
}