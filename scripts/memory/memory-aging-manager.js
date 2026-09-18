// modules/ai-director/scripts/memory/memory-aging-manager.js

export class MemoryAgingManager {

  static calculateAgeDays(isoDate) {
    if (!isoDate) {
      return 9999;
    }

    const ageMs = Date.now() - new Date(isoDate).getTime();

    return Math.floor(ageMs / 86400000);
  }

  static getDecayAmount(ageDays) {
    if (ageDays >= 90) {
      return 3;
    }

    if (ageDays >= 60) {
      return 2;
    }

    if (ageDays >= 30) {
      return 1;
    }

    return 0;
  }

  static async ageArc(arc) {
    const age = this.calculateAgeDays(arc.lastReferenced);
    const decay = this.getDecayAmount(age);

    if (!decay) {
      return null;
    }

    const newImportance = Math.max(5, (arc.importance || 5) - decay);

    return await AIDirector.ArcRegistryManager.updateArc(arc.arcId, {
      importance: newImportance
    });
  }

  static async ageNPC(actor, profile) {
    const age = this.calculateAgeDays(profile.lastReferenced);
    const decay = this.getDecayAmount(age);

    if (!decay) {
      return null;
    }

    profile.importance = Math.max(3, (profile.importance || 5) - decay);

    await actor.setFlag("ai-director", "profile", profile);

    return profile;
  }

  static async runDecay() {
    const arcs = await AIDirector.ArcRegistryManager.getRegistry();

    for (const arc of arcs) {
      await this.ageArc(arc);
    }

    for (const actor of game.actors.contents) {
      const profile = await actor.getFlag("ai-director", "profile");

      if (!profile) {
        continue;
      }

      await this.ageNPC(actor, profile);
    }

    console.log("[AI Director] Memory Decay Complete");

    return true;
  }
}

if (typeof window !== "undefined") {
  window.AIDirector = window.AIDirector || {};
  window.AIDirector.MemoryAgingManager = MemoryAgingManager;
}