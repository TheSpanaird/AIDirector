// modules/ai-director/apps/player-scene-injector.js
import { executeSceneGeneration } from "../scripts/data/scene-manager.js";
import { OllamaClient } from "../scripts/api/ollama-client.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Modern ApplicationV2 UI Console for manual player-generated scene injection.
 * Enforces strict cutting contracts for Feature Loop 2.
 */
export class PlayerSceneInjector extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options = {}) {
    super(options);
  }

  static DEFAULT_OPTIONS = {
    id: "ai-director-player-scene-injector",
    title: "AI Director: Inject Player-Generated Scene",
    classes: ["ai-director", "scene-injector-window"],
    tag: "form",
    window: {
      frame: true,
      resizable: true,
      minimizable: true,
      icon: "fas fa-theater-masks"
    },
    position: {
      width: 550,
      height: "auto"
    },
    form: {
      submitOnChange: false,
      closeOnSubmit: true
    }
  };

  static PARTS = {
    form: {
      template: "modules/ai-director/templates/player-scene-injector.hbs"
    }
  };

  /** @override */
  async _prepareContext(options) {
    return {
      defaultNpcJson: JSON.stringify([{
        npcName: "Station Master Calvin",
        npcRole: "Former member of the Reckoner gang... Talks like Wilford Brimley.",
        species: "Human"
      }], null, 2)
    };
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    // Bind submission click event
    this.element.addEventListener("submit", this._onFormSubmit.bind(this));
  }

  /**
   * Processes form extraction and feeds the unified structural payload to the scene manager
   */
  async _onFormSubmit(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    
    const gmNotes = formData.get("gmNotes")?.trim() || "No core details established.";
    const npcJson = formData.get("npcJson")?.trim() || "[]";
    const playerScene = formData.get("playerScene")?.trim() || "No scene description established.";

    // Validate NPC JSON blocks to prevent pipeline syntax throws
    let parsedNpcs = [];
    try {
      parsedNpcs = JSON.parse(npcJson);
    } catch (e) {
      ui.notifications.error("AI Director | Invalid NPC JSON format! Please check your syntax.");
      return;
    }

    // Build the structural cut lines match target
    const compiledPayload = [
      `GM NOTES:`,
      gmNotes,
      `NPC GENERATION LIST: ${JSON.stringify(parsedNpcs)}`,
      `PLAYER SCENE:`,
      playerScene
    ].join("\n\n");

    ui.notifications.info("AI Director | Running custom scene pipeline layout logs...");

    try {
      const mockStream = document.createElement("div");
      const originalGenerate = OllamaClient.generate;

      // Temporarily intercept local model generation loops
      OllamaClient.generate = async () => compiledPayload;

      // Force-feed into execution loop (Chaos factor default: 5)
      await executeSceneGeneration(mockStream, 5, this);

      // Restore baseline model behaviors immediately
      OllamaClient.generate = originalGenerate;
      ui.notifications.success("AI Director | Player scene processed and archived!");
    } catch (err) {
      ui.notifications.error("AI Director | Failed to inject player scene components.");
      console.error(err);
    }
  }
}