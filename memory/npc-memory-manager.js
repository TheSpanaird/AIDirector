// modules/ai-director/scripts/memory/npc-memory-manager.js

import {
  getOrInitializeProfile
} from "../ai/npc-profile-builder.js";

/**
 * AI Director 2.x
 *
 * NPC Memory Manager
 *
 * PURPOSE
 *
 * Owns:
 * - Facts
 * - Obligations
 * - Important Events
 * - Known Locations
 *
 * Stored in:
 *
 * actor.flags.ai-director.profile.memory
 *
 * This manager performs:
 * - Reads
 * - Writes
 * - Deduplication
 * - Metadata updates
 *
 * It does NOT:
 * - Call AI
 * - Perform retrieval
 * - Build prompts
 * - Modify Narrative Director
 */

export class NPCMemoryManager {

  static async resolveByName(
    npcName
  ) {

    const query =
      String(npcName || "")
        .toLowerCase();

    return game.actors.contents.find(
      actor =>
        actor.name
          .toLowerCase()
          .includes(query)
    ) || null;

  }

  /**
   * Fetch profile safely.
   */
  static async getProfile(actor) {

    if (!actor) {
      return null;
    }

    return getOrInitializeProfile(actor);
  }

  /**
   * Persist profile safely.
   */
  static async saveProfile(
    actor,
    profile
  ) {

    if (!actor || !profile) {
      return;
    }

    await actor.setFlag(
      "ai-director",
      "profile",
      profile
    );
  }

  /**
   * Ensures memory structure exists.
   */
  static ensureMemory(profile) {

    profile.memory ??= {
      facts: [],
      obligations: [],
      importantEvents: [],
      knownLocations: [],

      metadata: {
        lastUpdated: "",
        memoryVersion: 1
      }
    };

    profile.memory.metadata ??= {
      lastUpdated: "",
      memoryVersion: 1
    };

    return profile.memory;
  }

  /**
   * Updates metadata.
   */
  static touch(memory) {

    memory.metadata.lastUpdated =
      new Date().toISOString();

    memory.metadata.memoryVersion ??= 1;
  }

  /**
   * Normalize comparisons.
   */
  static normalize(value = "") {

    return String(value)
      .trim()
      .toLowerCase();
  }

  /**
   * Duplicate-safe insertion.
   */
  static addUnique(
    collection,
    value
  ) {

    if (!value) {
      return false;
    }

    const exists = collection.some(
      entry =>
        this.normalize(entry) ===
        this.normalize(value)
    );

    if (exists) {
      return false;
    }

    collection.push(value);

    return true;
  }

  /**
   * -----------------------------------
   * FACTS
   * -----------------------------------
   */

  static async addFact(
    actor,
    fact
  ) {

    const profile =
      await this.getProfile(actor);

    if (!profile) {
      return false;
    }

    const memory =
      this.ensureMemory(profile);

    const added =
      this.addUnique(
        memory.facts,
        fact
      );

    if (!added) {
      return false;
    }

    this.touch(memory);

    await this.updateImportance(
      actor,
      1
    );

    await this.saveProfile(
      actor,
      profile
    );

    return true;
  }

  /**
   * -----------------------------------
   * OBLIGATIONS
   * -----------------------------------
   */

  static async addObligation(
    actor,
    obligation
  ) {

    const profile =
      await this.getProfile(actor);

    if (!profile) {
      return false;
    }

    const memory =
      this.ensureMemory(profile);

    const added =
      this.addUnique(
        memory.obligations,
        obligation
      );

    if (!added) {
      return false;
    }

    this.touch(memory);

    await this.updateImportance(
      actor,
      2
    );

    await this.saveProfile(
      actor,
      profile
    );

    return true;
  }

  /**
   * -----------------------------------
   * IMPORTANT EVENTS
   * -----------------------------------
   */

  static async addImportantEvent(
    actor,
    event
  ) {

    const profile =
      await this.getProfile(actor);

    if (!profile) {
      return false;
    }

    const memory =
      this.ensureMemory(profile);

    const added =
      this.addUnique(
        memory.importantEvents,
        event
      );

    if (!added) {
      return false;
    }

    this.touch(memory);

    await this.updateImportance(
      actor,
      2
    );

    await this.saveProfile(
      actor,
      profile
    );

    return true;
  }

  /**
   * -----------------------------------
   * KNOWN LOCATIONS
   * -----------------------------------
   */

