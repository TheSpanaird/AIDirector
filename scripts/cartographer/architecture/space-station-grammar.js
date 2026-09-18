import { ProgrammaticBuildingGrammar } from "./programmatic-building-grammar.js";

export class SpaceStationGrammar {
  static GRAMMAR_ID = "SPACE_STATION_CREATIVE_MULTI_LEVEL_V3";
  static FAMILIES = ["RADIAL_HUB", "FOUR_POD_CROSS", "RING_SPOKES"];
  static STATION_TYPES = ["CIVILIAN", "MINING", "MILITARY", "MANUFACTURING"];

  static build(roomProgram = {}, options = {}) {
    const gridSize = Math.max(1, Number(options.gridSize) || 100);
    const totalLevels = Math.min(4, Math.max(1, Number(
      options.totalLevels || roomProgram.totalLevels || 1
    )));
    const floor = Math.min(totalLevels, Math.max(1, Number(options.floor || 1)));
    const seed = String(
      options.layoutSeed || roomProgram.layoutSeed || "space-station-001"
    );
    const stationType = this._stationType(
      options.stationType || roomProgram.stationType
    );
    const family = this._family(
      options.layoutFamily || roomProgram.layoutFamily,
      seed
    );

    const floorProgram = this._floorProgram(stationType, floor, totalLevels);
    const template = this._template(family, floorProgram.rooms.length);
    const definitions = [
      [
        "docking",
        floor === 1 ? "Docking Module" : "Transfer Airlock",
        "AIRLOCK",
        floor === 1 ? "ENTRY" : "OPTIONAL"
      ],
      ["central-hub", template.hubName, "CENTRAL_PASSAGE", "HUB"],
      ["lift", "Core Lift", "VERTICAL_ACCESS", "CONNECTOR"],
      ...(template.fixedDefinitions || []),
      ...floorProgram.rooms.slice(0, template.roomSlots.length).map(
        (room, index) => [template.roomSlots[index], ...room]
      )
    ];

    const activeIds = new Set(definitions.map(definition => definition[0]));
    const cells = Object.fromEntries(
      Object.entries(template.cells).filter(([id]) => activeIds.has(id))
    );
    const pairs = template.pairs.filter(
      ([from, to]) => activeIds.has(from) && activeIds.has(to)
    );

    const result = ProgrammaticBuildingGrammar.build(
      {
        grammarId: this.GRAMMAR_ID,
        profileId: `SPACE_STATION_${stationType}`,
        width: template.width,
        height: template.height,
        variants: [
          `${family}_F${floor}_STANDARD`,
          `${family}_F${floor}_MIRRORED`
        ],
        entryId: floor === 1 ? "docking" : null,
        entryFace: template.entryFace,
        zoneOrder: floorProgram.zoneOrder,
        definitions,
        cells,
        pairs
      },
      roomProgram,
      {
        ...options,
        floor,
        gridSize,
        structureType: "SPACE_STATION",
        layoutSeed: `${seed}-${family}-floor-${floor}`
      }
    );

    result.stationType = stationType;
    result.layoutFamily = family;
    result.configurationId = `${family}_${stationType}_F${floor}`;
    result.floorRole = floorProgram.role;
    result.totalLevels = totalLevels;
    result.allowedLevelRange = { min: 1, max: 4 };
    result.verticalConnector = {
      connectionId: "station-core-lift",
      connectionType: "ELEVATOR",
      sectorId: "lift",
      floor,
      anchorId: "station-core-lift-anchor"
    };
    result.emergencyConnector = {
      connectionId: "station-emergency-access",
      connectionType: "LADDER",
      sectorId: "docking",
      floor,
      anchorId: "station-emergency-access-anchor"
    };

    const ventilatedRooms = result.sectors
      .filter(room => !["docking", "central-hub", "lift"].includes(room.sectorId))
      .map(room => room.sectorId);

    result.ventilation = {
      enabled: true,
      networkType: "SERVICE_DUCT",
      visibility: "HIDDEN",
      elevationBottom: 10,
      elevationTop: 15,
      connections: ventilatedRooms.map(to => ({
        from: "central-hub",
        to,
        accessType: "VENT_GRATE",
        size: "SMALL"
      }))
    };

    result.shapeSummary = result.sectors.reduce((summary, room) => {
      const shape = room.shapeType || "RECTANGLE";
      summary[shape] = (summary[shape] || 0) + 1;
      return summary;
    }, {});

    return result;
  }

