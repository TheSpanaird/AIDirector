// modules/ai-director/scripts/memory/location-memory-manager.js

export class LocationMemoryManager {

  static SETTING_KEY =
    "location-memory-registry";

  static dedupe(
    values = []
  ) {

    return [
      ...new Set(
        values.filter(Boolean)
      )
    ];
  }

  static getRegistry() {

    if (!game?.settings) {
      return [];
    }

    return (
      game.settings.get(
        "ai-director",
        this.SETTING_KEY
      ) || []
    );

  }

  static async saveRegistry(
    registry
  ) {

    if (!game.user.isGM) {
      return;
    }

    await game.settings.set(
      "ai-director",
      this.SETTING_KEY,
      registry
    );

  }

  static createMemory(
    locationId,
    name = ""
  ) {

    return {

      locationId,

      name,

      facts: [],

      events: [],

      occupants: [],

      controllingFaction: null,

      activeThreats: [],

      activeActivities: [],

      relatedNPCs: [],

      relatedFactions: [],

      relatedArcs: [],

      importance: 5,

      lastReferenced: null,

      lastPromoted: null

    };

  }

  static async getLocationMemory(
    locationId,
    name = ""
  ) {

    const registry =
      this.getRegistry();

    let memory =
      registry.find(
        l =>
          l.locationId ===
          locationId
      );

    if (!memory) {

      memory =
        this.createMemory(
          locationId,
          name
        );

      registry.push(
        memory
      );

      await this.saveRegistry(
        registry
      );

    }

    return memory;

  }

  static async saveLocationMemory(
    memory
  ) {

    const registry =
      this.getRegistry();

    const index =
      registry.findIndex(
        l =>
          l.locationId ===
          memory.locationId
      );

    if (index === -1) {

      registry.push(
        memory
      );

    } else {

      registry[index] =
        memory;

    }

    await this.saveRegistry(
      registry
    );

    return memory;

  }

  static async addFact(
    locationId,
    fact
  ) {

    const memory =
      await this.getLocationMemory(
        locationId
      );

    if (
      !memory.facts.includes(
        fact
      )
    ) {

      memory.facts.push(
        fact
      );

      memory.importance++;

    }

    return this.saveLocationMemory(
      memory
    );

  }

  static async addEvent(
    locationId,
    event
  ) {

    const memory =
      await this.getLocationMemory(
        locationId
      );

    if (
      !memory.events.includes(
        event
      )
    ) {

      memory.events.push(
        event
      );

      memory.importance++;

    }

    return this.saveLocationMemory(
      memory
    );

  }

  static async linkArc(
    locationId,
    arcId
  ) {

    const memory =
      await this.getLocationMemory(
        locationId
      );

    if (
      !memory.relatedArcs.includes(
        arcId
      )
    ) {

      memory.relatedArcs.push(
        arcId
      );

    }

    return this.saveLocationMemory(
      memory
    );

  }

  static async linkFaction(
    locationId,
    factionId
  ) {

    const memory =
      await this.getLocationMemory(
        locationId
      );

    if (
      !memory.relatedFactions.includes(
        factionId
      )
    ) {

      memory.relatedFactions.push(
        factionId
      );

    }

    return this.saveLocationMemory(
      memory
    );

  }

  static async linkNPC(
    locationId,
    actorId
  ) {

    const memory =
      await this.getLocationMemory(
        locationId
      );

    if (
      !memory.relatedNPCs.includes(
        actorId
      )
    ) {

      memory.relatedNPCs.push(
        actorId
      );

    }

    return this.saveLocationMemory(
      memory
    );

  }

}

if (
  typeof window !==
  "undefined"
) {

  window.AIDirector =
    window.AIDirector || {};

  window.AIDirector
    .LocationMemoryManager =
      LocationMemoryManager;

}