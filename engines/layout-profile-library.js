// modules/ai-director/scripts/cartographer/layout-profile-library.js
// AI Director Cartographer Phase 5
// Architectural layout profiles independent from genre and floor style.

export class LayoutProfileLibrary {
  static FAMILIES = Object.freeze({
    NATURAL: "NATURAL",
    RESIDENTIAL: "RESIDENTIAL",
    COMMERCIAL: "COMMERCIAL",
    COVERT: "COVERT",
    FORTIFIED: "FORTIFIED",
    TECHNICAL: "TECHNICAL"
  });

  static DENSITIES = Object.freeze({
    LOW: "LOW",
    MEDIUM: "MEDIUM",
    HIGH: "HIGH"
  });

  static SYMMETRIES = Object.freeze({
    NONE: "NONE",
    LOW: "LOW",
    MEDIUM: "MEDIUM",
    HIGH: "HIGH"
  });

  static CORRIDOR_PATTERNS = Object.freeze({
    BRANCHING: "BRANCHING",
    MINIMAL: "MINIMAL",
    CENTRAL_HALL: "CENTRAL_HALL",
    PUBLIC_SPINE: "PUBLIC_SPINE",
    SERVICE_SPINE: "SERVICE_SPINE",
    DEFENSIVE_RING: "DEFENSIVE_RING",
    LAYERED: "LAYERED",
    DECK_SPINE: "DECK_SPINE",
    MODULAR_GRID: "MODULAR_GRID"
  });

  static FOOTPRINTS = Object.freeze({
    IRREGULAR: "IRREGULAR",
    COMPACT: "COMPACT",
    RECTANGULAR: "RECTANGULAR",
    COURTYARD: "COURTYARD",
    PERIMETER: "PERIMETER",
    LAYERED: "LAYERED",
    LINEAR: "LINEAR",
    MODULAR: "MODULAR"
  });

  static SECONDARY_NETWORKS = Object.freeze({
    VENTILATION: "VENTILATION",
    SERVICE_ACCESS: "SERVICE_ACCESS",
    ESCAPE_ROUTE: "ESCAPE_ROUTE"
  });

  static DEFAULT_PROFILE = "MINE";

