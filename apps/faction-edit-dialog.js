// modules/ai-director/apps/faction-edit-dialog.js
import { FactionManager } from "../scripts/simulation/faction-manager.js";

const { HandlebarsApplicationMixin } = foundry.applications.api;

export class FactionEditDialog extends HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  constructor(factionData, options = {}) {
    super(options);
    this.faction = factionData;
  }

  static DEFAULT_OPTIONS = {
    tag: "form",
    id: "faction-edit-dialog",
    classes: [["ai-director-app", "sheet", "faction-editor-pop"]],
    window: {
      title: "Modify Faction Profile Matrix",
      resizable: false
    },
    position: { width: 450, height: "auto" },
    form: {
      handler: FactionEditDialog.handleFormSubmit,
      closeOnSubmit: true
    }
  };

  static PARTS = {
    content: { template: "modules/ai-director/templates/faction-edit.hbs" }
  };

  async _prepareContext(options) {
    return {
      faction: this.faction,
      tiers: [
        { value: "major", label: "Major System Force" },
        { value: "minor", label: "Minor Regional Force" },
        { value: "micro", label: "Micro Sector Cell" }
      ]
    };
  }

  static async handleFormSubmit(event, form, formData) {
    const data = formData.object;
    const registry = FactionManager.getRegistry();
    
    const index = registry.findIndex(f => f.id === data.id);
    if (index === -1) return ui.notifications.error("Faction reference expired or missing.");

    // Commit completely updated data configurations
    registry[index] = {
      id: data.id,
      name: data.name,
      tier: data.tier,
      influence: Math.clamped(Number(data.influence), 0, 100),
      aggression: Math.clamped(Number(data.aggression), 0, 100),
      hostilityToParty: Math.clamped(Number(data.hostilityToParty), 0, 100),
      description: data.description || ""
    };

    // ✅ FIXED: Pass the modified registry so settings are updated!
    // ✅ DECOUPLED: Render loops are now handled entirely by FactionManager.saveRegistry
    await FactionManager.saveRegistry(registry);
    
    ui.notifications.info(`Matrix Standing saved: ${data.name}`);
  }
}