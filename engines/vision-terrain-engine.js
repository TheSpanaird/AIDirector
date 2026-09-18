// modules/ai-director/scripts/engines/vision-terrain-engine.js

import { MODULE_ID } from "/modules/ai-director/scripts/settings.js";

/**
 * AI DIRECTOR VISION & TERRAIN ENGINE (Phase 4)
 * Parses vision masks/terrain zones, creates dynamic environmental MATT triggers,
 * and coordinates terrain-aware entity spawning.
 */
export class VisionTerrainEngine {

  /**
   * Applies all terrain zones and vision masks defined in a sector to the active scene.
   * @param {Object} sector - Manifest sector object.
   * @param {Scene} scene - Target Foundry Scene.
   */
  static async applySectorTerrain(sector, scene = canvas.scene) {
    if (!game.user.isGM || !sector || !sector.terrainZones || !scene) return;

    const sectorX = sector.bounds?.x || 0;
    const sectorY = sector.bounds?.y || 0;

    for (const zone of sector.terrainZones) {
      const worldBounds = {
        x: sectorX + (zone.bounds.x || 0),
        y: sectorY + (zone.bounds.y || 0),
        width: zone.bounds.width || 200,
        height: zone.bounds.height || 200
      };

      // 1. Create Scene Region for Environmental Rules
      await this.createTerrainRegion(zone, worldBounds, scene);

      // 2. Attach MATT Trigger Tile for Movement/Hazards
      await this.placeTerrainTriggerTile(zone, worldBounds, scene);
    }
  }

  /**
   * Creates a Foundry v13 Region for difficult terrain or cover.
   */
  static async createTerrainRegion(zone, bounds, scene) {
    const regionName = `Terrain: ${zone.type} (${zone.modifier || "default"})`;

    const regionData = {
      name: regionName,
      color: zone.type === "waterZone" ? "#0088ff" : zone.type === "coverZone" ? "#888888" : "#ff4400",
      shapes: [{
        type: "rectangle",
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        rotation: 0
      }],
      flags: {
        [MODULE_ID]: {
          terrainType: zone.type,
          modifier: zone.modifier
        }
      }
    };

    return await scene.createEmbeddedDocuments("Region", [regionData]);
  }

  /**
   * Section 4.3: Programmatically places a MATT tile over terrain zones.
   */
  static async placeTerrainTriggerTile(zone, bounds, scene) {
    let macroCommand = "";

    if (zone.type === "waterZone" || zone.modifier === "difficult_terrain") {
      macroCommand = `
        if (token) {
          ui.notifications.info(token.name + " entered Difficult Terrain (" + "${zone.type}" + "). Movement speed halved.");
        }
      `;
    } else if (zone.modifier === "hazard_damage") {
      macroCommand = `
        if (token && game.user.isGM) {
          ui.notifications.warn(token.name + " entered Hazard Zone! Roll 1d6 damage.");
        }
      `;
    }

    const tileData = {
      name: `MATT Zone: ${zone.type}`,
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      hidden: true,
      locked: false,
      flags: {
        "monks-active-tiles": {
          active: true,
          record: "all",
          restriction: "all",
          trigger: "enter",
          allowdead: false,
          chance: 100,
          actions: macroCommand ? [
            {
              action: "runmacro",
              data: {
                macroid: "",
                runasgm: true,
                command: macroCommand
              }
            }
          ] : []
        },
        [MODULE_ID]: {
          isTerrainTile: true,
          zoneType: zone.type
        }
      }
    };

    return await scene.createEmbeddedDocuments("Tile", [tileData]);
  }

  /**
   * Section 4.3: Calculates optimal coordinates for spawning entities based on terrain roles.
   * - Aquatic/Amphibious entities spawn inside waterZone.
   * - Snipers/Ranged attackers spawn inside coverZone.
   * - Standard entities spawn in normal open space.
   * 
   * @param {Object} sector - Bounded sector object.
   * @param {string} actorName - Name or description of actor being spawned.
   * @returns {{ x: number, y: number }} Evaluated coordinate pair.
   */
  static calculateTacticalSpawnPoint(sector, actorName = "") {
    const defaultX = sector.bounds.x + Math.floor(sector.bounds.width / 2);
    const defaultY = sector.bounds.y + Math.floor(sector.bounds.height / 2);

    if (!sector.terrainZones || sector.terrainZones.length === 0) {
      return { x: defaultX, y: defaultY };
    }

    const nameLower = actorName.toLowerCase();

    // Match amphibious/aquatic units to waterZone
    if (nameLower.includes("water") || nameLower.includes("swimmer") || nameLower.includes("ambusher") || nameLower.includes("aquatic")) {
      const waterZone = sector.terrainZones.find(z => z.type === "waterZone");
      if (waterZone) {
        return {
          x: sector.bounds.x + waterZone.bounds.x + Math.floor(waterZone.bounds.width / 2),
          y: sector.bounds.y + waterZone.bounds.y + Math.floor(waterZone.bounds.height / 2)
        };
      }
    }

    // Match ranged/snipers to coverZone
    if (nameLower.includes("sniper") || nameLower.includes("ranged") || nameLower.includes("scout") || nameLower.includes("archer")) {
      const coverZone = sector.terrainZones.find(z => z.type === "coverZone" || z.type === "cliffZone");
      if (coverZone) {
        return {
          x: sector.bounds.x + coverZone.bounds.x + Math.floor(coverZone.bounds.width / 2),
          y: sector.bounds.y + coverZone.bounds.y + Math.floor(coverZone.bounds.height / 2)
        };
      }
    }

    return { x: defaultX, y: defaultY };
  }
}