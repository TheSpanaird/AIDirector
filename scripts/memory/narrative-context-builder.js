// modules/ai-director/scripts/memory/narrative-context-builder.js

import {
  NarrativeMemoryManager
} from "./narrative-memory-manager.js";

import {
  ArcRegistryManager
} from "./arc-registry-manager.js";

import {
  NPCMemoryManager
} from "./npc-memory-manager.js";

import {
  FactionMemoryManager
} from "./faction-memory-manager.js";

import {
  LocationMemoryManager
} from "./location-memory-manager.js";

import {
  ArchiveRetrievalManager
} from "./archive-retrieval-manager.js";

import {
  OccupancyIntentManager
} from "./occupancy-intent-manager.js";

import {
  SceneManagerMemoryEngine
} from "./scene-manager-memory-engine.js";

import {
  LocationRelevanceEngine
} from "./location-relevance-engine.js";

import {
  NPCRelevanceEngine
} from "./npc-relevance-engine.js";

import {
  FactionRelevanceEngine
} from "./faction-relevance-engine.js";

import {
  ArcRelevanceEngine
} from "./arc-relevance-engine.js";

export class NarrativeContextBuilder {

  static getCurrentLocation() {

    const scene =
      game.scenes.current;

    if (!scene) {
      return null;
    }

    return {
      sceneId: scene.id,
      sceneName: scene.name
    };
  }

  static getCurrentRegion() {

    const scene =
      game.scenes.current;

    if (!scene) {
      return null;
    }

    return (
      scene.getFlag(
        "ai-director",
        "region"
      ) || null
    );
  }

  static async getSceneEntities() {

    const scene =
      game.scenes.current;

    if (!scene) {
      return [];
    }

    const entities = [];

    for (
      const token
      of scene.tokens.contents
    ) {

      const actor =
        game.actors.get(
          token.actorId
        );

      if (!actor) {
        continue;
      }

      entities.push({
        actorId:
          actor.id,

        name:
          actor.name
      });
    }

    return entities;
  }

  static async findRelevantArcs(
    directive
  ) {

    const query =
      (directive || "")
        .toLowerCase()
        .trim();

    if (!query) {
      return [];
    }

    const arcs =
      await ArcRegistryManager
        .getActiveArcs();

    return arcs.filter(arc => {

      const searchableText = [

        arc.name,

        ...(arc.aliases || []),

        ...(arc.facts || []),

        ...(arc.mysteries || []),

        ...(arc.objectives || []),

        ...(arc.threats || [])

      ]
        .join(" ")
        .toLowerCase();

      return searchableText
        .includes(query);

    });

  }

  static async findDirectMatches(
    directive
  ) {

    const query =
      (directive || "")
        .toLowerCase()
        .trim();

    const queryWords =
      query
        .split(/\s+/)
        .filter(
          word =>
            word.length >= 4
        );

    const matches = [];

    const matchedIds =
      new Set();

    for (
      const actor
      of game.actors.contents
    ) {

      const actorName =
        actor.name.toLowerCase();

      if (
        query.includes(actorName)
      ) {

        if (
          !matchedIds.has(
            actor.id
          )
        ) {
          matchedIds.add(
            actor.id
          );

          matches.push({
            actorId:
              actor.id,

            name:
              actor.name
          });
        }

        continue;
      }

      const nameParts =
        actorName
          .split(/\s+/)
          .filter(
            part =>
              part.length >= 4
          );

      if (
        nameParts.some(
          part =>
            queryWords.includes(
              part
            )
        )
      ) {

        if (
          !matchedIds.has(
            actor.id
          )
        ) {
          matchedIds.add(
            actor.id
          );

          matches.push({
            actorId:
              actor.id,

            name:
              actor.name
          });
        }

      }

    }

    console.log(
      "[AI Director] Direct Matches",
      matches
    );

    return matches;
  }

