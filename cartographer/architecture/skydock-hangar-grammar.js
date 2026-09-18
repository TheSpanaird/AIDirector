import { GrammarContract } from "./grammar-contract.js";

export class SkydockHangarGrammar {
  static GRAMMAR_ID = "SKYDOCK_HANGAR_V2";
  static SPECIAL_ARCHETYPE = "STOLEN_SHIPMENT_SKYDOCK";

  static build(roomProgram = {}, options = {}) {
    const gridSize = Math.max(1, Number(options.gridSize) || 100);
    const originX = Number(options.originX) || 1000;
    const originY = Number(options.originY) || 1000;
    const seed = String(options.layoutSeed || roomProgram.layoutSeed || "skydock-floor12-001");
    const mirrored = GrammarContract.hash(seed) % 2 === 1;
    const features = this._features(roomProgram, options);
    const cells = this._cells(mirrored, features);
    const supplied = new Map((roomProgram.sectors || []).map(sector => [sector.sectorId, sector]));
    const definitions = [
      ["access-corridor", "Floor 12 Access", "ENTRY", "ENTRY"],
      ["security", "Security Checkpoint", "SECURITY", "OPTIONAL"],
      ["hangar", "Hangar", "HANGAR", "HUB"],
      ["warehouse", "Shipment Warehouse", "WAREHOUSE", "OBJECTIVE"],
      ["shipping-office", "Shipping Office", "OFFICE", "OPTIONAL"],
      ["maintenance", "Maintenance", "MAINTENANCE", "OPTIONAL"],
      ["ventilation-control", "Ventilation Control", "VENTILATION_CONTROL", "OPTIONAL"],
      ["skydock", "Skydock Platform", "SKYDOCK", "EXIT"]
    ];
    if (features.has("SECURE_HOLDING_ROOM")) {
      definitions.push(["secure-holding", "Secure Cargo Holding", "SECURE_HOLDING", "OBJECTIVE"]);
    }

    const sectors = definitions.map(([sectorId, defaultName, purpose, defaultRole]) => {
      const source = supplied.get(sectorId) || {};
      const cell = cells[sectorId];
      const bounds = {
        x: originX + cell.col * gridSize,
        y: originY + cell.row * gridSize,
        width: cell.w * gridSize,
        height: cell.h * gridSize
      };
      return {
        ...source,
        sectorId,
        name: source.name || defaultName,
        purpose,
        graphRole: source.graphRole || defaultRole,
        floor: 12,
        connections: [],
        gridPosition: { col: cell.col, row: cell.row },
        gridDimensions: { w: cell.w, h: cell.h },
        bounds,
        pixelBounds: { ...bounds },
        center: {
          x: bounds.x + bounds.width / 2,
          y: bounds.y + bounds.height / 2
        },
        architecturalZone: cell.zone,
        shapeType: "RECTANGLE",
        shapeTypeSource: this.GRAMMAR_ID,
        environment: cell.environment || "INTERIOR",
        exteriorPlatform: sectorId === "skydock",
        securityLevel: sectorId === "secure-holding" ? "HIGH" : null
      };
    });

    const byId = new Map(sectors.map(sector => [sector.sectorId, sector]));
    const pairs = [
      ["access-corridor", "security"],
      ["security", "hangar"],
      ["hangar", "warehouse"],
      ["warehouse", "shipping-office"],
      ["warehouse", "maintenance"],
      ["maintenance", "ventilation-control"]
    ];
    if (features.has("SECURE_HOLDING_ROOM")) {
      pairs.push(["hangar", "secure-holding"]);
    }

    const openings = pairs.map(([sourceId, targetId], index) =>
      this._sharedOpening(
        byId.get(sourceId),
        byId.get(targetId),
        gridSize,
        index,
        targetId === "secure-holding"
          ? { doorType: "LOCKED", connectionType: "LOCKED_DOOR" }
          : {}
      )
    );
    openings.push(this._sharedOpening(
      byId.get("hangar"),
      byId.get("skydock"),
      gridSize,
      openings.length,
      {
        openingId: "hangar-skydock-bay-door",
        width: gridSize * 8,
        connectionType: "HANGAR_DOOR"
      }
    ));
    openings.push(this._entry(
      byId.get("access-corridor"),
      mirrored,
      gridSize
    ));

    const ventilation = this._ventilation(features);
    const result = {
      grammarId: this.GRAMMAR_ID,
      variantId: mirrored ? "SKYDOCK_WEST" : "SKYDOCK_EAST",
      layoutSeed: seed,
      floor: 12,
      envelope: this._envelope(
        sectors.filter(sector => sector.sectorId !== "skydock")
      ),
      totalEnvelope: this._envelope(sectors),
      sectors,
      openings,
      openingPlan: { openings },
      routes: [],
      normalizedTopology: {
        gridSize,
        rectangles: [],
        junctions: []
      },
      floors: { 12: { floor: 12, sectors } },
      ventilation,
      securityPlan: this._security(
        features,
        byId,
        ventilation,
        gridSize
      ),
      specialFeatures: [...features],
      architecturalGrammar: {
        grammarId: this.GRAMMAR_ID,
        profileId: "SKYDOCK_HANGAR",
        sceneArchetype:
          options.sceneArchetype || roomProgram.sceneArchetype || null,
        exteriorPlatformId: "skydock",
        hangarDoorId: "hangar-skydock-bay-door"
      }
    };

    const contract = GrammarContract.validate(result);
    if (!contract.valid) {
      throw new Error(contract.problems.join(" "));
    }
    return result;
  }

