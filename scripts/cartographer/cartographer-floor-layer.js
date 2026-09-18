// modules/ai-director/scripts/cartographer/cartographer-floor-layer.js
// AI Director Cartographer Phase 5
// Transient Pixi floor presentation rebuilt from persistent Cartographer Drawings.

import { CartographerMetadata } from "/modules/ai-director/scripts/cartographer/cartographer-metadata.js";
import { FloorStyleResolver } from "/modules/ai-director/scripts/cartographer/floor-style-resolver.js";

export class CartographerFloorLayer {
  static NAME = "ai-director-cartographer-floor-layer";

  static CONFIG = Object.freeze({
    zIndex: -20,
    roomAlpha: 1,
    corridorAlpha: 1,
    outlineAlpha: 1,
    includeRooms: true,
    includeCorridors: true,
    includeJunctions: true
  });

  static #container = null;
  static #sceneId = null;
  static #renderToken = 0;

  static async render(scene = globalThis.canvas?.scene, customOptions = {}) {
    this._assertCanvas(scene);

    await this.clear();
    const renderToken = ++this.#renderToken;
    const options = { ...this.CONFIG, ...customOptions };

    const sceneMetadata =
      CartographerMetadata.getSceneMetadata?.(scene) ||
      scene.flags?.["ai-director"]?.cartographer ||
      {};

    const metadataStyle = sceneMetadata.floorStyle || {};

    const resolvedMapStyle = this._normalizeMapStyle(
      options.floorStyle || metadataStyle,
      scene,
      options
    );

    const assignmentMode = String(
      options.assignmentMode ||
      resolvedMapStyle.assignmentMode ||
      metadataStyle.assignmentMode ||
      "AUTOMATIC"
    ).toUpperCase();

    // FloorStyleResolver may return a frozen object. Never mutate it.
    const mapStyle = {
      ...resolvedMapStyle,
      assignmentMode
    };

    const geometries = this.collectSceneGeometry(scene, options);
    if (!geometries.length) return this._result(scene, mapStyle, geometries, null);

    const sectorMap = this._buildSectorMap(options.sectors || []);
    const parent = this._resolveParent();
    const container = new PIXI.Container();
    container.name = this.NAME;
    container.eventMode = "none";
    container.sortableChildren = true;
    container.zIndex = Number(options.zIndex ?? this.CONFIG.zIndex);

    const textureCache = new Map();
    const roomOutlines = [];
    const corridorGeometries = [];

    for (const geometry of geometries) {
      if (renderToken !== this.#renderToken) {
        container.destroy({ children: true });
        return null;
      }

      if (geometry.kind === "ROOM" && !options.includeRooms) continue;
      if (geometry.kind === "CORRIDOR" && !options.includeCorridors) continue;
      if (geometry.kind === "JUNCTION" && !options.includeJunctions) continue;

      const style = geometry.kind === "ROOM"
        ? this._resolveRoomStyle(
            geometry,
            sectorMap.get(geometry.sectorId),
            mapStyle,
            scene,
            options,
            assignmentMode
          )
        : {
            ...mapStyle,
            roomTexture: null,
            texturePath: mapStyle.corridorTexture || mapStyle.texturePath || null
          };

      geometry.floorStyle = style;

      const texturePath = geometry.kind === "ROOM"
        ? style.roomTexture || style.texturePath || null
        : style.corridorTexture || style.texturePath || null;

      let texture = null;
      if (String(style.mode || "TEXTURE").toUpperCase() === "TEXTURE" && texturePath) {
        if (!textureCache.has(texturePath)) {
          textureCache.set(texturePath, await this._loadTexture(texturePath));
        }
        texture = textureCache.get(texturePath);
      }

      if (renderToken !== this.#renderToken) {
        container.destroy({ children: true });
        return null;
      }

      const visual = this._createFloorVisual(geometry, style, texture, options);
      if (visual) container.addChild(visual);

      if (geometry.kind === "ROOM") {
        const outline = this._createPolygonOutline(geometry, style, options);
        if (outline) roomOutlines.push(outline);
      } else {
        corridorGeometries.push(geometry);
      }
    }

    const corridorOutline = this._createUnifiedOutline(
      corridorGeometries,
      mapStyle,
      options
    );

    if (corridorOutline) {
      corridorOutline.zIndex = 1000;
      container.addChild(corridorOutline);
    }

    for (const outline of roomOutlines) {
      outline.zIndex = 1100;
      container.addChild(outline);
    }

    parent.addChild(container);
    parent.sortChildren?.();

    this.#container = container;
    this.#sceneId = scene.id;

    const result = this._result(scene, mapStyle, geometries, container);
    console.log("ai-director | Cartographer Floor Layer", result);
    return result;
  }

