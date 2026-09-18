// modules/ai-director/scripts/memory/memory-extraction-manager.js

import {
  MEMORY_DELTA_TYPES,
  createMemoryDelta
} from "./memory-delta-schema.js";

import {
  NPCMemoryManager
} from "./npc-memory-manager.js";

import {
  WorldStateEvolutionManager
} from "./world-state-evolution-manager.js";

export class MemoryExtractionManager {

  static async extractFromNarrative(
    narrativeRecord = {}
  ) {

    const deltas = [];

    if (!narrativeRecord) {
      return deltas;
    }

    for (const objective of (narrativeRecord.objectives || [])) {
      deltas.push(
        createMemoryDelta({
          type: MEMORY_DELTA_TYPES.ARC_OBJECTIVE,
          value: objective,
          importance: 8,
          source: "NarrativeRecord"
        })
      );
    }

    for (const mystery of (narrativeRecord.mysteries || [])) {
      deltas.push(
        createMemoryDelta({
          type: MEMORY_DELTA_TYPES.ARC_MYSTERY,
          value: mystery,
          importance: 8,
          source: "NarrativeRecord"
        })
      );
    }

    for (const danger of (narrativeRecord.dangers || [])) {
      deltas.push(
        createMemoryDelta({
          type: MEMORY_DELTA_TYPES.ARC_THREAT,
          value: danger,
          importance: 7,
          source: "NarrativeRecord"
        })
      );
    }

    for (const hook of (narrativeRecord.storyHooks || [])) {
      deltas.push(
        createMemoryDelta({
          type: MEMORY_DELTA_TYPES.ARC_FACT,
          value: hook,
          importance: 6,
          source: "NarrativeRecord"
        })
      );
    }

    for (const goal of (narrativeRecord.playerGoals || [])) {
      deltas.push(
        createMemoryDelta({
          type: MEMORY_DELTA_TYPES.NARRATIVE_STATE,
          value: goal,
          importance: 9,
          source: "NarrativeRecord"
        })
      );
    }

    const npcDeltas =
      await this.extractNPCMemory(
        narrativeRecord
      );

    deltas.push(
      ...npcDeltas
    );

    const worldStateDeltas =
      await WorldStateEvolutionManager
        .extractWorldStateChanges(
          narrativeRecord
        );

    for (const delta of worldStateDeltas) {
      if (
        !delta.locationId &&
        delta.type?.startsWith(
          "LOCATION_"
        )
      ) {
        console.warn(
          "[AI Director] Rejected invalid location delta",
          delta
        );
        continue;
      }

      deltas.push(delta);
    }

    return deltas;
  }

  static async extractNPCMemory(
    narrativeRecord = {}
  ) {

    const deltas = [];

    const text = [

      narrativeRecord.currentSituation,

      ...(narrativeRecord.revelations || []),

      ...(narrativeRecord.storyHooks || [])

    ]
      .filter(Boolean)
      .join(" ");

    for (
      const actor
      of game.actors.contents
    ) {

      if (
        !text
          .toLowerCase()
          .includes(
            actor.name
              .toLowerCase()
              .split(" ")[0]
          )
      ) {
        continue;
      }

      deltas.push(
        createMemoryDelta({
          type:
            MEMORY_DELTA_TYPES.NPC_EVENT,

          entityId:
            actor.id,

          value:
            text,

          source:
            "NarrativeRecord",

          importance: 6
        })
      );

    }

    return deltas;

  }

  static async previewNarrativeExtraction(
    narrativeRecord = {}
  ) {

    const deltas =
      await this.extractFromNarrative(
        narrativeRecord
      );

    console.table(deltas);

    return deltas;
  }
}

if (typeof window !== "undefined") {

  window.AIDirector =
    window.AIDirector || {};

  window.AIDirector.MemoryExtractionManager =
    MemoryExtractionManager;
}
``