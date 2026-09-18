// cartographer-metadata.js
// AI Director Cartographer Alpha 0.1
// FILE: /modules/ai-director/scripts/cartographer/cartographer-metadata.js
// Central metadata contract for persistent Cartographer scene documents.

export class CartographerMetadata {

  static NAMESPACE = "ai-director";
  static VERSION = 6;

  static DOCUMENT_TYPES = Object.freeze({
    ROOM_FLOOR: "room-floor",
    CORRIDOR_FLOOR: "corridor-floor",
    JUNCTION_FLOOR: "junction-floor",
    ROOM_LABEL: "room-label",
    EXTERIOR_WALL: "exterior-wall",
    DOOR: "door",
    BOUNDARY_FEATURE: "boundary-feature",
    GATEWAY: "gateway",
    VERTICAL_CONNECTOR: "vertical-connector"
  });

  static createFlags({
    documentType,
    stableId,
    generationId = null,
    manifestId = null,
    sectorId = null,
    floor = null,
    sourceId = null,
    targetId = null,
    hostType = null,
    hostId = null,
    geometry = null,
    properties = {},
    legacy = {}
  } = {}) {
    const type = this._normalizeRequiredString(
      documentType,
      "documentType"
    );

    const id = this._normalizeRequiredString(
      stableId,
      "stableId"
    );

    return {
      [this.NAMESPACE]: {
        cartographerType: type,
        ...legacy,
        cartographer: {
          version: this.VERSION,
          documentType: type,
          stableId: id,
          generationId: generationId || null,
          manifestId: manifestId || null,
          sectorId: sectorId || null,
          floor: Number.isFinite(Number(floor))
            ? Number(floor)
            : null,
          sourceId: sourceId || null,
          targetId: targetId || null,
          hostType: hostType || null,
          hostId: hostId || null,
          geometry: geometry
            ? structuredClone(geometry)
            : null,
          properties: structuredClone(
            properties || {}
          ),
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      }
    };
  }

  static createRoomFloorFlags({
    sector,
    floor,
    shapeType,
    bounds,
    polygon = null,
    generationId = null,
    manifestId = null
  }) {
    return this.createFlags({
      documentType: this.DOCUMENT_TYPES.ROOM_FLOOR,
      stableId: this.roomStableId(sector.sectorId),
      generationId,
      manifestId,
      sectorId: sector.sectorId,
      floor,
      geometry: {
        bounds: this.cloneBounds(bounds),
        polygon: polygon
          ? structuredClone(polygon)
          : null
      },
      properties: {
        name: sector.name || null,
        graphRole: sector.graphRole || null,
        shapeType,
        floorStyle: sector.floorStyle
          ? this.normalizeRoomFloorStyle(sector.floorStyle)
          : null
      },
      legacy: {
        sectorId: sector.sectorId,
        graphRole: sector.graphRole || null,
        shapeType
      }
    });
  }

  static createCorridorFloorFlags({
    rectangle,
    index,
    generationId = null,
    manifestId = null
  }) {
    const documentType = rectangle.type === "JUNCTION"
      ? this.DOCUMENT_TYPES.JUNCTION_FLOOR
      : this.DOCUMENT_TYPES.CORRIDOR_FLOOR;

    return this.createFlags({
      documentType,
      stableId: this.corridorStableId(
        rectangle,
        index,
        documentType
      ),
      generationId,
      manifestId,
      geometry: {
        rectangle: this.cloneBounds(rectangle)
      },
      properties: {
        orientation: rectangle.orientation || null,
        junctionType:
          rectangle.junctionType ||
          rectangle.topologyType ||
          null
      },
      legacy: {
        orientation: rectangle.orientation || null,
        junctionType:
          rectangle.junctionType ||
          rectangle.topologyType ||
          null
      }
    });
  }

  static createRoomLabelFlags({
    sector,
    floor,
    generationId = null,
    manifestId = null
  }) {
    return this.createFlags({
      documentType: this.DOCUMENT_TYPES.ROOM_LABEL,
      stableId: `label:${sector.sectorId}`,
      generationId,
      manifestId,
      sectorId: sector.sectorId,
      floor,
      properties: {
        text: sector.name || sector.sectorId,
        graphRole: sector.graphRole || null
      },
      legacy: {
        sectorId: sector.sectorId
      }
    });
  }

  static createExteriorWallFlags({
    segment,
    index,
    generationId = null,
    manifestId = null
  }) {
    return this.createFlags({
      documentType: this.DOCUMENT_TYPES.EXTERIOR_WALL,
      stableId: this.segmentStableId(
        this.DOCUMENT_TYPES.EXTERIOR_WALL,
        segment,
        index
      ),
      generationId,
      manifestId,
      sectorId: segment.sectorId || null,
      geometry: {
        segment: this.cloneSegment(segment)
      },
      properties: {
        boundarySource: segment.source || null
      },
      legacy: {
        boundarySource: segment.source || null,
        sectorId: segment.sectorId || null
      }
    });
  }

  static createDoorFlags({
    opening,
    segment,
    generationId = null,
    manifestId = null
  }) {
    return this.createFlags({
      documentType: this.DOCUMENT_TYPES.DOOR,
      stableId:
        opening.id ||
        this.segmentStableId(
          this.DOCUMENT_TYPES.DOOR,
          segment
        ),
      generationId,
      manifestId,
      sectorId:
        opening.hostType === "ROOM"
          ? opening.hostId
          : null,
      sourceId: opening.sourceId || null,
      targetId: opening.targetId || null,
      hostType: opening.hostType || null,
      hostId: opening.hostId || null,
      geometry: {
        segment: this.cloneSegment(segment),
        location: opening.location
          ? structuredClone(opening.location)
          : null,
        face: opening.face || null,
        orientation: opening.orientation || null,
        width: opening.width || null
      },
      properties: {
        openingId: opening.id || null,
        connectionType: opening.connectionType || null,
        accessMode: opening.accessMode || opening.connectionType || null,
        exteriorAccess: opening.exteriorAccess === true,
        verticalAccess: opening.verticalAccess === true,
        doorType: opening.doorType || null,
        sharedDoor: opening.sharedDoor === true,
        connectedTargets:
          structuredClone(opening.connectedTargets || []),
        connectedSources:
          structuredClone(opening.connectedSources || []),
        connectionIds:
          structuredClone(opening.connectionIds || [])
      },
      legacy: {
        openingId: opening.id || null,
        hostType: opening.hostType || null,
        hostId: opening.hostId || null,
        sourceId: opening.sourceId || null,
        targetId: opening.targetId || null,
        connectionType: opening.connectionType || null,
        doorType: opening.doorType || null
      }
    });
  }

  static createVerticalConnectorFlags({
    structureId,
    connectionId,
    connectionType,
    anchorId,
    floor,
    sectorId,
    location,
    generationId = null,
    manifestId = null,
    targetFloor = null,
    targetSceneId = null,
    targetX = null,
    targetY = null
  }) {
    return this.createFlags({
      documentType: this.DOCUMENT_TYPES.VERTICAL_CONNECTOR,
      stableId: `vertical:${structureId}:${connectionId}:${floor}`,
      generationId,
      manifestId,
      sectorId,
      floor,
      geometry: {
        location: location ? structuredClone(location) : null
      },
      properties: {
        structureId,
        floorPresentation: "SEPARATE_SCENES",
        connectionId,
        connectionType,
        anchorId,
        targetFloor: Number.isFinite(Number(targetFloor))
          ? Number(targetFloor)
          : null,
        targetSceneId: targetSceneId || null,
        targetX: Number.isFinite(Number(targetX)) ? Number(targetX) : null,
        targetY: Number.isFinite(Number(targetY)) ? Number(targetY) : null
      },
      legacy: {
        structureId,
        connectionId,
        connectionType,
        anchorId
      }
    });
  }

  static async setVerticalConnectorDestination(document, destination = {}) {
    const metadata = this.get(document);
    if (!metadata || metadata.documentType !== this.DOCUMENT_TYPES.VERTICAL_CONNECTOR) {
      throw new Error("Document is not a Cartographer vertical connector.");
    }
    return this.touchDocument(document, {
      properties: {
        ...(metadata.properties || {}),
        targetFloor: Number(destination.targetFloor),
        targetSceneId: destination.targetSceneId || null,
        targetX: Number(destination.targetX),
        targetY: Number(destination.targetY)
      }
    });
  }

  static createBoundaryFeatureFlags({
    feature,
    segment,
    generationId = null,
    manifestId = null
  }) {
    return this.createFlags({
      documentType:
        this.DOCUMENT_TYPES.BOUNDARY_FEATURE,
      stableId:
        feature.id ||
        this.segmentStableId(
          this.DOCUMENT_TYPES.BOUNDARY_FEATURE,
          segment
        ),
      generationId,
      manifestId,
      sectorId:
        feature.hostType === "ROOM"
          ? feature.hostId
          : null,
      sourceId: feature.sourceId || null,
      hostType: feature.hostType || null,
      hostId: feature.hostId || null,
      geometry: {
        segment: this.cloneSegment(segment),
        location: feature.location
          ? structuredClone(feature.location)
          : null,
        face: feature.face || null,
        orientation: feature.orientation || null,
        width: feature.width || null
      },
      properties: {
        featureId: feature.id || null,
        featureType:
          feature.featureType ||
          "STANDARD_WALL",
        direction: feature.direction || "BOTH",
        metadata: structuredClone(
          feature.metadata || {}
        )
      },
      legacy: {
        featureId: feature.id || null,
        featureType:
          feature.featureType ||
          "STANDARD_WALL",
        hostType: feature.hostType || null,
        hostId: feature.hostId || null,
        sourceId: feature.sourceId || null,
        metadata: structuredClone(
          feature.metadata || {}
        )
      }
    });
  }

  static getRoomFloorStyle(document) {
    const style = this.get(document)
      ?.properties?.floorStyle;
    return style && typeof style === "object"
      ? this.normalizeRoomFloorStyle(style)
      : null;
  }

  static normalizeRoomFloorStyle(style = {}) {
    const normalized = structuredClone(style || {});
    const locked = normalized.locked === true;
    const source = String(normalized.source || "").toUpperCase();
    const automatic = !locked && source !== "MANUAL";

    if (
      automatic &&
      normalized.mode === "PLAIN" &&
      normalized.preset !== "plain"
    ) {
      normalized.mode = "TEXTURE";
      normalized.texturePath = normalized.texturePath || null;
      normalized.roomTexture =
        normalized.roomTexture || normalized.texturePath;
    }

    return normalized;
  }

  static async setRoomFloorStyle(
    document,
    floorStyle
  ) {
    const metadata = this.get(document);
    if (!document || !metadata) return null;
    return this.touchDocument(document, {
      properties: {
        ...(metadata.properties || {}),
        floorStyle: floorStyle
          ? this.normalizeRoomFloorStyle(floorStyle)
          : null
      }
    });
  }

  static createSceneMetadata({
    manifest,
    floorNumber,
    config,
    generationId = null,
    floorStyle = null,
    layoutProfile = null,
    buildingProgram = null
  } = {}) {
    const resolvedGenerationId =
      generationId ||
      this.createGenerationId();

    return {
      version: this.VERSION,
      generationId: resolvedGenerationId,
      manifestId: this.getManifestId(manifest),
      dungeonTitle: manifest?.dungeonTitle || null,
      floorNumber: Number(floorNumber) || 1,
      generatedAt: Date.now(),
      config: structuredClone(config || {}),
      floorStyle: floorStyle
        ? structuredClone(floorStyle)
        : null,
      layoutProfile: layoutProfile
        ? structuredClone(layoutProfile)
        : null,
      buildingProgram: buildingProgram
        ? structuredClone(buildingProgram)
        : null,
      source: "CartographerEngine"
    };
  }

  static getSceneMetadata(scene) {
    return scene?.flags?.[this.NAMESPACE]
      ?.cartographer || null;
  }

  static getFloorStyle(scene) {
    const style = this.getSceneMetadata(scene)
      ?.floorStyle;
    return style && typeof style === "object"
      ? structuredClone(style)
      : null;
  }
  static getLayoutProfile(scene) {
    const profile = this.getSceneMetadata(scene)
      ?.layoutProfile;
    return profile && typeof profile === "object"
      ? structuredClone(profile)
      : null;
  }

  static async setSceneLayoutProfile(
    scene,
    layoutProfile
  ) {
    if (!scene || !layoutProfile) return null;
    const metadata = structuredClone(
      this.getSceneMetadata(scene) || {}
    );
    metadata.layoutProfile = structuredClone(layoutProfile);
    metadata.updatedAt = Date.now();
    return this.setSceneMetadata(scene, metadata);
  }

  static async setSceneFloorStyle(
    scene,
    floorStyle
  ) {
    if (!scene || !floorStyle) {
      return null;
    }

    const metadata = structuredClone(
      this.getSceneMetadata(scene) || {}
    );

    metadata.floorStyle =
      structuredClone(floorStyle);
    metadata.updatedAt = Date.now();

    return this.setSceneMetadata(
      scene,
      metadata
    );
  }

  static async setSceneMetadata(
    scene,
    metadata
  ) {
    if (!scene || !metadata) {
      return null;
    }

    return scene.setFlag(
      this.NAMESPACE,
      "cartographer",
      structuredClone(metadata)
    );
  }

  static get(document) {
    return document?.flags?.[this.NAMESPACE]
      ?.cartographer || null;
  }

  static getLegacy(document) {
    return document?.flags?.[this.NAMESPACE] || null;
  }

  static isCartographerDocument(
    document,
    documentType = null
  ) {
    const metadata = this.get(document);
    const legacy = this.getLegacy(document);
    const type =
      metadata?.documentType ||
      legacy?.cartographerType ||
      null;

    if (!type) {
      return false;
    }

    return documentType
      ? type === documentType
      : true;
  }

  static getStableId(document) {
    return this.get(document)?.stableId || null;
  }

  static getDocuments(
    scene,
    documentType = null
  ) {
    if (!scene) {
      return [];
    }

    const collections = [
      scene.drawings?.contents || [],
      scene.walls?.contents || [],
      scene.tiles?.contents || [],
      scene.regions?.contents || [],
      scene.tokens?.contents || []
    ];

    return collections
      .flat()
      .filter(document =>
        this.isCartographerDocument(
          document,
          documentType
        )
      );
  }

  static indexScene(scene) {
    const index = new Map();

    for (const document of this.getDocuments(scene)) {
      const stableId = this.getStableId(document);
      if (!stableId) continue;

      if (!index.has(stableId)) {
        index.set(stableId, []);
      }

      index.get(stableId).push(document);
    }

    return index;
  }

  static async touchDocument(
    document,
    changes = {}
  ) {
    const metadata = this.get(document);
    if (!document || !metadata) {
      return null;
    }

    const updated = {
      ...structuredClone(metadata),
      ...structuredClone(changes),
      updatedAt: Date.now()
    };

    return document.setFlag(
      this.NAMESPACE,
      "cartographer",
      updated
    );
  }

  static createGenerationId() {
    if (
      globalThis.foundry?.utils
        ?.randomID
    ) {
      return foundry.utils.randomID();
    }

    return `cartographer-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 10)}`;
  }

  static getManifestId(manifest = {}) {
    return (
      manifest.manifestId ||
      manifest.dungeonId ||
      this.slugify(
        manifest.dungeonTitle ||
        "untitled-dungeon"
      )
    );
  }

  static roomStableId(sectorId) {
    return `room:${sectorId}`;
  }

  static corridorStableId(
    rectangle,
    index = 0,
    documentType = "corridor-floor"
  ) {
    const geometry = [
      rectangle.x,
      rectangle.y,
      rectangle.width,
      rectangle.height
    ].join(":");

    return `${documentType}:${geometry}:${index}`;
  }

  static segmentStableId(
    prefix,
    segment,
    index = 0
  ) {
    const normalized = this.cloneSegment(segment);

    return [
      prefix,
      normalized.x1,
      normalized.y1,
      normalized.x2,
      normalized.y2,
      index
    ].join(":");
  }

  static cloneBounds(bounds = {}) {
    return {
      x: Number(bounds.x) || 0,
      y: Number(bounds.y) || 0,
      width: Number(bounds.width) || 0,
      height: Number(bounds.height) || 0
    };
  }

  static cloneSegment(segment = {}) {
    const first = {
      x: Number(segment.x1) || 0,
      y: Number(segment.y1) || 0
    };
    const second = {
      x: Number(segment.x2) || 0,
      y: Number(segment.y2) || 0
    };

    const ordered =
      first.x < second.x ||
      (
        first.x === second.x &&
        first.y <= second.y
      )
        ? [first, second]
        : [second, first];

    return {
      x1: ordered[0].x,
      y1: ordered[0].y,
      x2: ordered[1].x,
      y2: ordered[1].y
    };
  }

  static slugify(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") ||
      "untitled";
  }

  static _normalizeRequiredString(
    value,
    fieldName
  ) {
    const normalized = String(
      value || ""
    ).trim();

    if (!normalized) {
      throw new Error(
        `Cartographer metadata requires ${fieldName}.`
      );
    }

    return normalized;
  }
}