  static async refresh(customOptions = {}) {
    return this.render(globalThis.canvas?.scene, customOptions);
  }

  static async clear() {
    ++this.#renderToken;
    const existing = this.#container || this._findExistingContainer();

    if (existing) {
      existing.parent?.removeChild(existing);
      if (!existing.destroyed) existing.destroy({ children: true });
    }

    this.#container = null;
    this.#sceneId = null;
  }

  static isRendered(scene = globalThis.canvas?.scene) {
    return Boolean(
      scene &&
      this.#sceneId === scene.id &&
      this.#container &&
      !this.#container.destroyed
    );
  }

  static collectSceneGeometry(scene = globalThis.canvas?.scene) {
    if (!scene) return [];
    const results = [];

    for (const drawing of scene.drawings?.contents || []) {
      const flags = drawing.flags?.["ai-director"] || {};
      const metadata = flags.cartographer || null;
      const type = metadata?.documentType || flags.cartographerType || null;

      let kind = null;
      if (type === "room-floor") kind = "ROOM";
      if (type === "corridor-floor") kind = "CORRIDOR";
      if (type === "junction-floor") kind = "JUNCTION";
      if (!kind) continue;

      const geometry = this._drawingToGeometry(drawing, kind, metadata);
      if (geometry) results.push(geometry);
    }

    return results;
  }

  static registerHooks() {
    Hooks.on("canvasTearDown", () => this.clear());
    Hooks.on("canvasReady", async canvas => {
      const scene = canvas?.scene || globalThis.canvas?.scene;
      if (!scene) return;
      const metadata = CartographerMetadata.getSceneMetadata?.(scene) ||
        scene.flags?.["ai-director"]?.cartographer ||
        null;
      const hasGeometry = this.collectSceneGeometry(scene).length > 0;
      if (!hasGeometry || !metadata?.floorStyle) return;
      try {
        await this.render(scene, {
          gridSize: Number(scene.grid?.size) || 100,
          floorStyle: metadata.floorStyle,
          assignmentMode: metadata.floorStyle.assignmentMode || "AUTOMATIC",
          layoutProfile: metadata.summary?.layoutProfile || null
        });
      } catch (error) {
        console.warn("ai-director | Could not restore Cartographer floor layer.", error);
      }
    });
  }

  static _normalizeMapStyle(style, scene, options) {
    const gridSize = Number(options.gridSize) || Number(scene?.grid?.size) || 100;
    const preset = style?.preset || "auto";
    const mode = String(
      style?.mode || (preset === "plain" ? "PLAIN" : "TEXTURE")
    ).toUpperCase();

    return FloorStyleResolver.resolve({
      scene,
      gridSize,
      ...style,
      ...options.floorStyle,
      preset,
      mode,
      layoutProfile:
        options.layoutProfile ||
        style?.layoutProfile ||
        scene?.flags?.["ai-director"]?.cartographer?.summary?.layoutProfile ||
        null
    });
  }

  // In Automatic mode, unlocked stored room styles are ignored and rebuilt
  // from the active layout profile. Locked room overrides remain authoritative.
  static _resolveRoomStyle(
    geometry,
    sector,
    mapStyle,
    scene,
    options,
    assignmentMode
  ) {
    const stored = sector?.floorStyle || geometry.floorStyle || {};
    const locked = stored.locked === true;
    const layoutProfile =
      options.layoutProfile || mapStyle.layoutProfile || null;
    const gridSize = options.gridSize || scene.grid?.size || 100;

    if (locked) {
      return FloorStyleResolver.resolveRoomStyle(
        {
          ...(sector || {}),
          sectorId: geometry.sectorId,
          graphRole: sector?.graphRole || geometry.graphRole,
          floorStyle: stored
        },
        mapStyle,
        {
          scene,
          gridSize,
          assignmentMode: "MANUAL",
          layoutProfile
        }
      );
    }

    if (assignmentMode === "UNIFORM") {
      return {
        ...mapStyle,
        locked: false,
        source: "UNIFORM",
        roomTexture: mapStyle.texturePath || null
      };
    }

    return FloorStyleResolver.resolveRoomStyle(
      {
        ...(sector || {}),
        sectorId: geometry.sectorId,
        graphRole: sector?.graphRole || geometry.graphRole,
        floorStyle: {
          locked: false,
          mode: "TEXTURE",
          preset: "auto",
          texturePath: null,
          roomTexture: null,
          corridorTexture: null
        }
      },
      {
        ...mapStyle,
        mode: "TEXTURE",
        roomTexture: null
      },
      {
        scene,
        gridSize,
        assignmentMode: "AUTOMATIC",
        layoutProfile
      }
    );
  }

