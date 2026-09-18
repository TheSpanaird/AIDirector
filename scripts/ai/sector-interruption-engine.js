// modules/ai-director/scripts/ai/sector-interruption-engine.js

import { DungeonLedgerManager } from "../data/dungeon-ledger-manager.js";
import { SectorTracker } from "../data/sector-tracker.js";

/**
 * SectorInterruptionEngine (Phase 5)
 * Intercepts high-noise events (combat start, alarms, explosions) in an origin sector
 * and broadcasts ambient sensory alerts to adjacent sectors occupied by split party members.
 */
export class SectorInterruptionEngine {

  /**
   * Broadcasts an inter-sector environmental interruption alert.
   * @param {string} originSectorId - Sector where the high-noise event occurred.
   * @param {string} eventType - Type of event ("COMBAT", "ALARM", "EXPLOSION").
   * @param {string} [customDetails=""] - Optional sensory detail.
   */
  static async broadcastSectorRipple(originSectorId, eventType, customDetails = "") {
    const manifest = DungeonLedgerManager.getActiveManifest();
    if (!manifest || !manifest.sectors) return;

    const originSector = manifest.sectors.find(s => s.sectorId === originSectorId);
    if (!originSector) return;

    // Resolve adjacent connected sectors
    const adjacentIds = Array.isArray(originSector.adjacentSectors) 
      ? originSector.adjacentSectors 
      : (originSector.adjacentSectors || "").split(",").map(s => s.trim());

    // Check party distribution across sectors
    const partyDist = SectorTracker.getPartySectorDistribution();

    // Notify split party members in adjacent sectors
    for (const [sectorId, tokens] of partyDist.entries()) {
      if (adjacentIds.includes(sectorId)) {
        const tokenNames = tokens.map(t => t.name).join(", ");
        const alertMessage = this._formatRippleText(eventType, originSector.name, customDetails);

        ui.notifications.warn(`AI Director [Environmental Interruption]: Alerting tokens in adjacent sector...`);

        await ChatMessage.create({
          user: game.user.id,
          speaker: { alias: "AI Director (Environmental Echo)" },
          content: `<div class="ai-director-ripple-card" style="border-left: 3px solid #ff4a4a; padding: 8px; background: rgba(255,0,0,0.05);">
            <strong>⚠️ Environmental Ripple Notice (${tokenNames}):</strong><br/>
            ${alertMessage}
          </div>`,
          style: CONST.CHAT_MESSAGE_STYLES?.OTHER || 0
        });
      }
    }
  }

  /**
   * Formats sensory ripple text based on event severity.
   * @private
   */
  static _formatRippleText(eventType, originName, details) {
    switch (eventType) {
      case "COMBAT":
        return `Echoing gunshots, clashing metal, and raised voices erupt from the adjacent corridor leading toward <strong>${originName}</strong>! ${details}`;
      case "ALARM":
        return `Red klaxons flash along the ceiling and high-pitched security sirens wail from <strong>${originName}</strong>! ${details}`;
      case "EXPLOSION":
        return `A heavy shockwave rattles the floor plates as a loud detonation detonates in <strong>${originName}</strong>! ${details}`;
      default:
        return `A sudden disturbance echoes from <strong>${originName}</strong>. ${details}`;
    }
  }
}

/**
 * Foundry Combat Hook Integration:
 * Automatically triggers an inter-sector ripple when combat starts.
 */
Hooks.on("createCombat", async (combat) => {
  if (!game.user.isGM) return;

  const activeSector = SectorTracker.getPartyActiveSector();
  await SectorInterruptionEngine.broadcastSectorRipple(activeSector, "COMBAT", "Combat tracker initiated.");
});