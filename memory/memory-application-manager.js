// modules/ai-director/scripts/memory/memory-application-manager.js

import {
  MEMORY_DELTA_TYPES
} from "./memory-delta-schema.js";

import {
  NarrativeMemoryManager
} from "./narrative-memory-manager.js";

import {
  ArcResolutionManager
} from "./arc-resolution-manager.js";

import {
  ArcRegistryManager
} from "./arc-registry-manager.js";

import {
  NPCMemoryManager
} from "./npc-memory-manager.js";

import {
  LocationMemoryManager
} from "./location-memory-manager.js";

export class MemoryApplicationManager {

  static async applyDeltas(
    deltas = [],
    { dryRun = false } = {}
  ) {

    const results = [];

    for (const delta of deltas) {

      switch (delta.type) {

        case MEMORY_DELTA_TYPES.ARC_FACT:
          results.push(
            await this.processArcFact(
              delta,
              { dryRun }
            )
          );
          break;

        case MEMORY_DELTA_TYPES.ARC_OBJECTIVE:
          results.push(
            await this.processArcObjective(
              delta,
              { dryRun }
            )
          );
          break;

        case MEMORY_DELTA_TYPES.ARC_MYSTERY:
          results.push(
            await this.processArcMystery(
              delta,
              { dryRun }
            )
          );
          break;

        case MEMORY_DELTA_TYPES.ARC_THREAT:
          results.push(
            await this.processArcThreat(
              delta,
              { dryRun }
            )
          );
          break;

        case MEMORY_DELTA_TYPES.NARRATIVE_STATE:
          results.push(
            await this.processNarrativeState(
              delta,
              { dryRun }
            )
          );
          break;

        case MEMORY_DELTA_TYPES.NPC_EVENT:

          results.push(
            await this.processNPCEvent(
              delta,
              { dryRun }
            )
          );

          break;

        case MEMORY_DELTA_TYPES
          .LOCATION_CONTROL_CHANGE:

          results.push(
            await this
              .processLocationControl(
                delta,
                { dryRun }
              )
          );

          break;

        case MEMORY_DELTA_TYPES
          .LOCATION_OCCUPANCY_CHANGE:

          results.push(
            await this
              .processLocationOccupancy(
                delta,
                { dryRun }
              )
          );

          break;

        case MEMORY_DELTA_TYPES
          .LOCATION_ACTIVITY_CHANGE:

          results.push(
            await this
              .processLocationActivity(
                delta,
                { dryRun }
              )
          );

          break;

        case MEMORY_DELTA_TYPES
          .LOCATION_THREAT_CHANGE:

          results.push(
            await this
              .processLocationThreat(
                delta,
                { dryRun }
              )
          );

          break;
      }
    }

    return results;
  }

  static normalizeLocationArray(
    value
  ) {

    if (Array.isArray(value)) {
      return [
        ...new Set(value)
      ];
    }

    if (
      typeof value === "string"
    ) {

      try {

        const parsed =
          JSON.parse(value);

        if (
          Array.isArray(parsed)
        ) {

          return [
            ...new Set(parsed)
          ];
        }

      } catch {}

      return value
        .split(",")
        .map(v => v.trim())
        .filter(Boolean);
    }

    return [];
  }

  static async resolveTargetArc(
    delta
  ) {

    const arcs =
      await ArcRegistryManager
        .getActiveArcs();

    const text =
      String(delta.value || "")
        .toLowerCase();

    for (const arc of arcs) {

      if (
        text.includes(
          arc.name.toLowerCase()
        )
      ) {
        return arc;
      }

      if (
        (arc.facts || []).some(
          fact =>
            text.includes(
              fact
                .toLowerCase()
                .split(" ")[0]
            )
        )
      ) {
        return arc;
      }

    }

    return null;
  }

  static async processArcFact(
    delta,
    { dryRun = false } = {}
  ) {

    let arc =
      await this.resolveTargetArc(
        delta
      );

    if (!arc) {

      arc =
        await ArcResolutionManager
          .resolveOrCreateArc(
            "Emergent Arc"
          );
    }

    console.log(
      "[AI Director] Arc Applied",
      arc.name,
      delta.type,
      delta.value
    );

    if (dryRun) {
      return {
        action: "ARC_FACT",
        arc: arc.name
      };
    }

    return ArcRegistryManager.addFact(
      arc.arcId,
      delta.value
    );
  }