  static _buildSectorMap(sectors = []) {
    return new Map(
      (Array.isArray(sectors) ? sectors : [])
        .filter(sector => sector?.sectorId)
        .map(sector => [sector.sectorId, sector])
    );
  }

  static _drawingToGeometry(drawing, kind, metadata = null) {
    const shape = drawing.shape || drawing._source?.shape;
    if (!shape) return null;

    const x = Number(drawing.x ?? drawing._source?.x ?? 0);
    const y = Number(drawing.y ?? drawing._source?.y ?? 0);
    const width = Number(shape.width || 0);
    const height = Number(shape.height || 0);
    let points = [];

    if (shape.type === "p" && Array.isArray(shape.points)) {
      for (let i = 0; i < shape.points.length; i += 2) {
        points.push(x + Number(shape.points[i]), y + Number(shape.points[i + 1]));
      }
    } else {
      points = [x, y, x + width, y, x + width, y + height, x, y + height];
    }

    return {
      id: drawing.id,
      kind,
      sectorId: metadata?.sectorId || null,
      graphRole: metadata?.graphRole || metadata?.properties?.graphRole || null,
      floorStyle: metadata?.floorStyle || metadata?.properties?.floorStyle || null,
      points,
      bounds: this._boundsForPoints(points),
      drawing
    };
  }

  static _createFloorVisual(geometry, style, texture, options) {
    const group = new PIXI.Container();
    group.name = `${this.NAME}:${geometry.kind}:${geometry.id}`;
    group.eventMode = "none";

    const alpha = geometry.kind === "ROOM"
      ? Number(options.roomAlpha ?? 1)
      : Number(options.corridorAlpha ?? 1);

    let visual;
    if (texture) {
      visual = this._createTextureFill(geometry, texture, style, alpha);
    } else {
      visual = new PIXI.Graphics();
      visual.beginFill(this._hex(style.fillColor || "#777777"), alpha);
      visual.drawPolygon(geometry.points);
      visual.endFill();
    }

    group.addChild(visual);
    return group;
  }

  static _createTextureFill(geometry, texture, style, alpha) {
    const { x, y, width, height } = geometry.bounds;
    const sprite = new PIXI.TilingSprite(texture, Math.max(1, width), Math.max(1, height));
    sprite.position.set(x, y);
    sprite.alpha = alpha;
    sprite.eventMode = "none";

    const sourceWidth = texture.width || texture.baseTexture?.width || 1;
    const sourceHeight = texture.height || texture.baseTexture?.height || 1;
    const targetSize = Number(style.texturePixelSize) || Number(style.gridSize) || 100;
    const textureScale = Number(style.textureScale) || 1;

    sprite.tileScale.set(
      (targetSize / sourceWidth) * textureScale,
      (targetSize / sourceHeight) * textureScale
    );
    sprite.tilePosition.set(-x, -y);

    const localPoints = geometry.points.map((value, index) =>
      index % 2 === 0 ? value - x : value - y
    );

    const mask = new PIXI.Graphics();
    mask.beginFill(0xffffff, 1);
    mask.drawPolygon(localPoints);
    mask.endFill();
    mask.position.set(x, y);
    mask.eventMode = "none";

    const group = new PIXI.Container();
    group.addChild(sprite);
    group.addChild(mask);
    sprite.mask = mask;
    return group;
  }

  static _createPolygonOutline(geometry, style, options) {
    if (style.outlineEnabled === false) return null;
    const width = Number(style.outlineWidth ?? 3);
    if (width <= 0 || geometry.points.length < 6) return null;

    const graphics = new PIXI.Graphics();
    graphics.lineStyle(
      width,
      this._hex(style.outlineColor || "#1f1f1f"),
      Number(options.outlineAlpha ?? 1),
      0.5
    );
    graphics.drawPolygon(geometry.points);
    graphics.closePath?.();
    graphics.eventMode = "none";
    return graphics;
  }

