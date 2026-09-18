// modules/ai-director/scripts/memory/arc-resolution-manager.js

import {
  ArcRegistryManager
} from "./arc-registry-manager.js";

import {
  createArcMemory
} from "./narrative-memory-schema.js";

/**
 * AI Director 2.x
 *
 * Arc Resolution Manager
 *
 * Purpose:
 * Resolve incoming narrative concepts to an
 * existing campaign arc whenever possible.
 *
 * Version 1:
 * - Exact Name Match
 * - Alias Match
 * - Case Insensitive Matching
 *
 * No AI.
 * No embeddings.
 * No vector search.
 */
export class ArcResolutionManager {

  /**
   * Attempt to resolve a candidate
   * string to an existing Arc.
   */
  static async resolveArc(
    candidate = ""
  ) {

    const registry =
      await ArcRegistryManager.getRegistry();

    const normalized =
      this.normalize(candidate);

    //
    // Exact Name Match
    //
    let match = registry.find(
      arc =>
        this.normalize(arc.name) ===
        normalized
    );

    if (match) {
      return match;
    }

    //
    // Alias Match
    //
    match = registry.find(
      arc =>
        (arc.aliases || []).some(
          alias =>
            this.normalize(alias) ===
            normalized
        )
    );

    if (match) {
      return match;
    }

    return null;
  }

  /**
   * Resolve an Arc or create one if it
   * does not already exist.
   */
  static async resolveOrCreateArc(
    candidate = ""
  ) {

    const existing =
      await this.resolveArc(
        candidate
      );

    if (existing) {
      return existing;
    }

    return ArcRegistryManager.createArc(
      createArcMemory({
        name: candidate
      })
    );
  }

  /**
   * Safely add an alias.
   */
  static async addAlias(
    arcId,
    alias
  ) {

    if (!alias) {
      return null;
    }

    const arc =
      await ArcRegistryManager.getArcById(
        arcId
      );

    if (!arc) {
      return null;
    }

    const aliases = [
      ...(arc.aliases || [])
    ];

    const exists = aliases.some(
      existingAlias =>
        this.normalize(existingAlias) ===
        this.normalize(alias)
    );

    if (!exists) {
      aliases.push(alias);
    }

    return ArcRegistryManager.updateArc(
      arcId,
      {
        aliases
      }
    );
  }

  /**
   * Normalize strings before comparison.
   */
  static normalize(
    value = ""
  ) {

    return String(value)
      .trim()
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .replace(/\s+/g, " ");
  }

  /**
   * Debug helper.
   */
  static async debugResolve(
    candidate
  ) {

    const result =
      await this.resolveArc(
        candidate
      );

    console.group(
      "[AI Director] Arc Resolution Debug"
    );

    console.log(
      "Candidate:",
      candidate
    );

    console.log(
      "Resolved Arc:",
      result
    );

    console.groupEnd();

    return result;
  }
}

/**
 * Debug Exposure
 */
if (typeof window !== "undefined") {

  window.AIDirector =
    window.AIDirector || {};

  window.AIDirector.ArcResolutionManager =
    ArcResolutionManager;
}