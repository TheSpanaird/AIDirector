// modules/ai-director/scripts/memory/narrative-memory-schema.js

export const ARC_STATUS = {
  ACTIVE: "ACTIVE",
  RESOLVED: "RESOLVED",
  FAILED: "FAILED",
  ABANDONED: "ABANDONED"
};

export function createArcMemory(
  data = {}
) {

  return {

    arcId:
      data.arcId ||
      foundry.utils.randomID(),

    name:
      data.name || "",

    aliases:
      data.aliases || [],

    status:
      data.status ||
      ARC_STATUS.ACTIVE,

    importance:
      data.importance || 5,

    facts:
      data.facts || [],

    mysteries:
      data.mysteries || [],

    objectives:
      data.objectives || [],

    threats:
      data.threats || [],

    relatedEntities:
      data.relatedEntities || [],

    relatedArcs:
      data.relatedArcs || [],

    lastReferenced:
      data.lastReferenced || null,

    lastPromoted:
      data.lastPromoted || null

  };

}

export function createActiveNarrativeState(stored = {}) {

  const defaults = {

    activeObjectives: [],

    activeMysteries: [],

    activeThreats: [],

    activeFactions: [],

    activeLocations: [],

    activeArcs: [],

    playerGoals: [],

    currentNarrativePhase:
      "INTRODUCTION"
  };

  return {
    ...defaults,
    ...stored
  };
}