  static PROFILES = Object.freeze({
    MINE: this._profile({
      family: "NATURAL",
      roomGap: 300,
      packingDensity: "LOW",
      sharedWallPreference: false,
      corridorPattern: "BRANCHING",
      footprintShape: "IRREGULAR",
      symmetry: "NONE",
      entranceCount: 1,
      courtyardAllowed: false,
      defensivePerimeter: false,
      chokePointPreference: false,
      connectionPolicy: "NATURAL_BRANCHING",
      maximumRoomDegree: 4,
      preferSharedWalls: false,
      allowCrossMapRoutes: true,
      towerShape: "TOWER_SQUARE",
      secondaryNetworks: ["ESCAPE_ROUTE"],
      requiredPurposes: ["ENTRY", "WORK_AREA", "STORAGE"],
      preferredPurposes: ["WORKSHOP", "SECURITY", "SECRET"],
      description: "Spread-out chambers with long branches, irregular circulation, and dead ends."
    }),

    CAVE: this._profile({
      family: "NATURAL",
      roomGap: 300,
      packingDensity: "LOW",
      sharedWallPreference: false,
      corridorPattern: "BRANCHING",
      footprintShape: "IRREGULAR",
      symmetry: "NONE",
      entranceCount: 1,
      courtyardAllowed: false,
      defensivePerimeter: false,
      chokePointPreference: true,
      connectionPolicy: "NATURAL_BRANCHING",
      maximumRoomDegree: 4,
      preferSharedWalls: false,
      allowCrossMapRoutes: true,
      towerShape: "TOWER_SQUARE",
      secondaryNetworks: ["ESCAPE_ROUTE"],
      requiredPurposes: ["ENTRY"],
      preferredPurposes: ["CAVERN", "WATER", "SECRET"],
      description: "Organic chambers connected by irregular passages and natural choke points."
    }),

    HOUSE: this._profile({
      family: "RESIDENTIAL",
      roomGap: 0,
      packingDensity: "HIGH",
      sharedWallPreference: true,
      corridorPattern: "MINIMAL",
      footprintShape: "RECTANGULAR",
      symmetry: "LOW",
      entranceCount: 2,
      courtyardAllowed: false,
      defensivePerimeter: false,
      chokePointPreference: false,
      secondaryNetworks: [],
      requiredPurposes: ["ENTRY", "LIVING", "KITCHEN"],
      preferredPurposes: ["BEDROOM", "STORAGE", "OFFICE"],
      description: "Dense adjoining rooms with shared walls and minimal hallway space."
    }),

    MANOR: this._profile({
      family: "RESIDENTIAL",
      roomGap: 0,
      packingDensity: "HIGH",
      sharedWallPreference: true,
      corridorPattern: "CENTRAL_HALL",
      footprintShape: "COURTYARD",
      symmetry: "MEDIUM",
      entranceCount: 2,
      courtyardAllowed: true,
      defensivePerimeter: false,
      chokePointPreference: false,
      secondaryNetworks: ["SERVICE_ACCESS"],
      requiredPurposes: ["ENTRY", "HALL", "LIVING"],
      preferredPurposes: ["BEDROOM", "KITCHEN", "OFFICE", "STORAGE"],
      description: "Large residential plan organized around halls, service spaces, and optional courtyards."
    }),

    BAR: this._profile({
      family: "COMMERCIAL",
      roomGap: 0,
      packingDensity: "HIGH",
      sharedWallPreference: true,
      corridorPattern: "SERVICE_SPINE",
      footprintShape: "RECTANGULAR",
      symmetry: "LOW",
      entranceCount: 2,
      courtyardAllowed: false,
      defensivePerimeter: false,
      chokePointPreference: false,
      secondaryNetworks: ["SERVICE_ACCESS"],
      requiredPurposes: ["ENTRY", "PUBLIC_ROOM", "BAR"],
      preferredPurposes: ["KITCHEN", "STORAGE", "OFFICE", "RESTROOM"],
      description: "Public room centered on a service counter with restricted staff and storage areas."
    }),

    CLUB: this._profile({
      family: "COMMERCIAL",
      roomGap: 0,
      packingDensity: "HIGH",
      sharedWallPreference: true,
      corridorPattern: "PUBLIC_SPINE",
      footprintShape: "COMPACT",
      symmetry: "LOW",
      entranceCount: 2,
      courtyardAllowed: false,
      defensivePerimeter: false,
      chokePointPreference: true,
      secondaryNetworks: ["SERVICE_ACCESS", "VENTILATION"],
      requiredPurposes: ["ENTRY", "PUBLIC_ROOM", "STAGE"],
      preferredPurposes: ["BAR", "BACKSTAGE", "VIP", "SECURITY", "STORAGE"],
      description: "Large public floor with controlled entry, focal stage, service areas, and restricted rooms."
    }),

    TAVERN: this._profile({
      family: "COMMERCIAL",
      roomGap: 0,
      packingDensity: "HIGH",
      sharedWallPreference: true,
      corridorPattern: "MINIMAL",
      footprintShape: "RECTANGULAR",
      symmetry: "LOW",
      entranceCount: 2,
      courtyardAllowed: true,
      defensivePerimeter: false,
      chokePointPreference: false,
      secondaryNetworks: ["SERVICE_ACCESS"],
      requiredPurposes: ["ENTRY", "PUBLIC_ROOM", "KITCHEN"],
      preferredPurposes: ["STORAGE", "BEDROOM", "STABLE"],
      description: "Compact public room with kitchen, storage, lodging, and optional yard access."
    }),

    HIDEOUT: this._profile({
      family: "COVERT",
      roomGap: 0,
      packingDensity: "HIGH",
      sharedWallPreference: true,
      corridorPattern: "MINIMAL",
      footprintShape: "COMPACT",
      symmetry: "NONE",
      entranceCount: 1,
      courtyardAllowed: false,
      defensivePerimeter: false,
      chokePointPreference: true,
      secondaryNetworks: ["ESCAPE_ROUTE"],
      requiredPurposes: ["ENTRY", "LIVING", "STORAGE"],
      preferredPurposes: ["SECURITY", "WORKSHOP", "SECRET"],
      description: "Concealed compact rooms with defensible access and an optional escape route."
    }),

    SAFEHOUSE: this._profile({
      family: "COVERT",
      roomGap: 0,
      packingDensity: "HIGH",
      sharedWallPreference: true,
      corridorPattern: "MINIMAL",
      footprintShape: "RECTANGULAR",
      symmetry: "LOW",
      entranceCount: 2,
      courtyardAllowed: false,
      defensivePerimeter: false,
      chokePointPreference: true,
      secondaryNetworks: ["ESCAPE_ROUTE"],
      requiredPurposes: ["ENTRY", "LIVING", "STORAGE"],
      preferredPurposes: ["MEDICAL", "SECURITY", "SECRET"],
      description: "Residential-looking shelter with concealed security, storage, and escape access."
    }),

    SECRET_BASE: this._profile({
      family: "COVERT",
      roomGap: 100,
      packingDensity: "MEDIUM",
      sharedWallPreference: true,
      corridorPattern: "SERVICE_SPINE",
      footprintShape: "LAYERED",
      symmetry: "LOW",
      entranceCount: 1,
      courtyardAllowed: false,
      defensivePerimeter: true,
      chokePointPreference: true,
      secondaryNetworks: ["VENTILATION", "SERVICE_ACCESS", "ESCAPE_ROUTE"],
      requiredPurposes: ["ENTRY", "SECURITY", "COMMAND"],
      preferredPurposes: ["WORKSHOP", "STORAGE", "BARRACKS", "SECRET"],
      description: "Layered concealed facility with security zones and secondary service routes."
    }),

    CASTLE: this._profile({
      family: "FORTIFIED",
      roomGap: 0,
      packingDensity: "HIGH",
      sharedWallPreference: true,
      corridorPattern: "LAYERED",
      footprintShape: "COURTYARD",
      symmetry: "MEDIUM",
      entranceCount: 2,
      courtyardAllowed: true,
      defensivePerimeter: true,
      chokePointPreference: true,
      connectionPolicy: "MINIMUM_NETWORK",
      maximumRoomDegree: 3,
      preferSharedWalls: true,
      allowCrossMapRoutes: false,
      towerShape: "TOWER_SQUARE",
      secondaryNetworks: ["SERVICE_ACCESS", "ESCAPE_ROUTE"],
      requiredPurposes: ["ENTRY", "HALL", "COMMAND"],
      preferredPurposes: ["COURTYARD", "BARRACKS", "STORAGE", "TOWER"],
      description: "Compact halls and chambers organized around courtyards, towers, and layered access."
    }),

    FORT: this._profile({
      family: "FORTIFIED",
      roomGap: 0,
      packingDensity: "HIGH",
      sharedWallPreference: true,
      corridorPattern: "DEFENSIVE_RING",
      footprintShape: "PERIMETER",
      symmetry: "MEDIUM",
      entranceCount: 1,
      courtyardAllowed: true,
      defensivePerimeter: true,
      chokePointPreference: true,
      secondaryNetworks: ["SERVICE_ACCESS"],
      requiredPurposes: ["ENTRY", "COURTYARD", "BARRACKS"],
      preferredPurposes: ["COMMAND", "STORAGE", "SECURITY"],
      description: "Defensive perimeter surrounding a yard, barracks, storage, and command spaces."
    }),

    FORTRESS: this._profile({
      family: "FORTIFIED",
      roomGap: 100,
      packingDensity: "MEDIUM",
      sharedWallPreference: true,
      corridorPattern: "LAYERED",
      footprintShape: "LAYERED",
      symmetry: "MEDIUM",
      entranceCount: 1,
      courtyardAllowed: true,
      defensivePerimeter: true,
      chokePointPreference: true,
      secondaryNetworks: ["SERVICE_ACCESS", "ESCAPE_ROUTE"],
      requiredPurposes: ["ENTRY", "SECURITY", "COMMAND"],
      preferredPurposes: ["COURTYARD", "BARRACKS", "STORAGE", "INNER_KEEP"],
      description: "Large fortified complex with multiple defensive layers, gates, and an inner stronghold."
    }),

    OUTPOST: this._profile({
      family: "FORTIFIED",
      roomGap: 0,
      packingDensity: "HIGH",
      sharedWallPreference: true,
      corridorPattern: "MINIMAL",
      footprintShape: "COMPACT",
      symmetry: "LOW",
      entranceCount: 1,
      courtyardAllowed: false,
      defensivePerimeter: true,
      chokePointPreference: true,
      secondaryNetworks: [],
      requiredPurposes: ["ENTRY", "SECURITY", "STORAGE"],
      preferredPurposes: ["COMMAND", "BARRACKS", "UTILITY"],
      description: "Small defensive footprint focused on observation, security, storage, and utilities."
    }),

    FACILITY: this._profile({
      family: "TECHNICAL",
      roomGap: 0,
      packingDensity: "HIGH",
      sharedWallPreference: true,
      corridorPattern: "MODULAR_GRID",
      footprintShape: "MODULAR",
      symmetry: "MEDIUM",
      entranceCount: 2,
      purposeDimensions: {
        ENTRY: { preferred: { w: 8, h: 6 }, min: { w: 6, h: 5 }, max: { w: 10, h: 8 } },
        RECEPTION: { preferred: { w: 8, h: 6 }, min: { w: 6, h: 5 }, max: { w: 10, h: 8 } },
        PUBLIC_ROOM: { preferred: { w: 10, h: 8 }, min: { w: 8, h: 7 }, max: { w: 12, h: 10 } },
        CONFERENCE: { preferred: { w: 10, h: 8 }, min: { w: 8, h: 7 }, max: { w: 12, h: 10 } },
        OFFICE: { preferred: { w: 6, h: 6 }, min: { w: 5, h: 5 }, max: { w: 8, h: 8 } },
        STORAGE: { preferred: { w: 5, h: 5 }, min: { w: 3, h: 4 }, max: { w: 7, h: 7 } },
        SERVICE: { preferred: { w: 6, h: 5 }, min: { w: 4, h: 4 }, max: { w: 8, h: 7 } },
        RESTROOM: { preferred: { w: 4, h: 4 }, min: { w: 3, h: 3 }, max: { w: 5, h: 5 } },
        UTILITY: { preferred: { w: 4, h: 5 }, min: { w: 3, h: 4 }, max: { w: 5, h: 6 } },
        STAIR: { preferred: { w: 4, h: 5 }, min: { w: 3, h: 4 }, max: { w: 5, h: 6 } },
        STAIRWELL: { preferred: { w: 4, h: 5 }, min: { w: 3, h: 4 }, max: { w: 5, h: 6 } },
        ELEVATOR: { preferred: { w: 3, h: 4 }, min: { w: 3, h: 3 }, max: { w: 4, h: 5 } }
      },
      courtyardAllowed: false,
      defensivePerimeter: false,
      chokePointPreference: true,
      secondaryNetworks: ["VENTILATION", "SERVICE_ACCESS"],
      requiredPurposes: ["ENTRY", "SECURITY", "UTILITY"],
      preferredPurposes: ["OFFICE", "WORKSHOP", "STORAGE", "REACTOR"],
      description: "Dense modular rooms connected by controlled corridors and service networks."
    }),

    SPACESHIP: this._profile({
      family: "TECHNICAL",
      roomGap: 0,
      packingDensity: "HIGH",
      sharedWallPreference: true,
      corridorPattern: "DECK_SPINE",
      footprintShape: "LINEAR",
      symmetry: "HIGH",
      entranceCount: 2,
      courtyardAllowed: false,
      defensivePerimeter: false,
      chokePointPreference: true,
      connectionPolicy: "MINIMUM_NETWORK",
      maximumRoomDegree: 3,
      preferSharedWalls: true,
      allowCrossMapRoutes: false,
      towerShape: "TOWER_SQUARE",
      secondaryNetworks: ["VENTILATION", "SERVICE_ACCESS", "ESCAPE_ROUTE"],
      requiredPurposes: ["ENTRY", "COMMAND", "REACTOR"],
      preferredPurposes: ["HANGAR", "BARRACKS", "STORAGE", "MEDICAL"],
      description: "Dense modular compartments arranged along a deck spine with restricted engineering access."
    }),

    SPACE_STATION: this._profile({
      family: "TECHNICAL",
      roomGap: 0,
      packingDensity: "HIGH",
      sharedWallPreference: true,
      corridorPattern: "MODULAR_GRID",
      footprintShape: "MODULAR",
      symmetry: "HIGH",
      entranceCount: 3,
      courtyardAllowed: false,
      defensivePerimeter: false,
      chokePointPreference: true,
      secondaryNetworks: ["VENTILATION", "SERVICE_ACCESS", "ESCAPE_ROUTE"],
      requiredPurposes: ["ENTRY", "COMMAND", "UTILITY"],
      preferredPurposes: ["HANGAR", "SECURITY", "STORAGE", "REACTOR"],
      description: "Large modular technical complex with multiple access points and service networks."
    })
  });