  static async getRelatedArcs() {

    const arcs =
      await ArcRegistryManager
        .getActiveArcs();

    const relationships = [];

    for (
      const arc
      of arcs
    ) {

      for (
        const relation
        of (
          arc.relatedArcs || []
        )
      ) {

        const target =
          await ArcRegistryManager
            .getArcById(
              relation.arcId
            );

        if (!target) {
          continue;
        }

        relationships.push({

          sourceArc:
            arc.name,

          targetArc:
            target.name,

          relationship:
            relation.relationship

        });

      }

    }

    return relationships;
  }

  static async build(
    playerDirective = ""
  ) {

    const currentLocation =
      this.getCurrentLocation();

    const currentRegion =
      this.getCurrentRegion();

    const sceneEntities =
      await this.getSceneEntities();

    const [
      activeNarrativeState,
      activeArcs
    ] = await Promise.all([
      NarrativeMemoryManager.getActiveNarrativeState(),
      ArcRegistryManager.getActiveArcs()
    ]);

    const activeArcNames =
      activeArcs
        .filter(
          arc =>
            activeNarrativeState
              ?.activeArcs
              ?.includes(
                arc.arcId
              )
        )
        .map(
          arc =>
            arc.name
        );

    activeArcs.sort(
      (a, b) =>
        (b.importance || 0)
        -
        (a.importance || 0)
    );

    const directMatches =
      await this.findDirectMatches(
        playerDirective
      );

    const importantFactions =
      await this
        .getImportantFactions();

    const factionRelationships =
      await this
        .getImportantFactionRelationships();

    const importantLocations =
      await this
        .getImportantLocations();

    const relevantLocations =
      await LocationRelevanceEngine
        .findRelevantLocations({
          playerDirective,
          currentLocation
        });

    const primaryLocation =
      relevantLocations[0] ||
      importantLocations[0] ||
      null;

    let locationState =
      null;

    if (primaryLocation) {

      locationState =
        await OccupancyIntentManager
          .getLocationState(
            primaryLocation.locationId
          );

    }

    const relevantNPCs =
      await NPCRelevanceEngine
        .findRelevantNPCs({
          playerDirective,
          primaryLocation,
          activeObjectives:
            activeNarrativeState
              .activeObjectives
        });

    const relevantFactions =
      await FactionRelevanceEngine
        .findRelevantFactions({
          playerDirective,
          primaryLocation,
          activeNarrativeState
        });

    const relevantArcs =
      await ArcRelevanceEngine
        .findRelevantArcs({
          playerDirective,
          activeNarrativeState
        });

    for (const arc of relevantArcs) {

      await ArcRegistryManager
        .touchReference(
          arc.arcId
        );
    }

    const availableEntities =
      [...sceneEntities];

    const arcMatches =
      await this.findRelevantArcs(
        playerDirective
      );

    const relatedArcs =
      await this.getRelatedArcs();

    const sceneMemory =
      await SceneManagerMemoryEngine
        .buildSceneMemory({
          currentLocation,
          activeNarrativeState,
          primaryLocation,
          importantFactions
        });

    const compressedActiveArcs =
      activeArcs
        .slice(0, 3);

    const compressedImportantFactions =
      importantFactions
        .slice(0, 3);

    const compressedImportantLocations =
      importantLocations
        .slice(0, 3);

    const context = {

      currentLocation,

      currentRegion,

      directMatches,

      sceneEntities,

      availableEntities,

      arcMatches,

      relatedArcs,

      activeNarrativeState,

      activeArcs:
        compressedActiveArcs,

      activeArcNames,

      relevantNPCs,

      importantFactions:
        compressedImportantFactions,

      factionRelationships,

      importantLocations:
        compressedImportantLocations,

      locationState,

      sceneMemory,

      worldState: {

        importantLocations,

        locationState,

        sceneMemory

      },

      playerGoals:
        activeNarrativeState
          ?.playerGoals || [],

      primaryLocation,

      relevantLocations,

      relevantFactions,

      relevantArcs
    };

    console.table(
      relevantNPCs.map(npc => ({
        name: npc.actor?.name,
        score: npc.relevanceScore,
        reasons:
          npc.relevanceReasons.join(", ")
      }))
    );

    console.table(
      relevantFactions.map(faction => ({
        id: faction.factionId,
        score: faction.relevanceScore,
        reasons:
          faction.relevanceReasons.join(", ")
      }))
    );

    console.table(
      relevantArcs.map(arc => ({
        name: arc.name,
        score: arc.relevanceScore,
        reasons:
          arc.relevanceReasons.join(", ")
      }))
    );

    let archiveResults = [];

    if (
      await this.shouldUseArchive(
        context
      )
    ) {

      archiveResults =
        await ArchiveRetrievalManager
          .retrieve(
            playerDirective
          );

    }

    console.group(
      "[AI Director] Location Relevance"
    );

    console.table(
      relevantLocations.map(
        location => ({
          name:
            location.name,
          score:
            location.relevanceScore,
          reasons:
            location.relevanceReasons
              .join(", ")
        })
      )
    );

    console.groupEnd();

    return {

      ...context,

      archiveResults
    };
  }

