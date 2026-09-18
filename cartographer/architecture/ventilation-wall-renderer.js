// ventilation-wall-renderer.js
// Builds vent-level duct boundary walls and short centered operable vent-grate doors.
export class VentilationWallRenderer {
  static NAMESPACE = "ai-director";
  static WALL_TYPE = "VENTILATION_WALL";
  static GRATE_TYPE = "VENTILATION_GRATE";

  static CONFIG = Object.freeze({
    elevationBottom: 10,
    elevationTop: 15,
    grateWidth: 100,
    lockGrates: false,
    clearExisting: true
  });

  static async render(plan, scene = canvas.scene, options = {}) {
    if (!scene || !plan?.enabled || !Array.isArray(plan.rectangles)) return [];
    const config = { ...this.CONFIG, ...options };
    if (config.clearExisting !== false) await this.clear(scene);

    const bottom = Number(plan.elevationBottom ?? config.elevationBottom ?? 10);
    const top = Number(plan.elevationTop ?? config.elevationTop ?? 15);
    const boundary = this._unionBoundary(plan.rectangles);
    const grates = this._grateSegments(plan.accessPoints || [], boundary, Number(config.grateWidth) || 100);
    const walls = this._subtractGrates(boundary, grates);

    const data = [
      ...walls.map((segment, index) => this._wallData({
        segment,
        stableId: `${this.WALL_TYPE}:${index}`,
        documentType: this.WALL_TYPE,
        bottom,
        top,
        door: false,
        locked: false
      })),
      ...grates.map((item, index) => this._wallData({
        segment: item.segment,
        stableId: `${this.GRATE_TYPE}:${item.access.sectorId}:${index}`,
        documentType: this.GRATE_TYPE,
        bottom,
        top,
        door: true,
        locked: config.lockGrates === true,
        properties: {
          sectorId: item.access.sectorId,
          accessType: item.access.accessType || "VENT_GRATE",
          grateWidth: this._segmentLength(item.segment)
        }
      }))
    ].filter(item => this._segmentLength({ x1: item.c[0], y1: item.c[1], x2: item.c[2], y2: item.c[3] }) > 0.001);

    return data.length ? scene.createEmbeddedDocuments("Wall", data) : [];
  }

  static _unionBoundary(rectangles = []) {
    if (!rectangles.length) return [];
    const xs = [...new Set(rectangles.flatMap(r => [r.x, r.x + r.width]))].sort((a, b) => a - b);
    const ys = [...new Set(rectangles.flatMap(r => [r.y, r.y + r.height]))].sort((a, b) => a - b);
    const occupied = new Set();

    for (let xi = 0; xi < xs.length - 1; xi++) {
      for (let yi = 0; yi < ys.length - 1; yi++) {
        const cx = (xs[xi] + xs[xi + 1]) / 2;
        const cy = (ys[yi] + ys[yi + 1]) / 2;
        if (rectangles.some(r =>
          cx >= r.x - 0.001 && cx <= r.x + r.width + 0.001 &&
          cy >= r.y - 0.001 && cy <= r.y + r.height + 0.001
        )) occupied.add(`${xi}:${yi}`);
      }
    }

    const edges = [];
    for (const key of occupied) {
      const [xi, yi] = key.split(":").map(Number);
      const left = xs[xi];
      const right = xs[xi + 1];
      const top = ys[yi];
      const bottom = ys[yi + 1];
      if (!occupied.has(`${xi}:${yi - 1}`)) edges.push({ x1: left, y1: top, x2: right, y2: top });
      if (!occupied.has(`${xi + 1}:${yi}`)) edges.push({ x1: right, y1: top, x2: right, y2: bottom });
      if (!occupied.has(`${xi}:${yi + 1}`)) edges.push({ x1: right, y1: bottom, x2: left, y2: bottom });
      if (!occupied.has(`${xi - 1}:${yi}`)) edges.push({ x1: left, y1: bottom, x2: left, y2: top });
    }
    return this._mergeBoundary(edges);
  }