  static async processArcObjective(
    delta,
    { dryRun = false } = {}
  ) {

    let arc =
      await this.resolveTargetArc(
        delta
      );

    if (!arc) {

      arc =
        await ArcResolutionManager
          .resolveOrCreateArc(
            "Emergent Arc"
          );
    }

    console.log(
      "[AI Director] Arc Applied",
      arc.name,
      delta.type,
      delta.value
    );

    if (dryRun) {
      return arc;
    }

    return ArcRegistryManager.addObjective(
      arc.arcId,
      delta.value
    );
  }

  static async processArcMystery(
    delta,
    { dryRun = false } = {}
  ) {

    let arc =
      await this.resolveTargetArc(
        delta
      );

    if (!arc) {

      arc =
        await ArcResolutionManager
          .resolveOrCreateArc(
            "Emergent Arc"
          );
    }

    console.log(
      "[AI Director] Arc Applied",
      arc.name,
      delta.type,
      delta.value
    );

    if (dryRun) {
      return arc;
    }

    return ArcRegistryManager.addMystery(
      arc.arcId,
      delta.value
    );
  }

  static async processArcThreat(
    delta,
    { dryRun = false } = {}
  ) {

    let arc =
      await this.resolveTargetArc(
        delta
      );

    if (!arc) {

      arc =
        await ArcResolutionManager
          .resolveOrCreateArc(
            "Emergent Arc"
          );
    }

    console.log(
      "[AI Director] Arc Applied",
      arc.name,
      delta.type,
      delta.value
    );

    if (dryRun) {
      return arc;
    }

    return ArcRegistryManager.addThreat(
      arc.arcId,
      delta.value
    );
  }

  static async processNarrativeState(
    delta,
    { dryRun = false } = {}
  ) {

    const state =
      await NarrativeMemoryManager
        .getActiveNarrativeState();

    state.playerGoals ??= [];

    if (
      !state.playerGoals.includes(
        delta.value
      )
    ) {
      state.playerGoals.push(
        delta.value
      );
    }

    if (!dryRun) {

      await NarrativeMemoryManager
        .saveActiveNarrativeState(
          state
        );
    }

    return state;
  }

  static async processNPCEvent(
    delta,
    { dryRun = false } = {}
  ) {

    const actor =
      game.actors.get(
        delta.entityId
      );

    if (!actor) {
      return null;
    }

    if (dryRun) {
      return actor;
    }

    return NPCMemoryManager
      .addImportantEvent(
        actor,
        delta.value
      );

  }

  static async processLocationControl(
    delta,
    { dryRun = false } = {}
  ) {

    const memory =
      await LocationMemoryManager
        .getLocationMemory(
          delta.locationId
        );

    if (
      !memory.name &&
      delta.locationName
    ) {
      memory.name =
        delta.locationName;
    }

    memory.controllingFaction =
      delta.value;

    if (!dryRun) {

      await LocationMemoryManager
        .saveLocationMemory(
          memory
        );

    }

    return memory;

  }

  static async processLocationOccupancy(
    delta,
    { dryRun = false } = {}
  ) {

    const memory =
      await LocationMemoryManager
        .getLocationMemory(
          delta.locationId
        );

    if (
      !memory.name &&
      delta.locationName
    ) {
      memory.name =
        delta.locationName;
    }

    memory.occupants =
      this.normalizeLocationArray(
        delta.value
      );

    if (!dryRun) {

      await LocationMemoryManager
        .saveLocationMemory(
          memory
        );

    }

    return memory;

  }

  static async processLocationActivity(
    delta,
    { dryRun = false } = {}
  ) {

    const memory =
      await LocationMemoryManager
        .getLocationMemory(
          delta.locationId
        );

    if (
      !memory.name &&
      delta.locationName
    ) {
      memory.name =
        delta.locationName;
    }

    memory.activeActivities =
      this.normalizeLocationArray(
        delta.value
      );

    if (!dryRun) {

      await LocationMemoryManager
        .saveLocationMemory(
          memory
        );
    }

    return memory;
  }

  static async processLocationThreat(
    delta,
    { dryRun = false } = {}
  ) {

    const memory =
      await LocationMemoryManager
        .getLocationMemory(
          delta.locationId
        );

    if (
      !memory.name &&
      delta.locationName
    ) {
      memory.name =
        delta.locationName;
    }

    memory.activeThreats =
      this.normalizeLocationArray(
        delta.value
      );

    if (!dryRun) {

      await LocationMemoryManager
        .saveLocationMemory(
          memory
        );
    }

    return memory;
  }
}

if (typeof window !== "undefined") {

  window.AIDirector =
    window.AIDirector || {};

  window.AIDirector.MemoryApplicationManager =
    MemoryApplicationManager;
}