  static _features(roomProgram, options) {
    const values = [
      ...(roomProgram.specialFeatures || []),
      ...(options.specialFeatures || [])
    ].map(value => String(value).toUpperCase());
    const archetype = String(
      options.sceneArchetype || roomProgram.sceneArchetype || ""
    ).toUpperCase();
    if (archetype === this.SPECIAL_ARCHETYPE) {
      values.push(
        "SECURE_HOLDING_ROOM",
        "ACCESS_FEED_VENTILATION",
        "DUCT_CAMERAS",
        "DUCT_BEND_TURRETS",
        "SECURITY_CAMERAS"
      );
    }
    return new Set(values);
  }

  static _cells(mirrored, features) {
    const cells = {
      "access-corridor": {
        col: 0, row: 6, w: 3, h: 4, zone: "ACCESS"
      },
      security: {
        col: 3, row: 6, w: 4, h: 4, zone: "ACCESS"
      },
      hangar: {
        col: 7, row: 2, w: 14, h: 12, zone: "OPERATIONS"
      },
      warehouse: {
        col: 7, row: 14, w: 14, h: 8, zone: "CARGO"
      },
      "shipping-office": {
        col: 3, row: 14, w: 4, h: 4, zone: "ADMIN"
      },
      maintenance: {
        col: 3, row: 18, w: 4, h: 4, zone: "SERVICE"
      },
      "ventilation-control": {
        col: 0, row: 18, w: 3, h: 4, zone: "SERVICE"
      },
      skydock: {
        col: 21,
        row: 4,
        w: 12,
        h: 8,
        zone: "EXTERIOR",
        environment: "EXTERIOR"
      }
    };
    if (features.has("SECURE_HOLDING_ROOM")) {
      cells["secure-holding"] = {
        col: 3, row: 10, w: 4, h: 4, zone: "SECURE"
      };
    }
    if (!mirrored) return cells;
    return Object.fromEntries(
      Object.entries(cells).map(([id, cell]) => [
        id,
        { ...cell, col: 33 - cell.col - cell.w }
      ])
    );
  }

  static _ventilation(features) {
    const source = features.has("ACCESS_FEED_VENTILATION")
      ? "access-corridor"
      : "ventilation-control";
    const targets = [
      "hangar",
      "security",
      "warehouse",
      "shipping-office",
      "maintenance",
      "ventilation-control"
    ];
    if (features.has("SECURE_HOLDING_ROOM")) {
      targets.splice(3, 0, "secure-holding");
    }
    return {
      enabled: true,
      networkType: "AIR_DUCT",
      visibility: "HIDDEN",
      sourceSectorId: source,
      connections: targets
        .filter(target => target !== source)
        .map((to, index) => ({
          from: source,
          to,
          size: index < 2 ? "LARGE" : "SMALL",
          accessType:
            to === "maintenance" ? "SERVICE_HATCH" : "VENT_GRATE"
        }))
    };
  }

