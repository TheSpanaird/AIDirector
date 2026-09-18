// spaceship-archetype-library.js
// Scene-driven room programs for technical spaceship subtypes.

export class SpaceshipArchetypeLibrary {
  static ARCHETYPES = Object.freeze({
    SHUTTLE: this._program({
      scale: "SMALL",
      required: ["AIRLOCK", "COCKPIT", "CABIN", "ENGINEERING"],
      preferred: ["CARGO", "UTILITY"],
      forbidden: ["HANGAR", "MAGAZINE", "BRIG"]
    }),
    FREIGHTER: this._program({
      scale: "MEDIUM",
      required: ["AIRLOCK", "BRIDGE", "CARGO", "ENGINEERING", "CREW_QUARTERS"],
      preferred: ["GALLEY", "UTILITY", "WORKSHOP", "MEDICAL"],
      forbidden: ["MAGAZINE", "WEAPONS_CONTROL"]
    }),
    GUNSHIP: this._program({
      scale: "SMALL",
      required: ["AIRLOCK", "COCKPIT", "WEAPONS_CONTROL", "ENGINEERING", "CREW_QUARTERS"],
      preferred: ["MAGAZINE", "SECURITY", "MEDICAL", "UTILITY"],
      forbidden: ["PASSENGER_CABIN", "LUXURY_SUITE"]
    }),
    WARSHIP: this._program({
      scale: "LARGE",
      required: ["AIRLOCK", "BRIDGE", "WEAPONS_CONTROL", "MAGAZINE", "ENGINEERING", "BARRACKS"],
      preferred: ["SECURITY", "MEDICAL", "DAMAGE_CONTROL", "UTILITY", "BRIG"],
      forbidden: ["LUXURY_SUITE"]
    }),
    CAPITAL_SHIP: this._program({
      scale: "CAPITAL",
      required: ["AIRLOCK", "BRIDGE", "COMMAND", "HANGAR", "ENGINEERING", "REACTOR", "BARRACKS"],
      preferred: ["WEAPONS_CONTROL", "MAGAZINE", "MEDICAL", "DAMAGE_CONTROL", "SECURITY", "UTILITY"],
      forbidden: []
    }),
    RESEARCH_VESSEL: this._program({
      scale: "MEDIUM",
      required: ["AIRLOCK", "BRIDGE", "LABORATORY", "ENGINEERING", "CREW_QUARTERS"],
      preferred: ["MEDICAL", "SPECIMEN_STORAGE", "UTILITY", "CARGO"],
      forbidden: ["MAGAZINE", "BRIG"]
    }),
    PASSENGER_VESSEL: this._program({
      scale: "LARGE",
      required: ["AIRLOCK", "BRIDGE", "PASSENGER_CABIN", "GALLEY", "ENGINEERING"],
      preferred: ["LOUNGE", "MEDICAL", "CARGO", "SECURITY", "UTILITY"],
      forbidden: ["MAGAZINE", "WEAPONS_CONTROL"]
    })
  });

  static resolve(value) {
    const id = String(value || "FREIGHTER")
      .trim()
      .toUpperCase()
      .replace(/[\s-]+/g, "_");
    return { id: this.ARCHETYPES[id] ? id : "FREIGHTER", ...structuredClone(this.ARCHETYPES[id] || this.ARCHETYPES.FREIGHTER) };
  }

  static list() {
    return Object.keys(this.ARCHETYPES);
  }

  static _program({ scale, required, preferred, forbidden }) {
    return Object.freeze({
      scale,
      required: Object.freeze([...required]),
      preferred: Object.freeze([...preferred]),
      optional: Object.freeze([]),
      forbidden: Object.freeze([...forbidden])
    });
  }
}