  static _stationType(value) {
    const normalized = String(value || "CIVILIAN").toUpperCase();
    return this.STATION_TYPES.includes(normalized) ? normalized : "CIVILIAN";
  }

  static _family(value, seed) {
    const requested = String(value || "").toUpperCase();
    if (this.FAMILIES.includes(requested)) return requested;
    return this.FAMILIES[this._hash(seed) % this.FAMILIES.length];
  }

  static _floorProgram(stationType, floor, totalLevels) {
    const programs = {
      CIVILIAN: [
        {
          role: "ARRIVAL_AND_COMMERCE",
          zoneOrder: ["DOCKING", "HUB", "COMMERCE", "SERVICE"],
          rooms: [
            ["Promenade", "SHOP", "HUB"],
            ["Market Hall", "SHOP", "OBJECTIVE"],
            ["Restaurant", "DINING", "OPTIONAL"],
            ["Observation Bar", "BAR", "OPTIONAL"],
            ["Station Security", "SECURITY", "OBJECTIVE"],
            ["Medical Clinic", "MEDICAL", "OPTIONAL"],
            ["Customs Office", "CUSTOMS", "OPTIONAL"]
          ]
        },
        {
          role: "HABITATION",
          zoneOrder: ["HUB", "HABITATION", "RECREATION", "SERVICE"],
          rooms: [
            ["Residential Ring", "CREW_QUARTERS", "HUB"],
            ["Family Apartments", "CREW_QUARTERS", "OPTIONAL"],
            ["Communal Lounge", "RECREATION", "OPTIONAL"],
            ["Hydroponic Garden", "HYDROPONICS", "OBJECTIVE"],
            ["School and Nursery", "EDUCATION", "OPTIONAL"],
            ["Laundry and Utility", "UTILITY", "OPTIONAL"],
            ["Observation Gallery", "OBSERVATION", "OPTIONAL"]
          ]
        },
        {
          role: "CIVIC_AND_LEISURE",
          zoneOrder: ["HUB", "CIVIC", "LEISURE", "SERVICE"],
          rooms: [
            ["Civic Forum", "CIVIC", "HUB"],
            ["Administration", "OFFICE", "OBJECTIVE"],
            ["Theater", "ENTERTAINMENT", "OPTIONAL"],
            ["Fitness Center", "RECREATION", "OPTIONAL"],
            ["Library", "EDUCATION", "OPTIONAL"],
            ["Temple or Reflection Room", "CULTURAL", "OPTIONAL"],
            ["Life Support", "UTILITY", "OBJECTIVE"]
          ]
        },
        {
          role: "OBSERVATION_AND_SUPPORT",
          zoneOrder: ["HUB", "OBSERVATION", "SUPPORT", "UTILITY"],
          rooms: [
            ["Observation Deck", "OBSERVATION", "HUB"],
            ["Executive Suites", "CREW_QUARTERS", "OPTIONAL"],
            ["Private Dining", "DINING", "OPTIONAL"],
            ["Communications", "COMMUNICATIONS", "OBJECTIVE"],
            ["Emergency Shelter", "SHELTER", "OBJECTIVE"],
            ["Life Support", "UTILITY", "OPTIONAL"],
            ["Maintenance Access", "WORKSHOP", "OPTIONAL"]
          ]
        }
      ],
      MINING: [
        {
          role: "EXTRACTION_AND_DOCKING",
          zoneOrder: ["DOCKING", "HUB", "INDUSTRIAL", "STORAGE"],
          rooms: [
            ["Mining Control", "COMMAND", "HUB"],
            ["Ore Crusher", "INDUSTRIAL", "OBJECTIVE"],
            ["Refinery", "INDUSTRIAL", "OBJECTIVE"],
            ["Ore Storage", "STORAGE", "OPTIONAL"],
            ["Equipment Bay", "WORKSHOP", "OPTIONAL"],
            ["Hazard Decontamination", "DECONTAMINATION", "OBJECTIVE"],
            ["Cargo Dispatch", "CARGO", "OPTIONAL"]
          ]
        },
        {
          role: "CREW_AND_MAINTENANCE",
          zoneOrder: ["HUB", "CREW", "MAINTENANCE", "SERVICE"],
          rooms: [
            ["Miner Quarters", "CREW_QUARTERS", "HUB"],
            ["Mess Hall", "DINING", "OPTIONAL"],
            ["Maintenance Bay", "WORKSHOP", "OBJECTIVE"],
            ["Suit Storage", "EQUIPMENT", "OPTIONAL"],
            ["Medical Clinic", "MEDICAL", "OPTIONAL"],
            ["Recreation Room", "RECREATION", "OPTIONAL"],
            ["Life Support", "UTILITY", "OBJECTIVE"]
          ]
        },
        {
          role: "SURVEY_AND_ANALYSIS",
          zoneOrder: ["HUB", "SCIENCE", "CONTROL", "ARCHIVE"],
          rooms: [
            ["Survey Operations", "COMMAND", "HUB"],
            ["Geology Laboratory", "LABORATORY", "OBJECTIVE"],
            ["Core Sample Archive", "STORAGE", "OPTIONAL"],
            ["Drone Control", "CONTROL", "OBJECTIVE"],
            ["Sensor Array Access", "SENSORS", "OPTIONAL"],
            ["Data Center", "COMPUTER", "OPTIONAL"],
            ["Emergency Shelter", "SHELTER", "OBJECTIVE"]
          ]
        },
        {
          role: "POWER_AND_EXPORT",
          zoneOrder: ["HUB", "POWER", "CARGO", "UTILITY"],
          rooms: [
            ["Power Control", "ENGINEERING", "HUB"],
            ["Reactor Access", "POWER", "OBJECTIVE"],
            ["Export Warehouse", "CARGO", "OPTIONAL"],
            ["Loading Control", "CONTROL", "OPTIONAL"],
            ["Coolant Plant", "UTILITY", "OBJECTIVE"],
            ["Emergency Batteries", "POWER", "OPTIONAL"],
            ["Repair Workshop", "WORKSHOP", "OPTIONAL"]
          ]
        }
      ],
      MILITARY: [
        {
          role: "COMMAND_AND_DEFENSE",
          zoneOrder: ["DOCKING", "SECURITY", "COMMAND", "DEFENSE"],
          rooms: [
            ["Security Checkpoint", "SECURITY", "HUB"],
            ["Command Center", "COMMAND", "OBJECTIVE"],
            ["Briefing Chamber", "BRIEFING", "OPTIONAL"],
            ["Armory", "ARMORY", "OBJECTIVE"],
            ["Fighter Control", "TACTICAL", "OBJECTIVE"],
            ["Brig", "DETENTION", "OPTIONAL"],
            ["Communications", "COMMUNICATIONS", "OPTIONAL"]
          ]
        },
        {
          role: "BARRACKS_AND_READINESS",
          zoneOrder: ["HUB", "CREW", "TRAINING", "SUPPORT"],
          rooms: [
            ["Barracks", "BARRACKS", "HUB"],
            ["Ready Room", "BRIEFING", "OBJECTIVE"],
            ["Training Hall", "TRAINING", "OPTIONAL"],
            ["Mess Hall", "DINING", "OPTIONAL"],
            ["Medical Bay", "MEDICAL", "OBJECTIVE"],
            ["Equipment Issue", "ARMORY", "OPTIONAL"],
            ["Officer Quarters", "CREW_QUARTERS", "OPTIONAL"]
          ]
        },
        {
          role: "OPERATIONS_AND_INTELLIGENCE",
          zoneOrder: ["HUB", "OPERATIONS", "INTELLIGENCE", "SECURITY"],
          rooms: [
            ["Fleet Operations", "COMMAND", "HUB"],
            ["Intelligence Center", "INTELLIGENCE", "OBJECTIVE"],
            ["War Room", "TACTICAL", "OBJECTIVE"],
            ["Sensor Control", "SENSORS", "OPTIONAL"],
            ["Secure Archive", "STORAGE", "OPTIONAL"],
            ["Cyber Operations", "COMPUTER", "OBJECTIVE"],
            ["Emergency Command", "COMMAND", "OPTIONAL"]
          ]
        },
        {
          role: "ENGINEERING_AND_HANGAR_SUPPORT",
          zoneOrder: ["HUB", "ENGINEERING", "HANGAR", "SUPPORT"],
          rooms: [
            ["Engineering Control", "ENGINEERING", "HUB"],
            ["Hangar Support", "HANGAR", "OBJECTIVE"],
            ["Munitions Storage", "ARMORY", "OBJECTIVE"],
            ["Repair Bay", "WORKSHOP", "OPTIONAL"],
            ["Fuel Control", "UTILITY", "OPTIONAL"],
            ["Damage Control", "SECURITY", "OBJECTIVE"],
            ["Escape Pod Control", "EVACUATION", "OPTIONAL"]
          ]
        }
      ],
      MANUFACTURING: [
        {
          role: "ASSEMBLY_AND_LAUNCH",
          zoneOrder: ["DOCKING", "HUB", "ASSEMBLY", "HANGAR"],
          rooms: [
            ["Design Control", "COMMAND", "HUB"],
            ["Assembly Hall", "MANUFACTURING", "OBJECTIVE"],
            ["Fabrication Bay", "WORKSHOP", "OBJECTIVE"],
            ["Parts Storage", "STORAGE", "OPTIONAL"],
            ["Quality Control", "LABORATORY", "OBJECTIVE"],
            ["Launch Bay", "HANGAR", "OBJECTIVE"],
            ["Cargo Dispatch", "CARGO", "OPTIONAL"]
          ]
        },
        {
          role: "DESIGN_AND_PROTOTYPING",
          zoneOrder: ["HUB", "DESIGN", "SCIENCE", "STORAGE"],
          rooms: [
            ["Production Control", "COMMAND", "HUB"],
            ["Design Studio", "ENGINEERING", "OBJECTIVE"],
            ["Prototype Lab", "LABORATORY", "OBJECTIVE"],
            ["Component Storage", "STORAGE", "OPTIONAL"],
            ["Simulation Room", "COMPUTER", "OPTIONAL"],
            ["Materials Lab", "LABORATORY", "OPTIONAL"],
            ["Secure Project Room", "SECURITY", "OBJECTIVE"]
          ]
        },
        {
          role: "SYSTEMS_INTEGRATION",
          zoneOrder: ["HUB", "INTEGRATION", "TESTING", "SUPPORT"],
          rooms: [
            ["Integration Control", "COMMAND", "HUB"],
            ["Avionics Bay", "ENGINEERING", "OBJECTIVE"],
            ["Engine Test Cell", "TESTING", "OBJECTIVE"],
            ["Systems Workshop", "WORKSHOP", "OPTIONAL"],
            ["Inspection Lab", "LABORATORY", "OBJECTIVE"],
            ["Tool Storage", "STORAGE", "OPTIONAL"],
            ["Safety Control", "SECURITY", "OPTIONAL"]
          ]
        },
        {
          role: "LOGISTICS_AND_WORKFORCE",
          zoneOrder: ["HUB", "LOGISTICS", "CREW", "UTILITY"],
          rooms: [
            ["Logistics Control", "CARGO", "HUB"],
            ["Worker Quarters", "CREW_QUARTERS", "OPTIONAL"],
            ["Mess Hall", "DINING", "OPTIONAL"],
            ["Finished Goods Storage", "STORAGE", "OBJECTIVE"],
            ["Shipping Office", "OFFICE", "OPTIONAL"],
            ["Life Support", "UTILITY", "OBJECTIVE"],
            ["Emergency Shelter", "SHELTER", "OPTIONAL"]
          ]
        }
      ]
    };

    const stationPrograms = programs[stationType] || programs.CIVILIAN;
    const programIndex = Math.min(floor - 1, stationPrograms.length - 1);
    const selected = structuredClone(stationPrograms[programIndex]);

    if (totalLevels === 1 && floor === 1) {
      selected.role = `${selected.role}_SINGLE_LEVEL`;
    }

    return selected;
  }