  static get(profileId) {
    const id = this.normalizeProfileId(profileId);
    return this.PROFILES[id] || null;
  }

  static has(profileId) {
    return Boolean(this.get(profileId));
  }

  static list({ family = null } = {}) {
    const normalizedFamily = family
      ? this.normalizeFamily(family)
      : null;

    return Object.values(this.PROFILES)
      .filter(profile =>
        !normalizedFamily || profile.family === normalizedFamily
      )
      .map(profile => structuredClone(profile));
  }

  static listFamilies() {
    return Object.values(this.FAMILIES);
  }

  static getByFamily(family) {
    return this.list({ family });
  }

  static resolve(profileId, fallback = this.DEFAULT_PROFILE) {
    return this.get(profileId) ||
      this.get(fallback) ||
      this.get(this.DEFAULT_PROFILE);
  }

  static supportsSecondaryNetwork(profileId, networkType) {
    const profile = this.get(profileId);
    const network = String(networkType || "")
      .trim()
      .toUpperCase();
    return Boolean(
      profile?.secondaryNetworks?.includes(network)
    );
  }

  static toLayoutConfig(profileId, overrides = {}) {
    const profile = this.resolve(profileId);
    return {
      profileId: profile.id,
      layoutFamily: profile.family,
      roomGap: profile.roomGap,
      packingDensity: profile.packingDensity,
      sharedWallPreference: profile.sharedWallPreference,
      corridorPattern: profile.corridorPattern,
      footprintShape: profile.footprintShape,
      symmetry: profile.symmetry,
      entranceCount: profile.entranceCount,
      emergencyExitCount: profile.emergencyExitCount,
      floorRange: [...profile.floorRange],
      stairWidth: profile.stairWidth,
      stairHeight: profile.stairHeight,
      hallwayWeight: profile.hallwayWeight,
      directDoorLimit: profile.directDoorLimit,
      purposeDimensions: structuredClone(profile.purposeDimensions || {}),
      courtyardAllowed: profile.courtyardAllowed,
      defensivePerimeter: profile.defensivePerimeter,
      chokePointPreference: profile.chokePointPreference,
      secondaryNetworks: [...profile.secondaryNetworks],
      ...structuredClone(overrides || {})
    };
  }

