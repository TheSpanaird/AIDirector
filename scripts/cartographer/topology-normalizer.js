// topology-normalizer.js
// AI Director Cartographer Alpha 0.1
// FILE: /modules/ai-director/scripts/cartographer/topology-normalizer.js
// Produces grid-aligned, continuous, non-overlapping corridor geometry.
// Room-anchor endpoints are excluded from corner and junction fill squares.

export class TopologyNormalizer {

  static CONFIG = {
    corridorWidth: 200,
    gridSize: 100
  };

  static normalize(topology = {}, customConfig = {}) {
    const config = { ...this.CONFIG, ...customConfig };
    config.gridSize = Math.max(1, Number(config.gridSize) || 100);
    config.corridorWidth = this._normalizeWidth(config.corridorWidth, config.gridSize);

    const sourceSegments = Array.isArray(topology.segments) ? topology.segments : [];
    const roomAnchorKeys = new Set(
      sourceSegments.flatMap(segment => {
        const keys = [];
        if (segment.startIsRoomAnchor) keys.push(`${segment.start.x},${segment.start.y}`);
        if (segment.endIsRoomAnchor) keys.push(`${segment.end.x},${segment.end.y}`);
        return keys;
      })
    );

    const snappedSegments = sourceSegments
      .map(segment => this._snapSourceSegment(segment, config))
      .filter(Boolean);

    const horizontalSegments = [];
    const verticalSegments = [];

    for (const segment of snappedSegments) {
      if (segment.start.y === segment.end.y) {
        horizontalSegments.push({
          axis: segment.start.y,
          start: Math.min(segment.start.x, segment.end.x),
          end: Math.max(segment.start.x, segment.end.x)
        });
      } else if (segment.start.x === segment.end.x) {
        verticalSegments.push({
          axis: segment.start.x,
          start: Math.min(segment.start.y, segment.end.y),
          end: Math.max(segment.start.y, segment.end.y)
        });
      }
    }

    const mergedHorizontal = this._mergeCollinearSegments(horizontalSegments);
    const mergedVertical = this._mergeCollinearSegments(verticalSegments);
    const topologyPoints = this._detectTopologyPoints(
      mergedHorizontal,
      mergedVertical,
      roomAnchorKeys
    );
    const splitHorizontal = this._splitSegments(
      mergedHorizontal,
      topologyPoints,
      "HORIZONTAL"
    );
    const splitVertical = this._splitSegments(
      mergedVertical,
      topologyPoints,
      "VERTICAL"
    );

    const corridorRectangles = [
      ...splitHorizontal.map(segment =>
        this._horizontalToRectangle(segment, config.corridorWidth)
      ),
      ...splitVertical.map(segment =>
        this._verticalToRectangle(segment, config.corridorWidth)
      )
    ];

    const nodeFillRectangles = topologyPoints
      .filter(point => point.degree >= 2 && !point.isRoomAnchor)
      .map(point => this._pointToFillRectangle(point, config.corridorWidth));

    const rawRectangles = [...corridorRectangles, ...nodeFillRectangles];
    const rectangles = this._buildNonOverlappingUnion(rawRectangles);

    return {
      geometryModel: "SHARED_CIRCULATION",
      gridSize: config.gridSize,
      corridorWidth: config.corridorWidth,
      roomAnchorKeys: [...roomAnchorKeys],
      snappedSegments,
      horizontalSegments: mergedHorizontal,
      verticalSegments: mergedVertical,
      splitHorizontalSegments: splitHorizontal,
      splitVerticalSegments: splitVertical,
      topologyPoints,
      junctions: topologyPoints.filter(point =>
        point.type === "T_JUNCTION" || point.type === "CROSS_JUNCTION"
      ),
      corners: topologyPoints.filter(point => point.type === "L_CORNER"),
      deadEnds: topologyPoints.filter(point => point.type === "DEAD_END"),
      corridorRectangles,
      nodeFillRectangles,
      rawRectangles,
      rectangles
    };
  }

  static _normalizeWidth(width, gridSize) {
    const units = Math.max(1, Math.round((Number(width) || gridSize) / gridSize));
    return units * gridSize;
  }

  static _getCenterlineOffset(corridorWidth, gridSize) {
    const units = Math.max(1, Math.round(corridorWidth / gridSize));
    return units % 2 === 0 ? 0 : gridSize / 2;
  }

