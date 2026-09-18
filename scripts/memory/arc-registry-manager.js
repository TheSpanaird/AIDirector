// modules/ai-director/scripts/memory/arc-registry-manager.js

import {
  createArcMemory,
  ARC_STATUS
} from "./narrative-memory-schema.js";

export class ArcRegistryManager {

  static SETTINGS_KEY = "arcRegistry";

  static async getRegistry() {

    try {

      return (
        game.settings.get(
          "ai-director",
          this.SETTINGS_KEY
        ) || []
      );

    } catch (err) {

      console.error(
        "[AI Director] Failed to load Arc Registry",
        err
      );

      return [];
    }
  }

  static async saveRegistry(
    registry = []
  ) {

    await game.settings.set(
      "ai-director",
      this.SETTINGS_KEY,
      registry
    );

    return registry;
  }

  static async getActiveArcs() {

    const registry =
      await this.getRegistry();

    return registry.filter(
      arc =>
        arc.status === ARC_STATUS.ACTIVE
    );
  }

  static async getArcById(
    arcId
  ) {

    const registry =
      await this.getRegistry();

    return (
      registry.find(
        arc => arc.arcId === arcId
      ) || null
    );
  }

  static async createArc(
    data = {}
  ) {

    const registry =
      await this.getRegistry();

    const arc =
      createArcMemory({
        importance:
          data.importance || 5,

        relatedArcs:
          data.relatedArcs || [],

        ...data,
        arcId:
          data.arcId ||
          foundry.utils.randomID()
      });

    registry.push(arc);

    await this.saveRegistry(registry);

    return arc;
  }

  static async updateArc(
    arcId,
    updates = {}
  ) {

    const registry =
      await this.getRegistry();

    const index =
      registry.findIndex(
        arc => arc.arcId === arcId
      );

    if (index === -1) {
      return null;
    }

    registry[index] = {
      ...registry[index],
      ...updates
    };

    await this.saveRegistry(registry);

    return registry[index];
  }

  static async resolveArc(
    arcId
  ) {

    return this.updateArc(
      arcId,
      {
        status: ARC_STATUS.RESOLVED
      }
    );
  }

  static async failArc(
    arcId
  ) {

    return this.updateArc(
      arcId,
      {
        status: ARC_STATUS.FAILED
      }
    );
  }

  static async abandonArc(
    arcId
  ) {

    return this.updateArc(
      arcId,
      {
        status: ARC_STATUS.ABANDONED
      }
    );
  }

  static async addFact(
    arcId,
    fact
  ) {

    const arc =
      await this.getArcById(arcId);

    if (!arc || !fact) {
      return null;
    }

    const facts = [
      ...(arc.facts || [])
    ];

    let added = false;

    if (!facts.includes(fact)) {
      facts.push(fact);
      added = true;
    }

    const updates = {
      facts
    };

    if (added) {
      updates.importance =
        Math.max(
          0,
          Math.min(
            20,
            (arc.importance || 5) + 1
          )
        );
    }

    return this.updateArc(
      arcId,
      updates
    );
  }

  static async addMystery(
    arcId,
    mystery
  ) {

    const arc =
      await this.getArcById(arcId);

    if (!arc || !mystery) {
      return null;
    }

    const mysteries = [
      ...(arc.mysteries || [])
    ];

    let added = false;

    if (!mysteries.includes(mystery)) {
      mysteries.push(mystery);
      added = true;
    }

    const updates = {
      mysteries
    };

    if (added) {
      updates.importance =
        Math.max(
          0,
          Math.min(
            20,
            (arc.importance || 5) + 2
          )
        );
    }

    return this.updateArc(
      arcId,
      updates
    );
  }

  static async addObjective(
    arcId,
    objective
  ) {

    const arc =
      await this.getArcById(arcId);

    if (!arc || !objective) {
      return null;
    }

    const objectives = [
      ...(arc.objectives || [])
    ];

    let added = false;

    if (!objectives.includes(objective)) {
      objectives.push(objective);
      added = true;
    }

    const updates = {
      objectives
    };

    if (added) {
      updates.importance =
        Math.max(
          0,
          Math.min(
            20,
            (arc.importance || 5) + 2
          )
        );
    }

    return this.updateArc(
      arcId,
      updates
    );
  }

  static async addThreat(
    arcId,
    threat
  ) {

    const arc =
      await this.getArcById(arcId);

    if (!arc || !threat) {
      return null;
    }

    const threats = [
      ...(arc.threats || [])
    ];

    let added = false;

    if (!threats.includes(threat)) {
      threats.push(threat);
      added = true;
    }

    const updates = {
      threats
    };

    if (added) {
      updates.importance =
        Math.max(
          0,
          Math.min(
            20,
            (arc.importance || 5) + 2
          )
        );
    }

    return this.updateArc(
      arcId,
      updates
    );
  }

  static async updateImportance(
    arcId,
    delta = 1
  ) {

    const arc =
      await this.getArcById(
        arcId
      );

    if (!arc) {
      return null;
    }

    return this.updateArc(
      arcId,
      {
        importance: Math.max(
          0,
          Math.min(
            20,
            (arc.importance || 5)
              + delta
          )
        ),

        lastPromoted:
          new Date().toISOString()
      }
    );
  }

  static async touchReference(
    arcId
  ) {

    return this.updateArc(
      arcId,
      {
        lastReferenced:
          new Date().toISOString()
      }
    );
  }

  static async addRelatedEntity(
    arcId,
    entityName
  ) {

    const arc =
      await this.getArcById(arcId);

    if (!arc || !entityName) {
      return null;
    }

    const relatedEntities = [
      ...(arc.relatedEntities || [])
    ];

    if (
      !relatedEntities.includes(entityName)
    ) {
      relatedEntities.push(entityName);
    }

    return this.updateArc(
      arcId,
      {
        relatedEntities
      }
    );
  }
}

if (typeof window !== "undefined") {

  window.AIDirector =
    window.AIDirector || {};

  window.AIDirector.ArcRegistryManager =
    ArcRegistryManager;

}