  static _mergeBoundary(edges = []) {
    const groups = new Map();
    for (const edge of edges) {
      const horizontal = Math.abs(edge.y1 - edge.y2) <= 0.001;
      const key = horizontal ? `H:${edge.y1}` : `V:${edge.x1}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(horizontal
        ? { start: Math.min(edge.x1, edge.x2), end: Math.max(edge.x1, edge.x2), axis: edge.y1, horizontal }
        : { start: Math.min(edge.y1, edge.y2), end: Math.max(edge.y1, edge.y2), axis: edge.x1, horizontal });
    }

    const merged = [];
    for (const ranges of groups.values()) {
      ranges.sort((a, b) => a.start - b.start);
      let current = null;
      for (const range of ranges) {
        if (!current) current = { ...range };
        else if (range.start <= current.end + 0.001) current.end = Math.max(current.end, range.end);
        else {
          merged.push(current);
          current = { ...range };
        }
      }
      if (current) merged.push(current);
    }

    return merged.map(range => range.horizontal
      ? { x1: range.start, y1: range.axis, x2: range.end, y2: range.axis }
      : { x1: range.axis, y1: range.start, x2: range.axis, y2: range.end });
  }

  static _grateSegments(accessPoints = [], boundary = [], grateWidth = 100) {
    const output = [];
    for (const access of accessPoints) {
      const candidate = boundary
        .map(segment => ({
          segment,
          projection: this._projectPointToSegment(access.location, segment)
        }))
        .map(item => ({ ...item, distance: Math.hypot(access.location.x - item.projection.x, access.location.y - item.projection.y) }))
        .sort((a, b) => a.distance - b.distance)[0];
      if (!candidate) continue;

      const segment = candidate.segment;
      const length = this._segmentLength(segment);
      if (length <= 0.001) continue;
      const doorLength = Math.min(Math.max(1, grateWidth), length);
      const half = doorLength / 2;
      const horizontal = Math.abs(segment.y1 - segment.y2) <= 0.001;

      let grate;
      if (horizontal) {
        const min = Math.min(segment.x1, segment.x2);
        const max = Math.max(segment.x1, segment.x2);
        const center = Math.max(min + half, Math.min(max - half, candidate.projection.x));
        grate = { x1: center - half, y1: segment.y1, x2: center + half, y2: segment.y1 };
      } else {
        const min = Math.min(segment.y1, segment.y2);
        const max = Math.max(segment.y1, segment.y2);
        const center = Math.max(min + half, Math.min(max - half, candidate.projection.y));
        grate = { x1: segment.x1, y1: center - half, x2: segment.x1, y2: center + half };
      }
      output.push({ access, segment: grate });
    }

    const unique = new Map();
    for (const item of output) {
      const key = this._segmentKey(item.segment);
      if (!unique.has(key)) unique.set(key, item);
    }
    return [...unique.values()];
  }

  static _subtractGrates(boundary = [], grates = []) {
    let walls = boundary.map(segment => ({ ...segment }));
    for (const grate of grates) {
      const next = [];
      for (const wall of walls) {
        if (!this._collinear(wall, grate.segment)) {
          next.push(wall);
          continue;
        }
        const pieces = this._subtractSegment(wall, grate.segment);
        next.push(...pieces);
      }
      walls = next;
    }
    return walls.filter(segment => this._segmentLength(segment) > 0.001);
  }

  static _subtractSegment(wall, cut) {
    const horizontal = Math.abs(wall.y1 - wall.y2) <= 0.001;
    const wallStart = horizontal ? Math.min(wall.x1, wall.x2) : Math.min(wall.y1, wall.y2);
    const wallEnd = horizontal ? Math.max(wall.x1, wall.x2) : Math.max(wall.y1, wall.y2);
    const cutStart = horizontal ? Math.min(cut.x1, cut.x2) : Math.min(cut.y1, cut.y2);
    const cutEnd = horizontal ? Math.max(cut.x1, cut.x2) : Math.max(cut.y1, cut.y2);
    const overlapStart = Math.max(wallStart, cutStart);
    const overlapEnd = Math.min(wallEnd, cutEnd);
    if (overlapEnd <= overlapStart + 0.001) return [wall];

    const pieces = [];
    if (wallStart < overlapStart - 0.001) {
      pieces.push(horizontal
        ? { x1: wallStart, y1: wall.y1, x2: overlapStart, y2: wall.y1 }
        : { x1: wall.x1, y1: wallStart, x2: wall.x1, y2: overlapStart });
    }
    if (overlapEnd < wallEnd - 0.001) {
      pieces.push(horizontal
        ? { x1: overlapEnd, y1: wall.y1, x2: wallEnd, y2: wall.y1 }
        : { x1: wall.x1, y1: overlapEnd, x2: wall.x1, y2: wallEnd });
    }
    return pieces;
  }

  static _wallData({ segment, stableId, documentType, bottom, top, door, locked, properties = {} }) {
    return {
      c: [segment.x1, segment.y1, segment.x2, segment.y2],
      move: CONST.WALL_SENSE_TYPES.NORMAL,
      sight: CONST.WALL_SENSE_TYPES.NORMAL,
      sound: CONST.WALL_SENSE_TYPES.NORMAL,
      light: CONST.WALL_SENSE_TYPES.NORMAL,
      door: door ? CONST.WALL_DOOR_TYPES.DOOR : CONST.WALL_DOOR_TYPES.NONE,
      ds: locked ? CONST.WALL_DOOR_STATES.LOCKED : CONST.WALL_DOOR_STATES.CLOSED,
      flags: {
        "wall-height": { bottom, top },
        [this.NAMESPACE]: {
          cartographer: {
            documentType,
            stableId,
            properties: { elevationBottom: bottom, elevationTop: top, ...properties },
            geometry: { segment: { ...segment } }
          }
        }
      }
    };
  }

  static _projectPointToSegment(point, segment) {
    const dx = segment.x2 - segment.x1;
    const dy = segment.y2 - segment.y1;
    const lengthSquared = dx * dx + dy * dy;
    if (!lengthSquared) return { x: segment.x1, y: segment.y1 };
    const t = Math.max(0, Math.min(1, ((point.x - segment.x1) * dx + (point.y - segment.y1) * dy) / lengthSquared));
    return { x: segment.x1 + t * dx, y: segment.y1 + t * dy };
  }

  static _collinear(a, b) {
    const horizontalA = Math.abs(a.y1 - a.y2) <= 0.001;
    const horizontalB = Math.abs(b.y1 - b.y2) <= 0.001;
    if (horizontalA !== horizontalB) return false;
    return horizontalA ? Math.abs(a.y1 - b.y1) <= 0.001 : Math.abs(a.x1 - b.x1) <= 0.001;
  }

  static _segmentLength(segment) {
    return Math.hypot(segment.x2 - segment.x1, segment.y2 - segment.y1);
  }

  static _segmentKey(segment) {
    const first = { x: segment.x1, y: segment.y1 };
    const second = { x: segment.x2, y: segment.y2 };
    const ordered = first.x < second.x || (first.x === second.x && first.y <= second.y)
      ? [first, second]
      : [second, first];
    return `${ordered[0].x}:${ordered[0].y}:${ordered[1].x}:${ordered[1].y}`;
  }

  static async clear(scene = canvas.scene) {
    if (!scene) return [];
    const types = new Set([this.WALL_TYPE, this.GRATE_TYPE]);
    const ids = scene.walls.contents
      .filter(wall => types.has(wall.flags?.[this.NAMESPACE]?.cartographer?.documentType))
      .map(wall => wall.id);
    return ids.length ? scene.deleteEmbeddedDocuments("Wall", ids) : [];
  }
}
