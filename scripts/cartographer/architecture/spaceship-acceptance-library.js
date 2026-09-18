// spaceship-acceptance-library.js
// Grammar-specific acceptance rules for spaceship subtypes.

export class SpaceshipAcceptanceLibrary {
  static RULES = Object.freeze({
    SHUTTLE: this._rules({
      scale: "SMALL",
      requiredPurposes: [
        "AIRLOCK",
        "COCKPIT",
        "CABIN",
        "ENGINEERING"
      ],
      forbiddenPurposes: [
        "HANGAR",
        "MAGAZINE",
        "BRIG"
      ],
      requiredAdjacencies: [
        ["COCKPIT", "CABIN"],
        ["CABIN", "AIRLOCK"],
        ["CABIN", "ENGINEERING"]
      ],
      terminalPurposes: [
        "COCKPIT",
        "ENGINEERING"
      ],
      dominantPurposes: ["CABIN"],
      circulation: {
        maxHubs: 1,
        maxDepth: 3,
        maxAreaRatio: 0.16
      },
      zones: [
        "COMMAND",
        "HABITATION",
        "ENGINEERING"
      ],
      notes:
        "Compact end-to-end craft. Cockpit and engineering occupy opposite functional ends."
    }),

    FREIGHTER: this._rules({
      scale: "MEDIUM",
      requiredPurposes: [
        "AIRLOCK",
        "BRIDGE",
        "CARGO",
        "ENGINEERING",
        "CREW_QUARTERS"
      ],
      forbiddenPurposes: [
        "MAGAZINE",
        "WEAPONS_CONTROL"
      ],
      requiredAdjacencies: [
        ["AIRLOCK", "CARGO"],
        ["CARGO", "ENGINEERING"],
        ["CREW_QUARTERS", "CENTRAL_PASSAGE"],
        ["GALLEY", "CENTRAL_PASSAGE"],
        ["BRIDGE", "CENTRAL_PASSAGE"],
        ["ENGINEERING", "UTILITY"]
      ],
      terminalPurposes: [
        "BRIDGE",
        "ENGINEERING"
      ],
      dominantPurposes: ["CARGO"],
      circulation: {
        maxHubs: 2,
        maxDepth: 5,
        maxAreaRatio: 0.18
      },
      zones: [
        "COMMAND",
        "MISSION",
        "HABITATION",
        "ENGINEERING"
      ],
      notes:
        "Cargo is the largest mission zone and must have direct loading access. Crew and galley connect independently to the central passage, allowing a forward-projecting bridge."
    }),

    GUNSHIP: this._rules({
      scale: "SMALL",
      requiredPurposes: [
        "AIRLOCK",
        "COCKPIT",
        "WEAPONS_CONTROL",
        "ENGINEERING",
        "CREW_QUARTERS"
      ],
      forbiddenPurposes: [
        "PASSENGER_CABIN",
        "LUXURY_SUITE"
      ],
      requiredAdjacencies: [
        ["COCKPIT", "WEAPONS_CONTROL"],
        ["WEAPONS_CONTROL", "MAGAZINE"],
        ["CREW_QUARTERS", "CENTRAL_PASSAGE"],
        ["ENGINEERING", "CENTRAL_PASSAGE"]
      ],
      terminalPurposes: [
        "COCKPIT",
        "ENGINEERING"
      ],
      dominantPurposes: ["WEAPONS_CONTROL"],
      circulation: {
        maxHubs: 1,
        maxDepth: 4,
        maxAreaRatio: 0.15
      },
      zones: [
        "COMMAND",
        "MISSION",
        "HABITATION",
        "ENGINEERING"
      ],
      notes:
        "Compact combat craft with short protected access between command, weapons, and engineering."
    }),

    WARSHIP: this._rules({
      scale: "LARGE",
      requiredPurposes: [
        "AIRLOCK",
        "BRIDGE",
        "WEAPONS_CONTROL",
        "MAGAZINE",
        "ENGINEERING",
        "BARRACKS"
      ],
      forbiddenPurposes: ["LUXURY_SUITE"],
      requiredAdjacencies: [
        ["BRIDGE", "SECURITY"],
        ["WEAPONS_CONTROL", "MAGAZINE"],
        ["ENGINEERING", "DAMAGE_CONTROL"],
        ["BARRACKS", "CENTRAL_PASSAGE"]
      ],
      prohibitedAdjacencies: [
        ["MAGAZINE", "REACTOR"],
        ["MAGAZINE", "MEDICAL"]
      ],
      terminalPurposes: [
        "BRIDGE",
        "ENGINEERING"
      ],
      dominantPurposes: [
        "WEAPONS_CONTROL",
        "BARRACKS"
      ],
      circulation: {
        maxHubs: 3,
        maxDepth: 7,
        maxAreaRatio: 0.22
      },
      zones: [
        "COMMAND",
        "SECURITY",
        "MISSION",
        "HABITATION",
        "ENGINEERING"
      ],
      notes:
        "Layered access separates command, magazines, habitation, and engineering."
    }),

    CAPITAL_SHIP: this._rules({
      scale: "CAPITAL",
      requiredPurposes: [
        "AIRLOCK",
        "BRIDGE",
        "COMMAND",
        "HANGAR",
        "ENGINEERING",
        "REACTOR",
        "BARRACKS"
      ],
      forbiddenPurposes: [],
      requiredAdjacencies: [
        ["BRIDGE", "COMMAND"],
        ["HANGAR", "AIRLOCK"],
        ["ENGINEERING", "REACTOR"],
        ["ENGINEERING", "DAMAGE_CONTROL"],
        ["BARRACKS", "CENTRAL_PASSAGE"]
      ],
      prohibitedAdjacencies: [
        ["REACTOR", "MEDICAL"],
        ["MAGAZINE", "REACTOR"],
        ["HANGAR", "BRIDGE"]
      ],
      terminalPurposes: [
        "BRIDGE",
        "REACTOR"
      ],
      dominantPurposes: [
        "HANGAR",
        "COMMAND",
        "ENGINEERING"
      ],
      circulation: {
        minHubs: 2,
        maxHubs: 5,
        maxDepth: 10,
        maxAreaRatio: 0.26
      },
      zones: [
        "COMMAND",
        "SECURITY",
        "MISSION",
        "HABITATION",
        "ENGINEERING",
        "SERVICE"
      ],
      notes:
        "Large vessel requires multiple circulation hubs and distinct operational districts."
    }),

    RESEARCH_VESSEL: this._rules({
      scale: "MEDIUM",
      requiredPurposes: [
        "AIRLOCK",
        "BRIDGE",
        "LABORATORY",
        "ENGINEERING",
        "CREW_QUARTERS"
      ],
      forbiddenPurposes: [
        "MAGAZINE",
        "BRIG"
      ],
      requiredAdjacencies: [
        ["LABORATORY", "SPECIMEN_STORAGE"],
        ["LABORATORY", "MEDICAL"],
        ["BRIDGE", "CENTRAL_PASSAGE"],
        ["ENGINEERING", "UTILITY"]
      ],
      prohibitedAdjacencies: [
        ["SPECIMEN_STORAGE", "GALLEY"],
        ["SPECIMEN_STORAGE", "CREW_QUARTERS"]
      ],
      terminalPurposes: [
        "BRIDGE",
        "ENGINEERING"
      ],
      dominantPurposes: ["LABORATORY"],
      circulation: {
        maxHubs: 2,
        maxDepth: 6,
        maxAreaRatio: 0.20
      },
      zones: [
        "COMMAND",
        "RESEARCH",
        "CONTAINMENT",
        "HABITATION",
        "ENGINEERING"
      ],
      notes:
        "Laboratory cluster requires controlled specimen storage and medical access."
    }),

    PASSENGER_VESSEL: this._rules({
      scale: "LARGE",
      requiredPurposes: [
        "AIRLOCK",
        "BRIDGE",
        "PASSENGER_CABIN",
        "GALLEY",
        "ENGINEERING"
      ],
      forbiddenPurposes: [
        "MAGAZINE",
        "WEAPONS_CONTROL"
      ],
      requiredAdjacencies: [
        ["PASSENGER_CABIN", "CENTRAL_PASSAGE"],
        ["LOUNGE", "PASSENGER_CABIN"],
        ["GALLEY", "LOUNGE"],
        ["MEDICAL", "CENTRAL_PASSAGE"],
        ["BRIDGE", "CENTRAL_PASSAGE"]
      ],
      prohibitedAdjacencies: [
        ["PASSENGER_CABIN", "ENGINEERING"],
        ["PASSENGER_CABIN", "REACTOR"],
        ["LOUNGE", "ENGINEERING"]
      ],
      terminalPurposes: [
        "BRIDGE",
        "ENGINEERING"
      ],
      dominantPurposes: [
        "PASSENGER_CABIN",
        "LOUNGE"
      ],
      circulation: {
        minHubs: 2,
        maxHubs: 4,
        maxDepth: 7,
        maxAreaRatio: 0.24
      },
      zones: [
        "COMMAND",
        "PUBLIC",
        "HABITATION",
        "SERVICE",
        "ENGINEERING"
      ],
      notes:
        "Passenger and public zones must be separated from engineering and service operations."
    })
  });