  static validate() {
    const problems = [];
    const ids = new Set();

    for (const profile of Object.values(this.PROFILES)) {
      if (ids.has(profile.id)) {
        problems.push(`Duplicate profile id: ${profile.id}`);
      }
      ids.add(profile.id);

      if (!Object.values(this.FAMILIES).includes(profile.family)) {
        problems.push(`Invalid family for ${profile.id}: ${profile.family}`);
      }

      if (!Object.values(this.DENSITIES).includes(profile.packingDensity)) {
        problems.push(
          `Invalid packing density for ${profile.id}: ${profile.packingDensity}`
        );
      }

      if (!Object.values(this.SYMMETRIES).includes(profile.symmetry)) {
        problems.push(`Invalid symmetry for ${profile.id}: ${profile.symmetry}`);
      }

      if (!Object.values(this.CORRIDOR_PATTERNS).includes(profile.corridorPattern)) {
        problems.push(
          `Invalid corridor pattern for ${profile.id}: ${profile.corridorPattern}`
        );
      }

      if (!Object.values(this.FOOTPRINTS).includes(profile.footprintShape)) {
        problems.push(
          `Invalid footprint for ${profile.id}: ${profile.footprintShape}`
        );
      }

      if (!Number.isFinite(profile.roomGap) || profile.roomGap < 0) {
        problems.push(`Invalid room gap for ${profile.id}: ${profile.roomGap}`);
      }

      if (!Number.isInteger(profile.entranceCount) || profile.entranceCount < 1) {
        problems.push(
          `Invalid entrance count for ${profile.id}: ${profile.entranceCount}`
        );
      }

      for (const network of profile.secondaryNetworks) {
        if (!Object.values(this.SECONDARY_NETWORKS).includes(network)) {
          problems.push(`Invalid secondary network for ${profile.id}: ${network}`);
        }
      }
    }

    return {
      valid: problems.length === 0,
      problems,
      profileCount: ids.size,
      familyCount: this.listFamilies().length
    };
  }