  static async shouldUseArchive(
    context
  ) {

    const hasRelevantMemory =

      context.directMatches?.length ||

      context.relevantLocations?.length ||

      context.relevantNPCs?.length ||

      context.relevantFactions?.length ||

      context.relevantArcs?.length ||

      context.activeNarrativeState
        ?.activeObjectives?.length ||

      context.activeNarrativeState
        ?.activeMysteries?.length ||

      context.activeNarrativeState
        ?.activeThreats?.length;

    return (
      !hasRelevantMemory ||
      (
        context.relevantArcs
          ?.length === 0 &&
        context.directMatches
          ?.length === 0
      )
    );

  }

  static async getImportantEntities() {

    const entities = [];

    for (const actor of game.actors.contents) {

      const profile =
        await actor.getFlag(
          "ai-director",
          "profile"
        );

      if (!profile?.memory) {
        continue;
      }

      const memory = profile.memory;

      if (
        memory.facts?.length ||
        memory.obligations?.length ||
        memory.importantEvents?.length
      ) {

        await NPCMemoryManager
          .touchReference(actor);

        entities.push({
          actorId: actor.id,

          name: actor.name,

          importance:
            profile.importance || 5,

          facts: memory.facts || [],
          obligations:
            memory.obligations || [],
          importantEvents:
            memory.importantEvents || [],
          knownLocations:
            memory.knownLocations || []
        });
      }
    }

    return entities
      .sort(
        (a, b) =>
          (b.importance || 0)
          -
          (a.importance || 0)
      )
      .slice(0, 10);
  }

  static async getImportantFactions() {

    const registry =
      FactionMemoryManager
        .getRegistry();

    return registry
      .sort(
        (a, b) =>
          b.importance -
          a.importance
      )
      .slice(0, 10);

  }

  static async getImportantFactionRelationships() {

    const factions =
      AIDirector
        .FactionMemoryManager
        .getRegistry();

    const relationships = [];

    for (
      const faction
      of factions
    ) {

      for (
        const relation
        of (
          faction.relatedFactions || []
        )
      ) {

        relationships.push({

          sourceFaction:
            faction.factionId,

          targetFaction:
            relation.factionId,

          relationship:
            relation.relationship

        });

      }

    }

    return relationships;

  }

  static async getImportantLocations() {

    const locations =
      LocationMemoryManager
        .getRegistry();

    return locations
      .sort(
        (a, b) =>
          b.importance -
          a.importance
      )
      .slice(0, 10);

  }

  static async preview(
    playerDirective = ""
  ) {

    const context =
      await this.build(
        playerDirective
      );

    console.group(
      "[AI Director] Narrative Context Preview"
    );

    console.log(
      "Directive:",
      playerDirective
    );

    console.log(
      "Context:",
      context
    );

    console.groupEnd();

    return context;
  }
}

if (typeof window !== "undefined") {

  window.AIDirector =
    window.AIDirector || {};

  window.AIDirector.NarrativeContextBuilder =
    NarrativeContextBuilder;
}