  static _template(family, requestedRooms) {
    const templates = {
      RADIAL_HUB: {
        hubName: "Radial Central Hub",
        width: 24,
        height: 18,
        entryFace: "WEST",
        roomSlots: ["a", "b", "c", "d", "e", "f", "g"],
        cells: {
          docking: { col: 0, row: 7, w: 4, h: 4, zone: "DOCKING", shapeType: "OCTAGON" },
          "central-hub": { col: 4, row: 5, w: 8, h: 8, zone: "HUB", shapeType: "PLUS" },
          a: { col: 4, row: 0, w: 4, h: 5, zone: "MISSION", shapeType: "OCTAGON" },
          b: { col: 8, row: 0, w: 4, h: 5, zone: "MISSION" },
          c: { col: 12, row: 0, w: 6, h: 5, zone: "MISSION", shapeType: "CIRCLE" },
          d: { col: 12, row: 5, w: 6, h: 4, zone: "SUPPORT" },
          e: { col: 18, row: 5, w: 6, h: 4, zone: "SUPPORT", shapeType: "OCTAGON" },
          f: { col: 12, row: 9, w: 6, h: 4, zone: "SUPPORT", shapeType: "CIRCLE" },
          g: { col: 18, row: 9, w: 6, h: 4, zone: "SUPPORT" },
          lift: { col: 4, row: 13, w: 8, h: 5, zone: "VERTICAL_ACCESS", shapeType: "CIRCLE" }
        },
        pairs: [
          ["docking", "central-hub"], ["central-hub", "a"], ["a", "b"],
          ["b", "c"], ["central-hub", "d"], ["d", "e"],
          ["central-hub", "f"], ["f", "g"], ["central-hub", "lift"]
        ]
      },
      FOUR_POD_CROSS: {
        hubName: "Rotunda Core",
        width: 24,
        height: 22,
        entryFace: "SOUTH",
        roomSlots: ["a", "b", "c", "d"],
        fixedDefinitions: [
          ["west-corridor", "West Access Corridor", "CORRIDOR", "CONNECTOR"],
          ["east-corridor", "East Access Corridor", "CORRIDOR", "CONNECTOR"],
          ["north-corridor", "North Access Corridor", "CORRIDOR", "CONNECTOR"]
        ],
        cells: {
          "central-hub": { col: 8, row: 7, w: 8, h: 8, zone: "HUB", shapeType: "PLUS" },
          "west-corridor": { col: 6, row: 9, w: 2, h: 4, zone: "CONNECTOR" },
          "east-corridor": { col: 16, row: 9, w: 2, h: 4, zone: "CONNECTOR" },
          "north-corridor": { col: 10, row: 5, w: 4, h: 2, zone: "CONNECTOR" },
          lift: { col: 10, row: 15, w: 4, h: 2, zone: "VERTICAL_ACCESS", shapeType: "PLUS" },
          a: { col: 0, row: 7, w: 6, h: 8, zone: "WEST_POD", shapeType: "OCTAGON" },
          b: { col: 18, row: 7, w: 6, h: 8, zone: "EAST_POD", shapeType: "OCTAGON" },
          c: { col: 8, row: 0, w: 8, h: 5, zone: "NORTH_POD", shapeType: "OCTAGON" },
          d: { col: 8, row: 17, w: 8, h: 5, zone: "SOUTH_POD", shapeType: "OCTAGON" },
          docking: { col: 16, row: 18, w: 4, h: 4, zone: "DOCKING", shapeType: "OCTAGON" }
        },
        pairs: [
          ["central-hub", "west-corridor"], ["west-corridor", "a"],
          ["central-hub", "east-corridor"], ["east-corridor", "b"],
          ["central-hub", "north-corridor"], ["north-corridor", "c"],
          ["central-hub", "lift"], ["lift", "d"], ["d", "docking"]
        ]
      },
      RING_SPOKES: {
        hubName: "Spoke Junction",
        width: 28,
        height: 22,
        entryFace: "WEST",
        roomSlots: ["a", "b", "c", "d", "e", "f"],
        fixedDefinitions: [
          ["west-spoke", "West Spoke", "CORRIDOR", "CONNECTOR"],
          ["east-spoke", "East Spoke", "CORRIDOR", "CONNECTOR"],
          ["north-spoke", "North Spoke", "CORRIDOR", "CONNECTOR"]
        ],
        cells: {
          docking: { col: 0, row: 9, w: 4, h: 4, zone: "DOCKING", shapeType: "OCTAGON" },
          a: { col: 4, row: 8, w: 5, h: 6, zone: "WEST_RING", shapeType: "OCTAGON" },
          "west-spoke": { col: 9, row: 10, w: 3, h: 2, zone: "CONNECTOR" },
          "central-hub": { col: 12, row: 7, w: 6, h: 8, zone: "HUB", shapeType: "PLUS" },
          "east-spoke": { col: 18, row: 10, w: 3, h: 2, zone: "CONNECTOR" },
          b: { col: 21, row: 8, w: 7, h: 6, zone: "EAST_RING" },
          c: { col: 21, row: 3, w: 7, h: 5, zone: "NORTHEAST_RING", shapeType: "OCTAGON" },
          d: { col: 21, row: 14, w: 7, h: 5, zone: "SOUTHEAST_RING", shapeType: "OCTAGON" },
          "north-spoke": { col: 13, row: 4, w: 4, h: 3, zone: "CONNECTOR" },
          e: { col: 11, row: 0, w: 8, h: 4, zone: "NORTH_RING", shapeType: "OCTAGON" },
          lift: { col: 13, row: 15, w: 4, h: 3, zone: "VERTICAL_ACCESS", shapeType: "PLUS" },
          f: { col: 11, row: 18, w: 8, h: 4, zone: "SOUTH_RING", shapeType: "CIRCLE" }
        },
        pairs: [
          ["docking", "a"], ["a", "west-spoke"], ["west-spoke", "central-hub"],
          ["central-hub", "east-spoke"], ["east-spoke", "b"],
          ["b", "c"], ["b", "d"],
          ["central-hub", "north-spoke"], ["north-spoke", "e"],
          ["central-hub", "lift"], ["lift", "f"]
        ]
      }

    };

    const selected = structuredClone(templates[family] || templates.RADIAL_HUB);
    selected.roomSlots = selected.roomSlots.slice(0, requestedRooms);

    if (["FOUR_POD_CROSS", "RING_SPOKES"].includes(family)) {
      const scale = 1.25;
      const scaleBoundary = value => Math.round(Number(value) * scale);

      selected.width = scaleBoundary(selected.width);
      selected.height = scaleBoundary(selected.height);
      selected.cells = Object.fromEntries(
        Object.entries(selected.cells).map(([id, cell]) => {
          const left = scaleBoundary(cell.col);
          const top = scaleBoundary(cell.row);
          const right = scaleBoundary(cell.col + cell.w);
          const bottom = scaleBoundary(cell.row + cell.h);

          return [
            id,
            {
              ...cell,
              col: left,
              row: top,
              w: Math.max(1, right - left),
              h: Math.max(1, bottom - top)
            }
          ];
        })
      );
      selected.scale = scale;
    }

    return selected;
  }

  static _hash(value) {
    let hash = 2166136261;
    for (const character of String(value)) {
      hash ^= character.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }
}
