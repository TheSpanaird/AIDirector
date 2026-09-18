/**
 * shape-primitive-generator.js
 *
 * Generates 2D closed polygon vertices from
 * sector bounding boxes and room shape types.
 *
 * FILE:
 * /modules/ai-director/scripts/cartographer/shape-primitive-generator.js
 */

export class ShapePrimitiveGenerator {

  /**
   * Main entry point.
   */
  static generatePolygon(
    pixelBounds,
    shapeType = "RECTANGLE",
    gridSize = 100
  ) {

    const {
      x,
      y,
      width,
      height
    } = pixelBounds;

    const shape = this.normalizeShapeType(shapeType);

    switch (shape) {

      case "L_SHAPE":
        return this._buildLShape(
          x,
          y,
          width,
          height,
          gridSize
        );

      case "OCTAGON":
        return this._buildOctagon(
          x,
          y,
          width,
          height,
          gridSize
        );

      case "CROSS":
        return this._buildCross(
          x,
          y,
          width,
          height,
          gridSize
        );

      case "TOWER":
      case "TOWER_SQUARE":
        return this._buildRectangle(x, y, width, height);

      case "TOWER_ROUND":
      case "CIRCLE":
        return this._buildRoundTower(x, y, width, height);

      case "T_SHAPE":
        return this._buildTShape(
          x,
          y,
          width,
          height,
          gridSize
        );

      case "RECTANGLE":
      default:
        return this._buildRectangle(
          x,
          y,
          width,
          height
        );
    }
  }

  static normalizeShapeType(shapeType = "RECTANGLE") {
    const normalized = String(shapeType || "RECTANGLE")
      .trim()
      .toUpperCase()
      .replace(/[\s-]+/g, "_");
    const aliases = {
      L: "L_SHAPE",
      T: "T_SHAPE",
      SQUARE: "RECTANGLE",
      ROOM: "RECTANGLE",
      TOWER: "TOWER_SQUARE",
      ROUND_TOWER: "TOWER_ROUND"
    };
    return aliases[normalized] || normalized;
  }

  static isComplexShape(shapeType = "RECTANGLE") {
    return ["L_SHAPE", "T_SHAPE", "CROSS", "OCTAGON", "TOWER_ROUND", "CIRCLE"]
      .includes(this.normalizeShapeType(shapeType));
  }

  /**
   * Rectangle.
   */
  static _buildRectangle(
    x,
    y,
    w,
    h
  ) {

    return [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h]
    ];
  }

  /**
   * L Shape.
   */
  static _buildLShape(
    x,
    y,
    w,
    h,
    gridSize
  ) {

    const cutW =
      Math.max(
        gridSize,
        Math.floor(w / 2)
      );

    const cutH =
      Math.max(
        gridSize,
        Math.floor(h / 2)
      );

    return [

      [x, y],

      [x + w, y],

      [x + w, y + cutH],

      [x + cutW, y + cutH],

      [x + cutW, y + h],

      [x, y + h]

    ];
  }

  /**
   * Octagon.
   */
  static _buildOctagon(
    x,
    y,
    w,
    h,
    gridSize
  ) {

    const insetX =
      Math.min(
        gridSize,
        Math.floor(w / 0.50)
      );

    const insetY =
      Math.min(
        gridSize,
        Math.floor(h / 0.50)
      );

    return [

      [x + insetX, y],

      [x + w - insetX, y],

      [x + w, y + insetY],

      [x + w, y + h - insetY],

      [x + w - insetX, y + h],

      [x + insetX, y + h],

      [x, y + h - insetY],

      [x, y + insetY]

    ];
  }

  /**
   * Cross Shape.
   */
  static _buildCross(
    x,
    y,
    w,
    h,
    gridSize
  ) {

    const thirdW =
      Math.max(
        gridSize,
        Math.floor(w / 3)
      );

    const thirdH =
      Math.max(
        gridSize,
        Math.floor(h / 3)
      );

    return [

      [x + thirdW, y],

      [x + thirdW * 2, y],

      [x + thirdW * 2, y + thirdH],

      [x + w, y + thirdH],

      [x + w, y + thirdH * 2],

      [x + thirdW * 2, y + thirdH * 2],

      [x + thirdW * 2, y + h],

      [x + thirdW, y + h],

      [x + thirdW, y + thirdH * 2],

      [x, y + thirdH * 2],

      [x, y + thirdH],

      [x + thirdW, y + thirdH]

    ];
  }

  /**
   * T Shape.
   */
  static _buildTShape(
    x,
    y,
    w,
    h,
    gridSize
  ) {

    const armW =
      Math.max(
        gridSize,
        Math.floor(w / 3)
      );

    const topH =
      Math.max(
        gridSize,
        Math.floor(h / 2)
      );

    const centerX =
      x + Math.floor(w / 2);

    return [

      [x, y],

      [x + w, y],

      [x + w, y + topH],

      [centerX + armW, y + topH],

      [centerX + armW, y + h],

      [centerX - armW, y + h],

      [centerX - armW, y + topH],

      [x, y + topH]

    ];
  }
  static _buildRoundTower(x, y, w, h) {
    const cx = x + w / 2;
    const cy = y + h / 2;
    const rx = w / 2;
    const ry = h / 2;
    const points = [];
    const sides = 16;
    for (let index = 0; index < sides; index++) {
      const angle = (Math.PI * 2 * index) / sides;
      points.push([
        Math.round(cx + Math.cos(angle) * rx),
        Math.round(cy + Math.sin(angle) * ry)
      ]);
    }
    return points;
  }

}