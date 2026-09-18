// modules/ai-director/scripts/cartographer/layout-profile-library.js

/*
- CARTOGRAPHER ARCHITECTURE REBUILD BOUNDARY
- Architectural constraints and grammar defaults only.
- Scene Manager remains responsible for room inventory and narrative intent.
*/
class LayoutProfileLibrary {
  static FAMILIES = Object.freeze({
    NATURAL: "NATURAL",
    RESIDENTIAL: "RESIDENTIAL",
    COMMERCIAL: "COMMERCIAL",
    COVERT: "COVERT",
    FORTIFIED: "FORTIFIED",
    TECHNICAL: "TECHNICAL"
  });

  static DENSITIES = Object.freeze({ LOW: "LOW", MEDIUM: "MEDIUM", HIGH: "HIGH" });
  static SYMMETRIES = Object.freeze({ NONE: "NONE", LOW: "LOW", MEDIUM: "MEDIUM", HIGH: "HIGH" });
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
      displayName: "Mine",
      description: "A subterranean extraction and excavation site.",
      aliases: ["mine", "mineshaft", "mine shaft", "quarry"],
      classificationTags: ["NATURAL", "INDUSTRIAL", "UNDERGROUND"],
      grammar: "MINE",
      envelope: "CLUSTER",
      targetSectorCounts: {
        TINY: 3,
        SMALL: 5,
        MEDIUM: 8,
        LARGE: 12,
        HUGE: 16
      },
      family: "NATURAL",
      roomGap: 300,
      packingDensity: "LOW",
      corridorPattern: "BRANCHING",
      footprintShape: "IRREGULAR",
      secondaryNetworks: ["ESCAPE_ROUTE"],
      requiredPurposes: ["ENTRY", "WORK_AREA", "STORAGE"]
    }),
    CAVE: this._profile({
      family: "NATURAL",
      requiredSectors: [
        { purpose: "CAVERN_MOUTH", name: "Cave Entrance", graphRole: "ENTRY", sectorType: "ROOM", hierarchyLevel: 3 },
        { purpose: "MAIN_CHAMBER", name: "Central Cavern", graphRole: "HUB", sectorType: "ROOM", hierarchyLevel: 2 },
        { purpose: "DEEP_SANCTUM", name: "Inner Grotto", graphRole: "OBJECTIVE", sectorType: "ROOM", hierarchyLevel: 1 }
      ],
      optionalSectors: [
        { purpose: "SUBTERRANEAN_STREAM", name: "Underground Stream", sectorType: "ROOM", hierarchyLevel: 2 },
        { purpose: "FUNGAL_GROVE", name: "Glow-Cap Hollow", sectorType: "ROOM", hierarchyLevel: 2 },
        { purpose: "CHASM", name: "Fissure Overlook", sectorType: "ROOM", hierarchyLevel: 2 },
        { purpose: "NEST", name: "Beast Den", sectorType: "ROOM", hierarchyLevel: 2 }
      ],
      roomGap: 300,
      packingDensity: "LOW",
      corridorPattern: "BRANCHING",
      footprintShape: "IRREGULAR"
    }),
    HOUSE: this._profile({
      displayName: "House",
      description: "A small residential dwelling.",
      aliases: ["house", "home", "residence", "cottage"],
      classificationTags: ["RESIDENTIAL", "DOMESTIC"],
      grammar: "HOUSE",
      envelope: "PERIMETER",
      targetSectorCounts: {
        TINY: 3,
        SMALL: 4,
        MEDIUM: 5,
        LARGE: 7,
        HUGE: 10
      },
      family: "RESIDENTIAL",
      roomGap: 0,
      packingDensity: "HIGH",
      corridorPattern: "MINIMAL",
      footprintShape: "COMPACT",
      preferSharedWalls: true,
      requiredPurposes: ["ENTRY", "LIVING", "KITCHEN"]
    }),
    MANOR: this._profile({
      family: "RESIDENTIAL",
      requiredSectors: [
        { purpose: "FOYER", name: "Grand Foyer", graphRole: "ENTRY", sectorType: "ROOM", hierarchyLevel: 3 },
        { purpose: "GREAT_ROOM", name: "Great Living Room", graphRole: "HUB", sectorType: "ROOM", hierarchyLevel: 2 },
        { purpose: "MASTER_BEDROOM", name: "Master Suite", graphRole: "OBJECTIVE", sectorType: "ROOM", hierarchyLevel: 1 }
      ],
      optionalSectors: [
        { purpose: "LIBRARY", name: "Private Library", sectorType: "ROOM", hierarchyLevel: 2 },
        { purpose: "DINING", name: "Formal Dining Hall", sectorType: "ROOM", hierarchyLevel: 2 },
        { purpose: "KITCHEN", name: "Kitchen & Pantry", sectorType: "ROOM", hierarchyLevel: 2 },
        { purpose: "STUDY", name: "Private Study", sectorType: "ROOM", hierarchyLevel: 2 },
        { purpose: "SERVANTS_QUARTERS", name: "Servants' Quarters", sectorType: "ROOM", hierarchyLevel: 3 }
      ],
      roomGap: 0,
      packingDensity: "HIGH",
      corridorPattern: "PUBLIC_SPINE",
      footprintShape: "RECTANGULAR",
      floorRange: [1, 3],
      preferSharedWalls: true
    }),
    BAR: this._profile({
      displayName: "Bar",
      description: "A small public drinking establishment.",
      aliases: ["bar", "pub", "speakeasy", "taproom"],
      classificationTags: ["COMMERCIAL", "SOCIAL"],
      grammar: "COMMERCIAL_VENUE",
      envelope: "AXIAL",
      targetSectorCounts: {
        TINY: 3,
        SMALL: 5,
        MEDIUM: 6,
        LARGE: 8,
        HUGE: 12
      },
      family: "COMMERCIAL",
      roomGap: 0,
      packingDensity: "HIGH",
      corridorPattern: "PUBLIC_SPINE",
      footprintShape: "RECTANGULAR",
      preferSharedWalls: true,
      requiredPurposes: ["ENTRY", "TAPROOM", "BAR"]
    }),
    TAVERN: this._profile({
      displayName: "Tavern",
      description: "A social venue offering food, drink, and lodging.",
      aliases: ["tavern", "inn", "alehouse", "ale house"],
      classificationTags: ["COMMERCIAL", "HOSPITALITY"],
      grammar: "COMMERCIAL_VENUE",
      envelope: "AXIAL",
      targetSectorCounts: {
        TINY: 4,
        SMALL: 6,
        MEDIUM: 8,
        LARGE: 10,
        HUGE: 14
      },
      family: "COMMERCIAL",
      roomGap: 0,
      packingDensity: "HIGH",
      corridorPattern: "PUBLIC_SPINE",
      footprintShape: "RECTANGULAR",
      floorRange: [1, 2],
      preferSharedWalls: true
    }),
    CLUB: this._profile({
      displayName: "Club",
      description: "An entertainment and nightlife venue.",
      aliases: ["club", "nightclub", "night club", "dance club"],
      classificationTags: ["COMMERCIAL", "ENTERTAINMENT"],
      grammar: "COMMERCIAL_VENUE",
      envelope: "AXIAL",
      targetSectorCounts: {
        TINY: 4,
        SMALL: 6,
        MEDIUM: 8,
        LARGE: 12,
        HUGE: 16
      },
      family: "COMMERCIAL",
      roomGap: 0,
      packingDensity: "HIGH",
      corridorPattern: "PUBLIC_SPINE",
      footprintShape: "RECTANGULAR",
      secondaryNetworks: ["VENTILATION"]
    }),
    HIDEOUT: this._profile({
      displayName: "Hideout",
      description: "A concealed operational base for criminals or covert groups.",
      aliases: ["hideout", "lair", "den"],
      classificationTags: ["COVERT", "CRIMINAL", "HIDDEN"],
      grammar: "COVERT_SITE",
      envelope: "CLUSTER",
      targetSectorCounts: {
        TINY: 3,
        SMALL: 5,
        MEDIUM: 7,
        LARGE: 10,
        HUGE: 14
      },
      family: "COVERT",
      roomGap: 100,
      packingDensity: "MEDIUM",
      corridorPattern: "LAYERED",
      footprintShape: "COMPACT",
      chokePointPreference: true,
      secondaryNetworks: ["VENTILATION", "ESCAPE_ROUTE"]
    }),
    SAFEHOUSE: this._profile({
      displayName: "Safehouse",
      description: "A secure covert refuge used for protection and concealment.",
      aliases: ["safehouse", "safe house"],
      classificationTags: ["COVERT", "REFUGE", "SECURE"],
      grammar: "COVERT_SITE",
      envelope: "CLUSTER",
      targetSectorCounts: {
        TINY: 3,
        SMALL: 4,
        MEDIUM: 6,
        LARGE: 8,
        HUGE: 12
      },
      family: "COVERT",
      roomGap: 0,
      packingDensity: "HIGH",
      corridorPattern: "MINIMAL",
      footprintShape: "COMPACT",
      secondaryNetworks: ["ESCAPE_ROUTE"]
    }),
    SECRET_BASE: this._profile({
      displayName: "Secret Base",
      description: "A hidden operational headquarters.",
      aliases: ["secret base", "hidden base", "underground base", "bunker"],
      classificationTags: ["COVERT", "MILITARY", "TECHNICAL"],
      grammar: "COVERT_SITE",
      envelope: "LAYERED",
      targetSectorCounts: {
        TINY: 5,
        SMALL: 8,
        MEDIUM: 12,
        LARGE: 16,
        HUGE: 20
      },
      family: "COVERT",
      roomGap: 100,
      packingDensity: "MEDIUM",
      corridorPattern: "LAYERED",
      footprintShape: "MODULAR",
      secondaryNetworks: ["VENTILATION", "SERVICE_ACCESS", "ESCAPE_ROUTE"]
    }),
    FORT: this._profile({
      family: "FORTIFIED",
      requiredSectors: [
        { purpose: "GATE", name: "Main Gate", graphRole: "ENTRY", sectorType: "FORTIFICATION", hierarchyLevel: 3 },
        { purpose: "COURTYARD", name: "Parade Yard", graphRole: "HUB", sectorType: "OPEN_AREA", hierarchyLevel: 2 },
        { purpose: "COMMAND", name: "Command Post", graphRole: "OBJECTIVE", sectorType: "ROOM", hierarchyLevel: 1 }
      ],
      optionalSectors: [
        { purpose: "BARRACKS", name: "Barracks", sectorType: "ROOM", hierarchyLevel: 2 },
        { purpose: "ARMORY", name: "Armory", sectorType: "ROOM", hierarchyLevel: 2 },
        { purpose: "STORAGE", name: "Supply Store", sectorType: "ROOM", hierarchyLevel: 2 },
        { purpose: "WATCHTOWER", name: "Watchtower", sectorType: "TOWER", hierarchyLevel: 2 }
      ],
      roomGap: 0,
      packingDensity: "HIGH",
      corridorPattern: "DEFENSIVE_RING",
      footprintShape: "PERIMETER",
      defensivePerimeter: true,
      chokePointPreference: true
    }),
    OUTPOST: this._profile({
      displayName: "Outpost",
      description: "A remote fortified position used for observation and defense.",
      aliases: ["outpost", "watchpost", "watch post"],
      classificationTags: ["FORTIFIED", "MILITARY", "REMOTE"],
      grammar: "FORTIFIED_SITE",
      envelope: "PERIMETER",
      targetSectorCounts: {
        TINY: 3,
        SMALL: 5,
        MEDIUM: 7,
        LARGE: 10,
        HUGE: 14
      },
      family: "FORTIFIED",
      roomGap: 100,
      packingDensity: "MEDIUM",
      corridorPattern: "LAYERED",
      footprintShape: "COMPACT",
      defensivePerimeter: true
    }),
    CASTLE: this._profile({
      displayName: "Castle",
      description: "A fortified noble and military stronghold.",
      family: "FORTIFIED",
      aliases: ["castle", "keep", "stronghold"],
      classificationTags: ["FORTIFIED", "MILITARY", "NOBLE"],
      grammar: "FORTIFIED_SITE",
      envelope: "PERIMETER",
      targetSectorCounts: {
        TINY: 5,
        SMALL: 7,
        MEDIUM: 10,
        LARGE: 14,
        HUGE: 18
      },
      requiredSectors: [
        {
          purpose: "GATEHOUSE",
          name: "Gatehouse",
          graphRole: "ENTRY",
          sectorType: "FORTIFICATION",
          hierarchyLevel: 3
        },
        {
          purpose: "BAILEY",
          name: "Outer Bailey",
          graphRole: "HUB",
          sectorType: "OPEN_AREA",
          hierarchyLevel: 2
        },
        {
          purpose: "KEEP",
          name: "Inner Keep",
          graphRole: "OBJECTIVE",
          sectorType: "FORTIFICATION",
          hierarchyLevel: 1
        },
        {
          purpose: "GREAT_HALL",
          name: "Great Hall",
          graphRole: "HUB",
          sectorType: "ROOM",
          hierarchyLevel: 1
        }
      ],
      optionalSectors: [
        {
          purpose: "BARRACKS",
          name: "Barracks",
          sectorType: "ROOM",
          hierarchyLevel: 2
        },
        {
          purpose: "STABLE",
          name: "Stables",
          sectorType: "DETACHED_BUILDING",
          hierarchyLevel: 2
        },
        {
          purpose: "CHAPEL",
          name: "Chapel",
          sectorType: "ROOM",
          hierarchyLevel: 2
        }
      ],
      roomGap: 0,
      packingDensity: "HIGH",
      corridorPattern: "DEFENSIVE_RING",
      footprintShape: "COURTYARD",
      floorRange: [1, 4],
      courtyardAllowed: true,
      defensivePerimeter: true
    }),
    FORTRESS: this._profile({
      family: "FORTIFIED",
      requiredSectors: [
        { purpose: "OUTER_GATE", name: "Barbican & Outer Gate", graphRole: "ENTRY", sectorType: "FORTIFICATION", hierarchyLevel: 3 },
        { purpose: "CENTRAL_COURTYARD", name: "Central Courtyard", graphRole: "HUB", sectorType: "OPEN_AREA", hierarchyLevel: 2 },
        { purpose: "COMMAND_SANCTUM", name: "Command Sanctum", graphRole: "OBJECTIVE", sectorType: "FORTIFICATION", hierarchyLevel: 1 },
        { purpose: "INNER_KEEP", name: "Inner Citadel Keep", graphRole: "OBJECTIVE", sectorType: "FORTIFICATION", hierarchyLevel: 1 }
      ],
      optionalSectors: [
        { purpose: "ARMORY", name: "Grand Armory", sectorType: "ROOM", hierarchyLevel: 2 },
        { purpose: "BARRACKS", name: "Troop Barracks", sectorType: "ROOM", hierarchyLevel: 2 },
        { purpose: "SIEGE_DEPOT", name: "Siege Depot", sectorType: "ROOM", hierarchyLevel: 2 },
        { purpose: "PRISON", name: "Dungeon Cells", sectorType: "ROOM", hierarchyLevel: 2 },
        { purpose: "WAR_ROOM", name: "War Strategy Chamber", sectorType: "ROOM", hierarchyLevel: 1 }
      ],
      roomGap: 0,
      packingDensity: "HIGH",
      corridorPattern: "DEFENSIVE_RING",
      footprintShape: "PERIMETER",
      floorRange: [1, 5],
      defensivePerimeter: true,
      chokePointPreference: true
    }),
    FACILITY: this._profile({
      displayName: "Facility",
      description: "An industrial or research technical installation.",
      family: "TECHNICAL",
      aliases: ["facility", "research facility", "industrial complex", "installation"],
      classificationTags: ["TECHNICAL", "INDUSTRIAL", "RESEARCH"],
      grammar: "FACILITY",
      envelope: "MODULAR",
      targetSectorCounts: { TINY: 4, SMALL: 6, MEDIUM: 8, LARGE: 12, HUGE: 16 },
      requiredSectors: [
        {
          purpose: "RECEIVING",
          name: "Receiving Bay",
          graphRole: "ENTRY",
          sectorType: "ROOM",
          hierarchyLevel: 3
        },
        {
          purpose: "CENTRAL_CORRIDOR",
          name: "Central Spine",
          graphRole: "HUB",
          sectorType: "TRANSITION",
          hierarchyLevel: 2
        },
        {
          purpose: "CONTROL_ROOM",
          name: "Main Control Room",
          graphRole: "OBJECTIVE",
          sectorType: "ROOM",
          hierarchyLevel: 1
        }
      ],
      optionalSectors: [
        {
          purpose: "LABORATORY",
          name: "Research Lab",
          sectorType: "ROOM",
          hierarchyLevel: 2
        },
        {
          purpose: "POWER_PLANT",
          name: "Power Substation",
          sectorType: "ROOM",
          hierarchyLevel: 2
        },
        {
          purpose: "SECURITY",
          name: "Security Checkpoint",
          sectorType: "ROOM",
          hierarchyLevel: 3
        },
        {
          purpose: "STORAGE",
          name: "Hazmat Storage",
          sectorType: "ROOM",
          hierarchyLevel: 2
        }
      ],
      roomGap: 0,
      packingDensity: "HIGH",
      corridorPattern: "SERVICE_SPINE",
      footprintShape: "MODULAR",
      preferSharedWalls: true,
      secondaryNetworks: ["VENTILATION", "SERVICE_ACCESS"],
      requiredPurposes: ["ENTRY", "WORK_AREA", "STORAGE"],
      preferredPurposes: ["SECURITY", "UTILITY", "MAINTENANCE"]
    }),
    SPACESHIP: this._profile({
      displayName: "Spaceship",
      description: "A spacefaring vessel or transport.",
      family: "TECHNICAL",
      aliases: ["spaceship", "starship", "vessel", "ship"],
      classificationTags: ["SPACE", "VEHICLE", "TRANSPORT"],
      grammar: "SPACESHIP",
      envelope: "LINEAR",
      targetSectorCounts: { TINY: 3, SMALL: 5, MEDIUM: 8, LARGE: 10, HUGE: 14 },
      requiredSectors: [
        {
          purpose: "AIRLOCK",
          name: "Primary Airlock",
          graphRole: "ENTRY",
          sectorType: "ROOM",
          hierarchyLevel: 3
        },
        {
          purpose: "CENTRAL_PASSAGE",
          name: "Central Spine Corridor",
          graphRole: "HUB",
          sectorType: "TRANSITION",
          hierarchyLevel: 2
        },
        {
          purpose: "BRIDGE",
          name: "Command Bridge",
          graphRole: "OBJECTIVE",
          sectorType: "ROOM",
          hierarchyLevel: 1
        },
        {
          purpose: "ENGINEERING",
          name: "Engine Room",
          graphRole: "OBJECTIVE",
          sectorType: "ROOM",
          hierarchyLevel: 1
        }
      ],
      optionalSectors: [
        {
          purpose: "CARGO",
          name: "Cargo Bay",
          sectorType: "ROOM",
          hierarchyLevel: 2
        },
        {
          purpose: "CREW_QUARTERS",
          name: "Crew Bunks",
          sectorType: "ROOM",
          hierarchyLevel: 2
        },
        {
          purpose: "GALLEY",
          name: "Mess Hall",
          sectorType: "ROOM",
          hierarchyLevel: 2
        },
        {
          purpose: "MED_BAY",
          name: "Medical Bay",
          sectorType: "ROOM",
          hierarchyLevel: 2
        }
      ],
      roomGap: 0,
      packingDensity: "HIGH",
      corridorPattern: "DECK_SPINE",
      footprintShape: "LINEAR",
      preferSharedWalls: true,
      secondaryNetworks: ["VENTILATION", "SERVICE_ACCESS"]
    }),
    SPACE_STATION: this._profile({
      displayName: "Space Station",
      description: "An orbital or deep-space station habitat and hub.",
      family: "TECHNICAL",
      aliases: [
        "space station",
        "orbital station",
        "trade station"
      ],
      classificationTags: [
        "SPACE",
        "HABITATION",
        "COMMERCIAL"
      ],
      grammar: "SPACE_STATION",
      envelope: "CONCENTRIC",
      targetSectorCounts: { TINY: 5, SMALL: 8, MEDIUM: 12, LARGE: 16, HUGE: 20 },
      requiredSectors: [
        {
          purpose: "DOCKING_BAY",
          name: "Docking Ring",
          graphRole: "ENTRY",
          sectorType: "ROOM",
          hierarchyLevel: 3
        },
        {
          purpose: "PROMENADE",
          name: "Central Concourse",
          graphRole: "HUB",
          sectorType: "OPEN_AREA",
          hierarchyLevel: 2
        },
        {
          purpose: "STATION_CONTROL",
          name: "Operations Command",
          graphRole: "OBJECTIVE",
          sectorType: "ROOM",
          hierarchyLevel: 1
        }
      ],
      optionalSectors: [
        {
          purpose: "HABITATION",
          name: "Habitation Ring",
          sectorType: "ROOM",
          hierarchyLevel: 2
        },
        {
          purpose: "LIFE_SUPPORT",
          name: "Life Support Scrubber Unit",
          sectorType: "ROOM",
          hierarchyLevel: 1
        },
        {
          purpose: "CARGO_DECK",
          name: "Freight Bay",
          sectorType: "ROOM",
          hierarchyLevel: 2
        },
        {
          purpose: "HYDROPONICS",
          name: "Hydroponics Bay",
          sectorType: "ROOM",
          hierarchyLevel: 2
        }
      ],
      roomGap: 0,
      packingDensity: "HIGH",
      corridorPattern: "MODULAR_GRID",
      footprintShape: "MODULAR",
      floorRange: [1, 8],
      secondaryNetworks: [
        "VENTILATION",
        "SERVICE_ACCESS"
      ]
    }),
    SKYDOCK_HANGAR: this._profile({
      displayName: "Skydock Hangar",
      description: "A technical aviation facility for docking and maintenance.",
      aliases: ["skydock", "hangar", "airship dock", "aviation facility"],
      classificationTags: ["TECHNICAL", "AVIATION", "TRANSPORT"],
      grammar: "FACILITY",
      envelope: "MODULAR",
      targetSectorCounts: {
        TINY: 4,
        SMALL: 6,
        MEDIUM: 8,
        LARGE: 12,
        HUGE: 16
      },
      family: "TECHNICAL",
      roomGap: 0,
      packingDensity: "HIGH",
      corridorPattern: "SERVICE_SPINE",
      footprintShape: "MODULAR",
      preferSharedWalls: true,
      secondaryNetworks: ["VENTILATION", "SERVICE_ACCESS"],
      requiredPurposes: ["ENTRY", "HANGAR", "WAREHOUSE", "SKYDOCK"],
      preferredPurposes: ["SECURITY", "OFFICE", "MAINTENANCE", "VENTILATION_CONTROL"]
    })
  });

  static get(profileId) {
    return this.PROFILES[this.normalizeProfileId(profileId)] || null;
  }

  static has(profileId) {
    return Boolean(this.get(profileId));
  }

  static list(family = null) {
    const normalizedFamily = family ? this.normalizeFamily(family) : null;
    return Object.values(this.PROFILES).filter(profile =>
      !normalizedFamily || profile.family === normalizedFamily
    );
  }

  static listFamilies() {
    return Object.values(this.FAMILIES);
  }

  static getByFamily(family) {
    return this.list(family);
  }

  static getAliases(profileId) {
    return this.get(profileId)?.aliases || [];
  }

  static getClassificationTags(profileId) {
    return this.get(profileId)?.classificationTags || [];
  }

  static getGrammar(profileId) {
    return this.get(profileId)?.grammar || null;
  }

  static getEnvelope(profileId) {
    return this.get(profileId)?.envelope || null;
  }

  static resolve(profileId, fallback = this.DEFAULT_PROFILE) {
    return this.get(profileId) || this.get(fallback) || this.get(this.DEFAULT_PROFILE);
  }

  static supportsSecondaryNetwork(profileId, networkType) {
    const profile = this.get(profileId);
    const network = String(networkType || "").trim().toUpperCase();
    return Boolean(profile?.secondaryNetworks?.includes(network));
  }

  static toLayoutConfig(profileId, overrides = {}) {
    const profile = this.resolve(profileId);
    return {
      ...structuredClone(profile),
      profileId: profile.id,
      layoutFamily: profile.family,
      ...structuredClone(overrides || {})
    };
  }

  static validate() {
    const problems = [];
    for (const [id, profile] of Object.entries(this.PROFILES)) {
      if (profile.id !== id) problems.push(`${id} has incorrect id.`);
      if (!Object.values(this.FAMILIES).includes(profile.family)) problems.push(`${id} has invalid family.`);
      if (!Array.isArray(profile.secondaryNetworks)) problems.push(`${id} secondaryNetworks must be an array.`);
      if (!Array.isArray(profile.floorRange) || profile.floorRange.length !== 2) problems.push(`${id} floorRange is invalid.`);
      if (!Array.isArray(profile.aliases)) {
        problems.push(`${id} aliases must be an array.`);
      }
      if (!Array.isArray(profile.classificationTags)) {
        problems.push(`${id} classificationTags must be an array.`);
      }
      if (!Array.isArray(profile.requiredSectors)) {
        problems.push(`${id} requiredSectors must be an array.`);
      }
      if (!Array.isArray(profile.optionalSectors)) {
        problems.push(`${id} optionalSectors must be an array.`);
      }
      if (Array.isArray(profile.requiredSectors)) {
        for (const sector of profile.requiredSectors) {
          if (
            sector &&
            typeof sector === "object"
          ) {
            if (!sector.purpose) {
              problems.push(
                `${id} required sector missing purpose.`
              );
            }

            if (!sector.name) {
              problems.push(
                `${id} required sector ${sector.purpose || "UNKNOWN"} missing name.`
              );
            }

            if (!sector.sectorType) {
              problems.push(
                `${id} required sector ${sector.purpose || "UNKNOWN"} missing sectorType.`
              );
            }
          }
        }
      }

      if (Array.isArray(profile.optionalSectors)) {
        for (const sector of profile.optionalSectors) {
          if (
            sector &&
            typeof sector === "object"
          ) {
            if (!sector.purpose) {
              problems.push(
                `${id} optional sector missing purpose.`
              );
            }

            if (!sector.name) {
              problems.push(
                `${id} optional sector ${sector.purpose || "UNKNOWN"} missing name.`
              );
            }

            if (!sector.sectorType) {
              problems.push(
                `${id} optional sector ${sector.purpose || "UNKNOWN"} missing sectorType.`
              );
            }
          }
        }
      }

      if (
        profile.targetSectorCounts &&
        typeof profile.targetSectorCounts !== "object"
      ) {
        problems.push(`${id} targetSectorCounts must be an object.`);
      }
    }
    return { valid: problems.length === 0, problems, profileCount: Object.keys(this.PROFILES).length };
  }

  static normalizeProfileId(value) {
    return String(value || "").trim().toUpperCase().replace(/[\s-]+/g, "_");
  }

  static normalizeFamily(value) {
    return String(value || "").trim().toUpperCase().replace(/[\s-]+/g, "_");
  }

  static _profile(options = {}) {
    return {
      id: "UNASSIGNED",

      // ==================================================
      // PROFILE_SCHEMA_V2
      // ==================================================

      displayName: options.displayName || "",

      description: options.description || "",

      aliases: structuredClone(
        options.aliases || []
      ),

      classificationTags: structuredClone(
        options.classificationTags || []
      ),

      grammar: options.grammar || null,

      envelope: options.envelope || null,

      targetSectorCounts: structuredClone(
        options.targetSectorCounts || {}
      ),

      requiredSectors: structuredClone(
        options.requiredSectors || []
      ),

      optionalSectors: structuredClone(
        options.optionalSectors || []
      ),

      // ==================================================
      // EXISTING PROFILE FIELDS
      // ==================================================

      family: this.normalizeFamily(
        options.family || "TECHNICAL"
      ),

      roomGap: Math.max(
        0,
        Number(options.roomGap) || 0
      ),

      packingDensity: String(
        options.packingDensity || "MEDIUM"
      ).toUpperCase(),

      sharedWallPreference:
        options.sharedWallPreference ??
        options.preferSharedWalls ??
        false,

      corridorPattern: String(
        options.corridorPattern || "MINIMAL"
      ).toUpperCase(),

      footprintShape: String(
        options.footprintShape || "RECTANGULAR"
      ).toUpperCase(),

      symmetry: String(
        options.symmetry || "NONE"
      ).toUpperCase(),

      entranceCount: Math.max(
        1,
        Number(options.entranceCount) || 1
      ),

      emergencyExitCount: Math.max(
        0,
        Number(options.emergencyExitCount) || 0
      ),

      floorRange: structuredClone(
        options.floorRange || [1, 1]
      ),

      stairWidth: Math.max(
        1,
        Number(options.stairWidth) || 4
      ),

      stairHeight: Math.max(
        1,
        Number(options.stairHeight) || 5
      ),

      hallwayWeight: Math.max(
        0,
        Number(options.hallwayWeight) || 50
      ),

      directDoorLimit: Math.max(
        1,
        Number(options.directDoorLimit) || 3
      ),

      layoutGrammar:
        options.layoutGrammar || null,

      sizeVariation: Math.max(
        0,
        Number(options.sizeVariation) || 0
      ),

      purposeDimensions: structuredClone(
        options.purposeDimensions || {}
      ),

      courtyardAllowed:
        options.courtyardAllowed === true,

      defensivePerimeter:
        options.defensivePerimeter === true,

      chokePointPreference:
        options.chokePointPreference === true,

      connectionPolicy: String(
        options.connectionPolicy ||
        "PRESERVE_GRAPH"
      ).toUpperCase(),

      maximumRoomDegree: Math.max(
        1,
        Number(options.maximumRoomDegree) || 4
      ),

      preferSharedWalls:
        options.preferSharedWalls === true,

      allowCrossMapRoutes:
        options.allowCrossMapRoutes !== false,

      towerShape:
        options.towerShape || "TOWER_SQUARE",

      secondaryNetworks: structuredClone(
        options.secondaryNetworks || []
      ),

      requiredPurposes: structuredClone(
        options.requiredPurposes || []
      ),

      preferredPurposes: structuredClone(
        options.preferredPurposes || []
      )
    };
  }
}

for (const [id, profile] of Object.entries(LayoutProfileLibrary.PROFILES)) {
  profile.id = id;
  Object.freeze(profile.aliases);

  Object.freeze(profile.classificationTags);

  Object.freeze(profile.requiredSectors);

  Object.freeze(profile.optionalSectors);

  Object.freeze(profile.targetSectorCounts);

  Object.freeze(profile.secondaryNetworks);

  Object.freeze(profile.requiredPurposes);

  Object.freeze(profile.preferredPurposes);

  Object.freeze(profile.floorRange);
  Object.freeze(profile);
}

export { LayoutProfileLibrary };