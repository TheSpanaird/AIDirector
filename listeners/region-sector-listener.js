// modules/ai-director/scripts/listeners/region-sector-listener.js

import { MODULE_ID } from "../settings.js";
import { SectorTracker } from "../data/sector-tracker.js";
import { MapForge } from "../ai/map-forge.js";
import { AIDirectorPanoramaForge } from "../ai/panorama-forge.js";

/**
 * RegionSectorListener
 * Binds Foundry V13+ Scene Region hooks to trigger spatial sector updates,
 * background map pre-rendering, and atmospheric panorama views.
 */
export class RegionSectorListener {

  /**
   * Evaluates whether a given point (e.g., token center) is inside a Scene Region.
   * Handles Foundry V13+ region API methods alongside document shape fallbacks.
   * @param {Region} region - The region placeable object.
   * @param {Object} point - Center point object containing {x, y}.
   * @returns {boolean} True if the point is within the region bounds.
   */
  static isPointInRegion(region, point) {
    if (!region || !point) return false;

    // 1. Native Foundry V13 Region API check
    if (typeof region.containsPoint === "function") {
      return region.containsPoint(point);
    }

    // 2. Shape-based fallback logic (rectangles/polygons)
    const shapes = region.document?.shapes || [];
    return shapes.some(shape => {
      const sx = shape.x ?? 0;
      const sy = shape.y ?? 0;
      const sw = shape.width ?? 0;
      const sh = shape.height ?? 0;

      return point.x >= sx && point.x <= sx + sw && point.y >= sy && point.y <= sy + sh;
    });
  }

  /**
   * Triggers ambient panorama generation and adjacent queueing when entering a sector.
   * @param {RegionDocument|Region} region - The crossed region.
   * @param {string} sectorId - Target sector ID.
   */
  static async handleSectorEntry(region, sectorId) {
    if (!game.user.isGM) return;

    const sectorName = region.flags?.[MODULE_ID]?.sectorName || region.name || sectorId;

    // 1. Queue background adjacent map pre-rendering if MapForge engine has that strategy available
    if (typeof MapForge.queueAdjacentMaps === "function") {
      MapForge.queueAdjacentMaps(sectorId);
    }

    // 2. Trigger Phase 3 Panorama Forge (once per region session)
    const isForged = region.getFlag ? region.getFlag(MODULE_ID, "panoramaForged") : false;
    if (!isForged) {
      if (typeof region.setFlag === "function") {
        await region.setFlag(MODULE_ID, "panoramaForged", true);
      }
      
      console.log(`[AI Director] Token entered new sector [${sectorName}]. Dispatching background panorama render...`);
      await PanoramaForge.forgeScenePanorama(null, `Entering ${sectorName}`);
    }
  }

  static register() {
    // 1. Triggered on active player region movement (Foundry V13+ Region Event)
    Hooks.on("userEnteredRegion", async (region, moveToken, user) => {
      if (user.id !== game.user.id) return;

      const sectorId = region.flags?.[MODULE_ID]?.sectorId || region.name;
      if (!sectorId) return;

      await SectorTracker.setTokenSector(moveToken, sectorId);

      // Trigger GM-side background processes (Pre-rendering & Panoramas)
      await this.handleSectorEntry(region, sectorId);
    });

    // 2. Fallback: Triggered on token drag/movement updates across the canvas
    Hooks.on("updateToken", async (tokenDoc, changes, options, userId) => {
      if (!game.user.isGM) return;
      if (!changes.x && !changes.y) return;

      const token = tokenDoc.object;
      if (!token || !canvas.ready) return;

      if (canvas.regions?.placeables) {
        for (const region of canvas.regions.placeables) {
          if (this.isPointInRegion(region, token.center)) {
            const boundSector = region.document.flags?.[MODULE_ID]?.sectorId || region.document.name;
            const currentSector = SectorTracker.getTokenSector(tokenDoc);

            if (boundSector && boundSector !== currentSector) {
              await SectorTracker.setTokenSector(tokenDoc, boundSector);
              await this.handleSectorEntry(region.document || region, boundSector);
            }
            break;
          }
        }
      }
    });

    console.log("ai-director | Region, Spatial Sector & Panorama Engine listeners successfully mounted.");
  }
}