  static _snapCenterline(value, corridorWidth, gridSize) {
    const offset = this._getCenterlineOffset(corridorWidth, gridSize);
    return Math.round((value - offset) / gridSize) * gridSize + offset;
  }

  static _snapSourceSegment(segment, config) {
    if (!segment?.start || !segment?.end) return null;
    const start = {
      x: this._snapCenterline(segment.start.x, config.corridorWidth, config.gridSize),
      y: this._snapCenterline(segment.start.y, config.corridorWidth, config.gridSize)
    };
    const end = {
      x: this._snapCenterline(segment.end.x, config.corridorWidth, config.gridSize),
      y: this._snapCenterline(segment.end.y, config.corridorWidth, config.gridSize)
    };
    if (start.x === end.x && start.y === end.y) return null;
    if (start.x !== end.x && start.y !== end.y) return null;
    return { ...segment, start, end };
  }

  static _mergeCollinearSegments(segments = []) {
    const grouped = new Map();
    for (const segment of segments) {
      const key = String(segment.axis);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push({ ...segment });
    }

    const merged = [];
    for (const group of grouped.values()) {
      group.sort((a, b) => a.start - b.start);
      let current = null;
      for (const segment of group) {
        if (!current) {
          current = { ...segment };
        } else if (segment.start <= current.end) {
          current.end = Math.max(current.end, segment.end);
        } else {
          merged.push(current);
          current = { ...segment };
        }
      }
      if (current) merged.push(current);
    }
    return merged;
  }

  static _detectTopologyPoints(horizontalSegments, verticalSegments, roomAnchorKeys) {
    const pointMap = new Map();
    const addPoint = (x, y) => {
      const key = `${x},${y}`;
      if (!pointMap.has(key)) pointMap.set(key, { x, y });
    };

    for (const segment of horizontalSegments) {
      addPoint(segment.start, segment.axis);
      addPoint(segment.end, segment.axis);
    }
    for (const segment of verticalSegments) {
      addPoint(segment.axis, segment.start);
      addPoint(segment.axis, segment.end);
    }
    for (const horizontal of horizontalSegments) {
      for (const vertical of verticalSegments) {
        if (
          vertical.axis >= horizontal.start &&
          vertical.axis <= horizontal.end &&
          horizontal.axis >= vertical.start &&
          horizontal.axis <= vertical.end
        ) {
          addPoint(vertical.axis, horizontal.axis);
        }
      }
    }

    return [...pointMap.values()].map(point => {
      const directions = this._getDirectionsAtPoint(
        point,
        horizontalSegments,
        verticalSegments
      );
      return {
        x: point.x,
        y: point.y,
        directions,
        degree: directions.length,
        type: this._classifyDirections(directions),
        isRoomAnchor: roomAnchorKeys.has(`${point.x},${point.y}`)
      };
    });
  }

  static _getDirectionsAtPoint(point, horizontalSegments, verticalSegments) {
    const directions = new Set();
    for (const segment of horizontalSegments) {
      if (point.y !== segment.axis || point.x < segment.start || point.x > segment.end) continue;
      if (point.x > segment.start) directions.add("WEST");
      if (point.x < segment.end) directions.add("EAST");
    }
    for (const segment of verticalSegments) {
      if (point.x !== segment.axis || point.y < segment.start || point.y > segment.end) continue;
      if (point.y > segment.start) directions.add("NORTH");
      if (point.y < segment.end) directions.add("SOUTH");
    }
    return [...directions];
  }

  static _classifyDirections(directions = []) {
    const set = new Set(directions);
    if (set.size >= 4) return "CROSS_JUNCTION";
    if (set.size === 3) return "T_JUNCTION";
    if (set.size === 2) {
      const straight =
        (set.has("WEST") && set.has("EAST")) ||
        (set.has("NORTH") && set.has("SOUTH"));
      return straight ? "STRAIGHT" : "L_CORNER";
    }
    if (set.size === 1) return "DEAD_END";
    return "ISOLATED";
  }