  static async addKnownLocation(
    actor,
    location
  ) {

    const profile =
      await this.getProfile(actor);

    if (!profile) {
      return false;
    }

    const memory =
      this.ensureMemory(profile);

    const added =
      this.addUnique(
        memory.knownLocations,
        location
      );

    if (!added) {
      return false;
    }

    this.touch(memory);

    await this.updateImportance(
      actor,
      1
    );

    await this.saveProfile(
      actor,
      profile
    );

    return true;
  }

  /**
   * -----------------------------------
   * IMPORTANCE
   * -----------------------------------
   */

  static async updateImportance(
    actor,
    delta = 1
  ) {

    const profile =
      await this.getProfile(actor);

    if (!profile) {
      return false;
    }

    profile.importance =
      Math.max(
        0,
        Math.min(
          20,
          (profile.importance || 5)
            + delta
        )
      );

    profile.lastPromoted =
      new Date().toISOString();

    await this.saveProfile(
      actor,
      profile
    );

    return profile.importance;
  }

  static async touchReference(
    actor
  ) {

    const profile =
      await this.getProfile(actor);

    if (!profile) {
      return false;
    }

    profile.lastReferenced =
      new Date().toISOString();

    await this.saveProfile(
      actor,
      profile
    );

    return true;
  }

  static async getImportance(
    actor
  ) {

    const profile =
      await this.getProfile(actor);

    return (
      profile?.importance || 5
    );
  }

  /**
   * -----------------------------------
   * READ
   * -----------------------------------
   */

  static async getMemory(actor) {

    const profile =
      await this.getProfile(actor);

    if (!profile) {
      return null;
    }

    return this.ensureMemory(profile);
  }

  /**
   * -----------------------------------
   * CLEAR
   * -----------------------------------
   */

  static async clearMemory(
    actor
  ) {

    const profile =
      await this.getProfile(actor);

    if (!profile) {
      return false;
    }

    profile.memory = {
      facts: [],
      obligations: [],
      importantEvents: [],
      knownLocations: [],

      metadata: {
        lastUpdated:
          new Date().toISOString(),
        memoryVersion: 1
      }
    };

    await this.saveProfile(
      actor,
      profile
    );

    return true;
  }

  /**
   * -----------------------------------
   * SEARCH
   * -----------------------------------
   */

  static async searchMemory(
    searchTerm = "",
    memoryField = "facts"
  ) {

    const normalized =
      this.normalize(searchTerm);

    if (!normalized) {
      return [];
    }

    const matches = [];

    for (const actor of game.actors.contents) {

      const profile =
        await actor.getFlag(
          "ai-director",
          "profile"
        );

      if (!profile?.memory) {
        continue;
      }

      const entries = Array.isArray(
        profile.memory[memoryField]
      )
        ? profile.memory[memoryField]
        : [];

      const found = entries.some(
        entry =>
          this.normalize(entry)
            .includes(normalized)
      );

      if (found) {

        matches.push({
          actor,
          profile,
          matchType: memoryField
        });

      }
    }

    return matches;
  }

  static async findByFact(
    searchTerm = ""
  ) {

    return this.searchMemory(
      searchTerm,
      "facts"
    );

  }

  static async findByObligation(
    searchTerm = ""
  ) {

    return this.searchMemory(
      searchTerm,
      "obligations"
    );

  }

  static async findByLocation(
    searchTerm = ""
  ) {

    return this.searchMemory(
      searchTerm,
      "knownLocations"
    );

  }

  static async findByEvent(
    searchTerm = ""
  ) {

    return this.searchMemory(
      searchTerm,
      "importantEvents"
    );

  }

  static async findRelevantNPCs(
    searchTerm = ""
  ) {

    const results = [];

    results.push(
      ...(await this.findByFact(searchTerm))
    );

    results.push(
      ...(await this.findByObligation(searchTerm))
    );

    results.push(
      ...(await this.findByLocation(searchTerm))
    );

    results.push(
      ...(await this.findByEvent(searchTerm))
    );

    const unique = new Map();

    for (const result of results) {
      unique.set(
        result.actor.id,
        result
      );
    }

    return [...unique.values()];
  }

  /**
   * -----------------------------------
   * DEBUG
   * -----------------------------------
   */

  static async audit(actor) {

    const memory =
      await this.getMemory(actor);

    console.group(
      `[AI Director] NPC Memory Audit: ${actor?.name}`
    );

    console.log(memory);

    console.groupEnd();

    return memory;
  }
}

/**
 * Debug Exposure
 */
if (typeof window !== "undefined") {

  window.AIDirector =
    window.AIDirector || {};

  window.AIDirector.NPCMemoryManager =
    NPCMemoryManager;
}