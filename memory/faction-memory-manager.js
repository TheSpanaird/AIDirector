// modules/ai-director/scripts/memory/faction-memory-manager.js

export class FactionMemoryManager {

  static SETTING_KEY =
    "faction-memory-registry";

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
    factionId
  ) {

    return {

      factionId,

      facts: [],

      goals: [],

      threats: [],

      relatedNPCs: [],

      relatedArcs: [],

      relatedFactions: [],

      importance: 5,

      lastReferenced: null,

      lastPromoted: null

    };

  }

  static async getFactionMemory(
    factionId
  ) {

    const registry =
      this.getRegistry();

    let memory =
      registry.find(
        f =>
          f.factionId ===
          factionId
      );

    if (!memory) {

      memory =
        this.createMemory(
          factionId
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

  static async saveFactionMemory(
    memory
  ) {

    const registry =
      this.getRegistry();

    const index =
      registry.findIndex(
        f =>
          f.factionId ===
          memory.factionId
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
    factionId,
    fact
  ) {

    const memory =
      await this.getFactionMemory(
        factionId
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

    return await this.saveFactionMemory(
      memory
    );

  }

  static async addGoal(
    factionId,
    goal
  ) {

    const memory =
      await this.getFactionMemory(
        factionId
      );

    if (
      !memory.goals.includes(
        goal
      )
    ) {

      memory.goals.push(
        goal
      );

      memory.importance++;

    }

    return await this.saveFactionMemory(
      memory
    );

  }

  static async addThreat(
    factionId,
    threat
  ) {

    const memory =
      await this.getFactionMemory(
        factionId
      );

    if (
      !memory.threats.includes(
        threat
      )
    ) {

      memory.threats.push(
        threat
      );

      memory.importance++;

    }

    return await this.saveFactionMemory(
      memory
    );

  }

  static async linkArc(
    factionId,
    arcId
  ) {

    const memory =
      await this.getFactionMemory(
        factionId
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

    return await this.saveFactionMemory(
      memory
    );

  }

  static async linkNPC(
    factionId,
    actorId
  ) {

    const memory =
      await this.getFactionMemory(
        factionId
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

    return await this.saveFactionMemory(
      memory
    );

  }

  static async linkFaction(
    sourceFactionId,
    targetFactionId,
    relationship = "RELATED"
  ) {

    if (
      sourceFactionId ===
      targetFactionId
    ) {
      return null;
    }

    const source =
      await this.getFactionMemory(
        sourceFactionId
      );

    const target =
      await this.getFactionMemory(
        targetFactionId
      );

    source.relatedFactions ??= [];
    target.relatedFactions ??= [];

    const sourceExists =
      source.relatedFactions.some(
        rel =>
          rel.factionId ===
          targetFactionId
      );

    if (!sourceExists) {

      source.relatedFactions.push({

        factionId:
          targetFactionId,

        relationship

      });

    }

    const targetExists =
      target.relatedFactions.some(
        rel =>
          rel.factionId ===
          sourceFactionId
      );

    if (!targetExists) {

      target.relatedFactions.push({

        factionId:
          sourceFactionId,

        relationship

      });

    }

    await this.saveFactionMemory(
      source
    );

    await this.saveFactionMemory(
      target
    );

    return source;

  }

  static async getRelatedFactions(
    factionId
  ) {

    const memory =
      await this.getFactionMemory(
        factionId
      );

    return (
      memory.relatedFactions ||
      []
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
    .FactionMemoryManager =
      FactionMemoryManager;

}