  static _splitSegments(segments, points, orientation) {
    const output = [];
    for (const segment of segments) {
      const values = new Set([segment.start, segment.end]);
      for (const point of points) {
        if (
          orientation === "HORIZONTAL" &&
          point.y === segment.axis &&
          point.x > segment.start &&
          point.x < segment.end
        ) values.add(point.x);
        if (
          orientation === "VERTICAL" &&
          point.x === segment.axis &&
          point.y > segment.start &&
          point.y < segment.end
        ) values.add(point.y);
      }
      const sorted = [...values].sort((a, b) => a - b);
      for (let index = 0; index < sorted.length - 1; index++) {
        if (sorted[index + 1] <= sorted[index]) continue;
        output.push({
          axis: segment.axis,
          start: sorted[index],
          end: sorted[index + 1],
          orientation
        });
      }
    }
    return output;
  }

  static _horizontalToRectangle(segment, width) {
    return {
      type: "CORRIDOR",
      orientation: "HORIZONTAL",
      x: segment.start,
      y: segment.axis - width / 2,
      width: segment.end - segment.start,
      height: width
    };
  }

  static _verticalToRectangle(segment, width) {
    return {
      type: "CORRIDOR",
      orientation: "VERTICAL",
      x: segment.axis - width / 2,
      y: segment.start,
      width,
      height: segment.end - segment.start
    };
  }

  static _pointToFillRectangle(point, width) {
    return {
      type: "NODE_FILL",
      topologyType: point.type,
      x: point.x - width / 2,
      y: point.y - width / 2,
      width,
      height: width
    };
  }

  static _buildNonOverlappingUnion(rectangles = []) {
    const valid = rectangles.filter(rectangle =>
      Number.isFinite(rectangle.x) &&
      Number.isFinite(rectangle.y) &&
      Number.isFinite(rectangle.width) &&
      Number.isFinite(rectangle.height) &&
      rectangle.width > 0 &&
      rectangle.height > 0
    );
    if (!valid.length) return [];

    const xValues = new Set();
    const yValues = new Set();
    for (const rectangle of valid) {
      xValues.add(rectangle.x);
      xValues.add(rectangle.x + rectangle.width);
      yValues.add(rectangle.y);
      yValues.add(rectangle.y + rectangle.height);
    }

    const sortedX = [...xValues].sort((a, b) => a - b);
    const sortedY = [...yValues].sort((a, b) => a - b);
    const cells = [];

    for (let yIndex = 0; yIndex < sortedY.length - 1; yIndex++) {
      const y1 = sortedY[yIndex];
      const y2 = sortedY[yIndex + 1];
      for (let xIndex = 0; xIndex < sortedX.length - 1; xIndex++) {
        const x1 = sortedX[xIndex];
        const x2 = sortedX[xIndex + 1];
        if (x2 <= x1 || y2 <= y1) continue;
        const centerX = (x1 + x2) / 2;
        const centerY = (y1 + y2) / 2;
        const covered = valid.some(rectangle =>
          centerX >= rectangle.x &&
          centerX <= rectangle.x + rectangle.width &&
          centerY >= rectangle.y &&
          centerY <= rectangle.y + rectangle.height
        );
        if (covered) {
          cells.push({ x: x1, y: y1, width: x2 - x1, height: y2 - y1 });
        }
      }
    }

    return this._mergeStripsVertically(
      this._mergeCellsHorizontally(cells)
    ).map(rectangle => ({
      type: "CORRIDOR_UNION",
      orientation: "NORMALIZED",
      ...rectangle
    }));
  }

  static _mergeCellsHorizontally(cells = []) {
    const grouped = new Map();
    for (const cell of cells) {
      const key = `${cell.y},${cell.height}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push({ ...cell });
    }

    const strips = [];
    for (const group of grouped.values()) {
      group.sort((a, b) => a.x - b.x);
      let current = null;
      for (const cell of group) {
        if (!current) current = { ...cell };
        else if (current.x + current.width === cell.x) current.width += cell.width;
        else {
          strips.push(current);
          current = { ...cell };
        }
      }
      if (current) strips.push(current);
    }
    return strips;
  }

  static _mergeStripsVertically(rectangles = []) {
    const grouped = new Map();
    for (const rectangle of rectangles) {
      const key = `${rectangle.x},${rectangle.width}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push({ ...rectangle });
    }

    const merged = [];
    for (const group of grouped.values()) {
      group.sort((a, b) => a.y - b.y);
      let current = null;
      for (const rectangle of group) {
        if (!current) current = { ...rectangle };
        else if (current.y + current.height === rectangle.y) current.height += rectangle.height;
        else {
          merged.push(current);
          current = { ...rectangle };
        }
      }
      if (current) merged.push(current);
    }
    return merged;
  }
}
