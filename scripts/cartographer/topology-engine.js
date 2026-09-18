/**
 * topology-engine.js
 * AI Director Cartographer Alpha 0.1
 *
 * FILE:
 * /modules/ai-director/scripts/cartographer/topology-engine.js
 *
 * Builds corridor topology from routed
 * corridor paths.
 *
 * Detects:
 * - Nodes
 * - Junctions
 * - Corridor Segments
 *
 * Purpose:
 * Convert independent corridor routes
 * into a topology model that can be
 * consumed by renderers.
 */

export class TopologyEngine {

  /**
   * Build topology model.
   *
   * @param {Array} routes
   *
   * @returns {Object}
   */
  static build(
    routes = []
  ) {

    const nodeMap =
      new Map();

    const segments = [];

    for (const route of routes) {

      if (!route.path) {
        continue;
      }

      for (const point of route.path) {

        const key =
          `${point[0]},${point[1]}`;

        nodeMap.set(
          key,
          (nodeMap.get(key) || 0) + 1
        );
      }

      for (
        let i = 0;
        i < route.path.length - 1;
        i++
      ) {

        const start =
          route.path[i];

        const end =
          route.path[i + 1];

        segments.push({

          routeId:
            `${route.sourceId}-${route.targetId}`,

          sourceId:
            route.sourceId,

          targetId:
            route.targetId,

          start: {
            x: start[0],
            y: start[1]
          },

          end: {
            x: end[0],
            y: end[1]
          },

          startIsJunction: false,

          endIsJunction: false

        });
      }
    }

    const nodes = [];

    const junctions = [];

    for (
      const [key, count]
      of nodeMap.entries()
    ) {

      const [x, y] =
        key
          .split(",")
          .map(Number);

      const node = {

        x,

        y,

        count

      };

      nodes.push(node);

      if (count > 1) {

        let type =
          "JUNCTION";

        if (count === 2) {

          type =
            "T_JUNCTION";
        }

        if (count >= 3) {

          type =
            "CROSS_JUNCTION";
        }

        junctions.push({

          x,

          y,

          count,

          type,

          connectedSegments: []

        });
      }
    }

    for (const segment of segments) {

      segment.startIsJunction =
        junctions.some(
          junction =>
            junction.x ===
              segment.start.x &&
            junction.y ===
              segment.start.y
        );

      segment.endIsJunction =
        junctions.some(
          junction =>
            junction.x ===
              segment.end.x &&
            junction.y ===
              segment.end.y
        );
    }

    for (const junction of junctions) {

      junction.connectedSegments =
        segments.filter(

          segment =>

            (
              segment.start.x ===
                junction.x &&
              segment.start.y ===
                junction.y
            ) ||

            (
              segment.end.x ===
                junction.x &&
              segment.end.y ===
                junction.y
            )
        );
    }

    return {

      nodes,

      junctions,

      segments

    };
  }

  /** Build topology from a shared circulation plan. */
  static buildFromCirculation(circulationPlan = {}) {
    return this.build(circulationPlan.routes || []);
  }

  /**
   * Get a junction at a specific location.
   *
   * @param {Object} topology
   * @param {Number} x
   * @param {Number} y
   *
   * @returns {Object|null}
   */
  static getJunctionAt(
    topology,
    x,
    y
  ) {

    return topology.junctions.find(
      junction =>
        junction.x === x &&
        junction.y === y
    );
  }

  /**
   * Get all segments connected to a node.
   *
   * @param {Object} topology
   * @param {Number} x
   * @param {Number} y
   *
   * @returns {Array}
   */
  static getSegmentsConnectedToNode(
    topology,
    x,
    y
  ) {

    return topology.segments.filter(

      segment =>

        (
          segment.start.x === x &&
          segment.start.y === y
        ) ||

        (
          segment.end.x === x &&
          segment.end.y === y
        )
    );
  }
}