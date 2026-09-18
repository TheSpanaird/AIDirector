// modules/ai-director/scripts/simulation/faction-manager.js

/**
 * Universal System-Agnostic Faction & Tension Simulation Engine
 */
export class FactionManager {
  static SETTING_KEY = "faction-registry";

  /**
   * Initializes or fetches the global faction data map from world settings.
   */
  static getRegistry() {
    if (typeof game === "undefined") return [];
    return game.settings.get("ai-director", this.SETTING_KEY) || [];
  }

  /**
   * Commits a faction array state safely back to the database.
   */
  static async saveRegistry(registry) {
    if (!game.user.isGM) return;
    await game.settings.set("ai-director", this.SETTING_KEY, registry);
    
    // 🛠️ FIXED: Standardized lookup path across old Application and modern ApplicationV2 instances
    const app = Object.values(foundry.applications.instances).find(
      w => w.id === "ai-director-app" || w.options?.id === "ai-director-app"
    );
    if (app) app.render(true);
  }

  /**
   * Registers a completely new political/corporate entity into the sandbox matrix.
   * Enhanced to seamlessly append emergent factions found during play.
   */
  static async registerFaction(id, name, data = {}) {
    const registry = this.getRegistry();
    
    // 🛠️ FIXED: Clean string spacing into a safe database ID format BEFORE running duplication checks
    const sanitizedId = id.toLowerCase().replace(/[^a-z0-9]/g, "_");
    
    // Safeguard against duplicate registration overrides using the finalized key
    if (registry.some(f => f.id === sanitizedId)) {
      console.log(`AI Director | Faction Engine: Faction ID "${sanitizedId}" already exists. Skipping creation.`);
      return;
    }

    const newFaction = {
      id: sanitizedId,
      name: name,
      tier: data.tier || "minor", // 'major', 'minor', 'micro'
      influence: data.influence ?? 15, // Emergent factions usually start localized and small
      aggression: data.aggression ?? 30,
      hostilityToParty: data.hostilityToParty ?? 0, // Neutral ground starting point
      description: data.description || "An emergent group active within the region."
    };

    registry.push(newFaction);
    await this.saveRegistry(registry);
    
    // Visually flag the GM and players that the world simulation just expanded
    ui.notifications.info(`🌌 **Emergent Force Active**: The AI Director has manifested a new group in your logs: "${name}".`);
    
    // Execute global hooks for secondary modules to intercept
    Hooks.callAll("aiDirectorFactionCreated", newFaction);
  }

  /**
   * Modifies faction parameters dynamically following a plot event or prompt trigger.
   */
  static async adjustFactionMetrics(factionId, shifts = {}) {
    if (!game.user.isGM) return;
    
    const registry = this.getRegistry();
    // Match against the safe sanitized key variation natively
    const sanitizedId = factionId.toLowerCase().replace(/[^a-z0-9]/g, "_");
    const faction = registry.find(f => f.id === sanitizedId);

    if (!faction) {
      console.warn(`AI Director | Faction Engine: Attempted to shift metrics for non-existent faction: ${factionId}`);
      return;
    }

    // Apply generic shift math with strict clamps between 0 and 100
    if (shifts.influence !== undefined) faction.influence = Math.clamped(faction.influence + shifts.influence, 0, 100);
    if (shifts.aggression !== undefined) faction.aggression = Math.clamped(faction.aggression + shifts.aggression, 0, 100);
    if (shifts.hostilityToParty !== undefined) faction.hostilityToParty = Math.clamped(faction.hostilityToParty + shifts.hostilityToParty, 0, 100);

    await this.saveRegistry(registry);
    
    ui.notifications.info(`🌌 **World State Shift**: Influence changes detected within the region for "${faction.name}".`);
    Hooks.callAll("aiDirectorFactionUpdated", faction, shifts);
  }
}