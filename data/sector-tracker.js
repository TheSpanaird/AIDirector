// modules/ai-director/scripts/data/sector-tracker.js

import { MODULE_ID } from "/modules/ai-director/scripts/settings.js";
import { DungeonLedgerManager } from "./dungeon-ledger-manager.js";

/**
 * SectorTracker (Phase 5 Updated)
 * Manages spatial location state flags per token and handles multi-sector party splits.
 */
export class SectorTracker {

  /**
   * Sets the active sector ID on a given token document/object.
   * @param {TokenDocument|Token} token - Target token or token document.
   * @param {string} sectorId - Sector ID (e.g., 'sector_01').
   */
  static async setTokenSector(token, sectorId) {
    const doc = token.document ?? token;
    if (!doc) return;

    await doc.setFlag(MODULE_ID, "activeSector", sectorId);
    console.log(`ai-director | ${doc.name} assigned to Sector [${sectorId}]`);
  }

  /**
   * Reads the active sector ID from a token document/object.
   * @param {TokenDocument|Token} token - Target token or token document.
   * @returns {string|null} Active sector ID or null.
   */
  static getTokenSector(token) {
    const doc = token.document ?? token;
    return doc?.getFlag(MODULE_ID, "activeSector") || null;
  }

  /**
   * Resolves the spatial sector specifically for the active acting user/token.
   * Supports Split Party setups where players inhabit different sectors.
   * @param {Actor|Token|null} [actingEntity=null] - Acting actor or token.
   * @returns {string} Resolved sector ID.
   */
  static getActingEntitySector(actingEntity = null) {
    // 1. Explicit token or actor parameter
    if (actingEntity) {
      const token = actingEntity.prototypeToken ? canvas.tokens?.placeables?.find(t => t.actor?.id === actingEntity.id) : actingEntity;
      const sector = this.getTokenSector(token);
      if (sector) return sector;
    }

    // 2. Currently controlled token on canvas
    if (canvas.ready && canvas.tokens?.controlled.length) {
      for (const token of canvas.tokens.controlled) {
        const sector = this.getTokenSector(token);
        if (sector) return sector;
      }
    }

    // 3. Fallback to party consensus
    return this.getPartyActiveSector();
  }

  /**
   * Returns a map of all party tokens grouped by their occupied sectors.
   * Useful for party split tracking.
   * @returns {Map<string, Array<Token>>} Map of sector ID -> Array of tokens.
   */
  static getPartySectorDistribution() {
    const distribution = new Map();

    if (canvas.ready && canvas.tokens?.placeables) {
      for (const token of canvas.tokens.placeables) {
        if (token.actor?.hasPlayerOwner) {
          const sector = this.getTokenSector(token) || "sector_01";
          if (!distribution.has(sector)) distribution.set(sector, []);
          distribution.get(sector).push(token);
        }
      }
    }

    return distribution;
  }

  /**
   * Resolves the baseline active sector for general party fallback.
   * @returns {string} Sector ID string.
   */
  static getPartyActiveSector() {
    if (canvas.ready && canvas.tokens?.controlled.length) {
      for (const token of canvas.tokens.controlled) {
        const sector = this.getTokenSector(token);
        if (sector) return sector;
      }
    }

    const manifest = DungeonLedgerManager.getActiveManifest();
    return manifest?.sectors?.[0]?.sectorId || "sector_01";
  }
}