  static normalizeProfileId(value) {
    return String(value || "")
      .trim()
      .toUpperCase()
      .replace(/[\s-]+/g, "_");
  }

  static normalizeFamily(value) {
    return String(value || "")
      .trim()
      .toUpperCase()
      .replace(/[\s-]+/g, "_");
  }

  static _profile({
    family,
    roomGap,
    packingDensity,
    sharedWallPreference,
    corridorPattern,
    footprintShape,
    symmetry,
    entranceCount,
    emergencyExitCount = 0,
    floorRange = [1, 1],
    stairWidth = 4,
    stairHeight = 5,
    hallwayWeight = 50,
    directDoorLimit = 3,
    purposeDimensions = {},
    courtyardAllowed,
    defensivePerimeter,
    chokePointPreference,
    connectionPolicy = "PRESERVE_GRAPH",
    maximumRoomDegree = 3,
    preferSharedWalls = false,
    allowCrossMapRoutes = true,
    towerShape = "TOWER_SQUARE",
    secondaryNetworks = [],
    requiredPurposes = [],
    preferredPurposes = [],
    description = ""
  }) {
    const id = this.normalizeProfileId(
      // The caller's property name is recovered from the PROFILES key only
      // after construction, so use description-independent values below.
      "UNASSIGNED"
    );

    return {
      id,
      family: this.normalizeFamily(family),
      roomGap: Math.max(0, Number(roomGap) || 0),
      packingDensity: String(packingDensity || "MEDIUM").toUpperCase(),
      sharedWallPreference: sharedWallPreference === true,
      corridorPattern: String(corridorPattern || "MINIMAL").toUpperCase(),
      footprintShape: String(footprintShape || "COMPACT").toUpperCase(),
      symmetry: String(symmetry || "LOW").toUpperCase(),
      entranceCount: Math.max(1, Math.round(Number(entranceCount) || 1)),
      emergencyExitCount: Math.max(0, Math.round(Number(emergencyExitCount) || 0)),
      floorRange: Object.freeze([
        Math.max(1, Math.round(Number(floorRange?.[0]) || 1)),
        Math.max(1, Math.round(Number(floorRange?.[1]) || Number(floorRange?.[0]) || 1))
      ]),
      stairWidth: Math.max(3, Number(stairWidth) || 4),
      stairHeight: Math.max(4, Number(stairHeight) || 5),
      hallwayWeight: Math.max(0, Number(hallwayWeight) || 0),
      directDoorLimit: Math.max(1, Number(directDoorLimit) || 3),
      purposeDimensions: Object.freeze(structuredClone(purposeDimensions || {})),
      courtyardAllowed: courtyardAllowed === true,
      defensivePerimeter: defensivePerimeter === true,
      chokePointPreference: chokePointPreference === true,
      connectionPolicy: String(connectionPolicy || "PRESERVE_GRAPH").toUpperCase(),
      maximumRoomDegree: Math.max(1, Number(maximumRoomDegree) || 3),
      preferSharedWalls: preferSharedWalls === true,
      allowCrossMapRoutes: allowCrossMapRoutes !== false,
      towerShape: String(towerShape || "TOWER_SQUARE").toUpperCase(),
      secondaryNetworks: Object.freeze(
        secondaryNetworks.map(value => String(value).toUpperCase())
      ),
      requiredPurposes: Object.freeze(
        requiredPurposes.map(value => String(value).toUpperCase())
      ),
      preferredPurposes: Object.freeze(
        preferredPurposes.map(value => String(value).toUpperCase())
      ),
      description: String(description || "")
    };
  }
}

// Assign stable IDs from registry keys and deeply freeze every profile.
for (const [id, profile] of Object.entries(LayoutProfileLibrary.PROFILES)) {
  profile.id = id;
  Object.freeze(profile);
}