  static _security(features, byId, ventilation, gridSize) {
    const devices = [];
    if (features.has("SECURITY_CAMERAS") && byId.has("secure-holding")) {
      const room = byId.get("secure-holding");
      devices.push({
        id: "secure-holding-camera",
        deviceType: "SECURITY_CAMERA",
        sectorId: room.sectorId,
        location: {
          x: room.bounds.x + gridSize,
          y: room.bounds.y + gridSize
        },
        hidden: false
      });
    }
    return {
      enabled:
        devices.length > 0 ||
        features.has("DUCT_CAMERAS") ||
        features.has("DUCT_BEND_TURRETS"),
      devices,
      ductCameraPolicy:
        features.has("DUCT_CAMERAS") ? "EACH_CONNECTION" : "NONE",
      ductBendTurretPolicy:
        features.has("DUCT_BEND_TURRETS") ? "EACH_BEND" : "NONE",
      ventilationSourceId: ventilation.sourceSectorId
    };
  }

  static _entry(room, mirrored, gridSize) {
    const face = mirrored ? "EAST" : "WEST";
    const bounds = room.bounds;
    const location = face === "WEST"
      ? { x: bounds.x, y: bounds.y + bounds.height / 2 }
      : {
          x: bounds.x + bounds.width,
          y: bounds.y + bounds.height / 2
        };
    return this._opening(
      "floor12-building-entry",
      room.sectorId,
      "__building_interior__",
      location,
      face,
      gridSize * 2,
      "STANDARD_DOOR",
      "STANDARD"
    );
  }

  static _sharedOpening(source, target, gridSize, index, overrides = {}) {
    const first = source.bounds;
    const second = target.bounds;
    const overlapY =
      Math.min(first.y + first.height, second.y + second.height) -
      Math.max(first.y, second.y);
    const overlapX =
      Math.min(first.x + first.width, second.x + second.width) -
      Math.max(first.x, second.x);
    let face;
    let location;
    let maximumWidth;

    if (
      overlapY > 0 &&
      Math.abs(first.x + first.width - second.x) < 0.01
    ) {
      face = "EAST";
      location = {
        x: second.x,
        y: Math.max(first.y, second.y) + overlapY / 2
      };
      maximumWidth = overlapY;
    } else if (
      overlapY > 0 &&
      Math.abs(second.x + second.width - first.x) < 0.01
    ) {
      face = "WEST";
      location = {
        x: first.x,
        y: Math.max(first.y, second.y) + overlapY / 2
      };
      maximumWidth = overlapY;
    } else if (
      overlapX > 0 &&
      Math.abs(first.y + first.height - second.y) < 0.01
    ) {
      face = "SOUTH";
      location = {
        x: Math.max(first.x, second.x) + overlapX / 2,
        y: second.y
      };
      maximumWidth = overlapX;
    } else if (
      overlapX > 0 &&
      Math.abs(second.y + second.height - first.y) < 0.01
    ) {
      face = "NORTH";
      location = {
        x: Math.max(first.x, second.x) + overlapX / 2,
        y: first.y
      };
      maximumWidth = overlapX;
    } else {
      throw new Error(
        `No shared boundary for ${source.sectorId} and ${target.sectorId}.`
      );
    }

    return this._opening(
      overrides.openingId || `skydock-door-${index}`,
      source.sectorId,
      target.sectorId,
      location,
      face,
      Math.min(Number(overrides.width) || gridSize * 2, maximumWidth),
      overrides.connectionType || "STANDARD_DOOR",
      overrides.doorType || "STANDARD"
    );
  }

  static _opening(
    id,
    sourceId,
    targetId,
    location,
    face,
    width,
    connectionType,
    doorType
  ) {
    return {
      openingId: id,
      id,
      hostType: "ROOM",
      hostId: sourceId,
      sourceId,
      targetId,
      connectedSources: [sourceId],
      connectedTargets: [targetId],
      location,
      requestedLocation: { ...location },
      face,
      orientation:
        ["EAST", "WEST"].includes(face) ? "VERTICAL" : "HORIZONTAL",
      width,
      doorType,
      connectionType,
      exactFaceRequired: true,
      source: this.GRAMMAR_ID
    };
  }

  static _envelope(sectors) {
    const left = Math.min(...sectors.map(sector => sector.bounds.x));
    const top = Math.min(...sectors.map(sector => sector.bounds.y));
    const right = Math.max(
      ...sectors.map(sector => sector.bounds.x + sector.bounds.width)
    );
    const bottom = Math.max(
      ...sectors.map(sector => sector.bounds.y + sector.bounds.height)
    );
    return {
      x: left,
      y: top,
      width: right - left,
      height: bottom - top
    };
  }
}
