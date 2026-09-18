import { MODULE_ID } from "/modules/ai-director/scripts/settings.js";

/**
 * AI Director - Atmosphere Engine (Task 4D.1)
 * Analyzes sensory descriptions and map context to configure scene darkness, 
 * global lighting color tinting, native weather particle effects, and ambient playlists.
 */
export class AtmosphereEngine {

  /**
   * Environmental & Mood Key Mappings using core Foundry weather keys:
   * "core.rain", "core.rainStorm", "core.fog", "core.snow", "core.blizzard", "core.leaves"
   */
  static ATMOSPHERE_PROFILES = {
    DARK_NEON: {
      darkness: 0.85,
      color: "#1a0033",
      weather: "core.rainStorm",
      filter: "cyberpunk"
    },
    INDUSTRIAL_FIRE: {
      darkness: 0.7,
      color: "#331100",
      weather: "core.fog",
      filter: "smoky"
    },
    TOXIC_HAZARD: {
      darkness: 0.6,
      color: "#0d2600",
      weather: "core.fog",
      filter: "acid"
    },
    GLOOM_DUNGEON: {
      darkness: 0.9,
      color: "#0a0a0d",
      weather: "core.fog",
      filter: "dust"
    },
    FROZEN_HAZARD: {
      darkness: 0.75,
      color: "#001a33",
      weather: "core.blizzard",
      filter: "frost"
    },
    DAYLIGHT: {
      darkness: 0.0,
      color: "#ffffff",
      weather: "",
      filter: "clear"
    }
  };

  /**
   * Analyzes text description to determine the closest match atmosphere profile
   * 
   * @param {string} sensoryText - Sensory description from LLM sector data
   * @returns {Object} Selected atmosphere profile configuration
   */
  static deriveAtmosphereFromText(sensoryText = "") {
    const text = sensoryText.toLowerCase();

    if (text.includes("snow") || text.includes("blizzard") || text.includes("ice") || text.includes("frost")) {
      return this.ATMOSPHERE_PROFILES.FROZEN_HAZARD;
    }
    if (text.includes("neon") || text.includes("rain") || text.includes("cyber") || text.includes("night")) {
      return this.ATMOSPHERE_PROFILES.DARK_NEON;
    }
    if (text.includes("fire") || text.includes("lava") || text.includes("ember") || text.includes("boiler") || text.includes("steam")) {
      return this.ATMOSPHERE_PROFILES.INDUSTRIAL_FIRE;
    }
    if (text.includes("toxic") || text.includes("acid") || text.includes("sewer") || text.includes("radiation")) {
      return this.ATMOSPHERE_PROFILES.TOXIC_HAZARD;
    }
    if (text.includes("dark") || text.includes("dungeon") || text.includes("vault") || text.includes("gloom") || text.includes("shadow")) {
      return this.ATMOSPHERE_PROFILES.GLOOM_DUNGEON;
    }

    return this.ATMOSPHERE_PROFILES.DAYLIGHT;
  }

  /**
   * Applies lighting, background color, and native weather directly to a Foundry Scene.
   * 
   * @param {Scene} scene - Target Foundry Scene document
   * @param {Object} sector - Sector data object containing sensory description
   */
  static async applyAtmosphereToScene(scene, sector = {}) {
    if (!scene) return;

    const profile = this.deriveAtmosphereFromText(sensoryTextFromSector(sector));

    console.log(`[AI Director] AtmosphereEngine: Applying '${profile.filter}' atmosphere (Weather: ${profile.weather}) to scene: ${scene.name}`);

    const updateData = {
      darkness: profile.darkness,
      backgroundColor: profile.color,
      weather: profile.weather,
      environment: {
        globalLight: {
          enabled: profile.darkness < 0.5
        }
      }
    };

    await scene.update(updateData);
  }
}

/**
 * Helper to pull sensory or name context from sector
 */
function sensoryTextFromSector(sector) {
  return `${sector.sensoryDescription || ""} ${sector.name || ""} ${sector.mapPrompt || ""}`;
}

if (typeof window !== "undefined") {
  window.AtmosphereEngine = AtmosphereEngine;
}