  // Draw only the exterior boundary of the corridor rectangle union.
  static _createUnifiedOutline(geometries = [], style, options) {
    if (style.outlineEnabled === false) return null;
    const width = Number(style.outlineWidth ?? 3);
    if (width <= 0) return null;

    const rectangles = geometries
      .map(item => item.bounds)
      .filter(bounds => bounds && bounds.width > 0 && bounds.height > 0)
      .map(bounds => ({
        left: Number(bounds.x),
        top: Number(bounds.y),
        right: Number(bounds.x) + Number(bounds.width),
        bottom: Number(bounds.y) + Number(bounds.height)
      }));

    if (!rectangles.length) return null;

    const xs = [...new Set(rectangles.flatMap(r => [r.left, r.right]))].sort((a, b) => a - b);
    const ys = [...new Set(rectangles.flatMap(r => [r.top, r.bottom]))].sort((a, b) => a - b);
    const filled = new Set();

    for (let xi = 0; xi < xs.length - 1; xi++) {
      for (let yi = 0; yi < ys.length - 1; yi++) {
        const mx = (xs[xi] + xs[xi + 1]) / 2;
        const my = (ys[yi] + ys[yi + 1]) / 2;
        if (rectangles.some(r => mx >= r.left && mx <= r.right && my >= r.top && my <= r.bottom)) {
          filled.add(`${xi}:${yi}`);
        }
      }
    }

    const horizontal = [];
    const vertical = [];

    for (const key of filled) {
      const [xi, yi] = key.split(":").map(Number);
      if (!filled.has(`${xi}:${yi - 1}`)) horizontal.push({ fixed: ys[yi], start: xs[xi], end: xs[xi + 1] });
      if (!filled.has(`${xi}:${yi + 1}`)) horizontal.push({ fixed: ys[yi + 1], start: xs[xi], end: xs[xi + 1] });
      if (!filled.has(`${xi - 1}:${yi}`)) vertical.push({ fixed: xs[xi], start: ys[yi], end: ys[yi + 1] });
      if (!filled.has(`${xi + 1}:${yi}`)) vertical.push({ fixed: xs[xi + 1], start: ys[yi], end: ys[yi + 1] });
    }

    const graphics = new PIXI.Graphics();
    graphics.lineStyle(
      width,
      this._hex(style.outlineColor || "#1f1f1f"),
      Number(options.outlineAlpha ?? 1),
      0.5
    );

    for (const segment of this._mergeCollinearSegments(horizontal)) {
      graphics.moveTo(segment.start, segment.fixed);
      graphics.lineTo(segment.end, segment.fixed);
    }
    for (const segment of this._mergeCollinearSegments(vertical)) {
      graphics.moveTo(segment.fixed, segment.start);
      graphics.lineTo(segment.fixed, segment.end);
    }

    graphics.eventMode = "none";
    return graphics;
  }

  static _mergeCollinearSegments(segments = []) {
    const groups = new Map();
    for (const segment of segments) {
      const key = String(segment.fixed);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ ...segment });
    }

    const merged = [];
    for (const group of groups.values()) {
      group.sort((a, b) => a.start - b.start || a.end - b.end);
      let current = null;
      for (const segment of group) {
        if (!current) current = { ...segment };
        else if (segment.start <= current.end) current.end = Math.max(current.end, segment.end);
        else {
          merged.push(current);
          current = { ...segment };
        }
      }
      if (current) merged.push(current);
    }
    return merged;
  }

  static async _loadTexture(path) {
    if (!path) return null;
    const normalized = String(path).replace(/^\//, "");

    try {
      if (globalThis.loadTexture) return await globalThis.loadTexture(normalized);
      if (PIXI.Assets?.load) return await PIXI.Assets.load(`/${normalized}`);
      return PIXI.Texture.from(`/${normalized}`);
    } catch (error) {
      console.error(`ai-director | Failed to load floor texture: ${normalized}`, error);
      return null;
    }
  }

  static _resolveParent() {
    const parent = globalThis.canvas?.primary || globalThis.canvas?.stage;
    if (!parent) throw new Error("Cartographer Floor Layer could not find a canvas parent.");
    parent.sortableChildren = true;
    return parent;
  }

  static _findExistingContainer() {
    const parent = globalThis.canvas?.primary || globalThis.canvas?.stage;
    return (parent?.children || []).find(child => child?.name === this.NAME) || null;
  }

  static _assertCanvas(scene) {
    if (!scene) throw new Error("Cartographer Floor Layer requires an active scene.");
    if (!globalThis.canvas?.ready) throw new Error("Cartographer Floor Layer requires a ready canvas.");
  }

  static _boundsForPoints(points) {
    const xs = [];
    const ys = [];
    for (let i = 0; i < points.length; i += 2) {
      xs.push(Number(points[i]));
      ys.push(Number(points[i + 1]));
    }
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  static _hex(color) {
    return Number.parseInt(String(color || "#000000").replace("#", ""), 16);
  }

  static _result(scene, style, geometries, container) {
    return {
      sceneId: scene?.id || null,
      rendered: Boolean(container),
      geometryCount: geometries.length,
      roomCount: geometries.filter(item => item.kind === "ROOM").length,
      corridorCount: geometries.filter(item => item.kind === "CORRIDOR").length,
      junctionCount: geometries.filter(item => item.kind === "JUNCTION").length,
      style: FloorStyleResolver.toMetadata(style),
      assignmentMode: style.assignmentMode || "AUTOMATIC",
      roomPresets: Object.fromEntries(
        geometries
          .filter(item => item.kind === "ROOM" && item.sectorId)
          .map(item => [item.sectorId, item.floorStyle?.preset || null])
      ),
      container
    };
  }
}