  static resolve(value) {
    const id = String(value || "FREIGHTER")
      .trim()
      .toUpperCase()
      .replace(/[\s-]+/g, "_");

    return {
      id: this.RULES[id] ? id : "FREIGHTER",
      ...structuredClone(
        this.RULES[id] || this.RULES.FREIGHTER
      )
    };
  }

  static list() {
    return Object.keys(this.RULES);
  }

  static _rules({
    scale,
    requiredPurposes,
    forbiddenPurposes,
    requiredAdjacencies,
    prohibitedAdjacencies = [],
    terminalPurposes,
    dominantPurposes,
    circulation,
    zones,
    notes
  }) {
    return Object.freeze({
      scale,
      requiredPurposes: Object.freeze([
        ...requiredPurposes
      ]),
      forbiddenPurposes: Object.freeze([
        ...forbiddenPurposes
      ]),
      requiredAdjacencies: Object.freeze(
        requiredAdjacencies.map(
          pair => Object.freeze([...pair])
        )
      ),
      prohibitedAdjacencies: Object.freeze(
        prohibitedAdjacencies.map(
          pair => Object.freeze([...pair])
        )
      ),
      terminalPurposes: Object.freeze([
        ...terminalPurposes
      ]),
      dominantPurposes: Object.freeze([
        ...dominantPurposes
      ]),
      circulation: Object.freeze({
        ...circulation
      }),
      zones: Object.freeze([...zones]),
      requirements: Object.freeze({
        exteriorAirlock: true,
        deterministic: true,
        meaningfulSeedVariation: true,
        noUnexplainedVoids: true,
        actualOpeningReachability: true,
        visualReviewRequired: true
      }),
      notes
    });
  }
}
