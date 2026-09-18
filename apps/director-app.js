// modules/ai-director/apps/director-app.js

import { MODULE_ID } from "/modules/ai-director/scripts/settings.js";
import { FactionManager } from "../scripts/simulation/faction-manager.js";
import { DirectorActions } from "./director-actions.js";
import { generateDirectorCardHtml } from "/modules/ai-director/ui/chat-card-renderer.js";
import { FlagFactory, PROCESS_TYPES } from "../core/flag-factory.js";

// Backend processing strategies natively preserved
import { executeGMMode } from "../scripts/modes/gm-modes.js";
import { executeNPCChatMode } from "../scripts/modes/npc-chat.js";

// Import Intent Classifier to catch structural intents in Auto mode
import { classifyPlayerIntent } from "../scripts/prompt-factory/system-rules.js";

// Dungeon Ledger Manager Import
import { DungeonLedgerManager } from "../scripts/data/dungeon-ledger-manager.js";
import { CartographerUIController }
  from "/modules/ai-director/scripts/cartographer/cartographer-ui-controller.js";

// Scene Manager Import for Direct Mode Dispatch (Using Absolute Module Path)
import {
  executeSceneGeneration,
  executeSectorRegeneration
} from "/modules/ai-director/scripts/data/scene-manager.js";
import { LayoutProfileLibrary } from "/modules/ai-director/scripts/cartographer/layout-profile-library.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * COMBINED AI DIRECTOR INTERFACE APPLICATION
 * Native Foundry VTT v13 reactive controller managing user orchestration inputs, 
 * sidebar layout tabs, and backend mechanical execution dispatches.
 */
export class AIDirectorApp extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options = {}) {
    super(options);
    this.isStreaming = false;
    this.streamBuffer = "";
    this.isMasterRevealed = false; // Safety Blinding Toggle State
    foundry.applications.instances.set(this.id, this);
  }

  static DEFAULT_OPTIONS = {
    tag: "form",
    id: "ai-director-app",
    classes: ["ai-director-app", "sheet"], 
    window: { 
      title: "AI Director Command Center",
      icon: "fas fa-brain",
      resizable: true,
      minimizable: true
    },
    position: { width: 800, height: 600 },
    
    tabs: [
      {
        navSelector: ".director-sidebar-nav",
        contentSelector: ".content-area",
        initial: "dashboard"
      }
    ],

    actions: {
      pulse: DirectorActions.onPulse,
      recap: AIDirectorApp.#onRecapWrapper, 
      scene: AIDirectorApp.#onSceneWrapper, // 👈 Intercepts Scene Action to render Mode Selector Modal
      npc: DirectorActions.onNPC,
      clear: DirectorActions.onClear,
      "add-faction": DirectorActions.onAddFaction,
      "edit-faction": DirectorActions.onEditFaction,
      "delete-faction": DirectorActions.onDeleteFaction,
      
      "toggle-master-reveal": AIDirectorApp.#onToggleMasterReveal, // Safety Blinding Action

      "cartographer-generate": AIDirectorApp.#onCartographerGenerate,
      "cartographer-preview": AIDirectorApp.#onCartographerPreview,
      "cartographer-sync": AIDirectorApp.#onCartographerSync,
      "cartographer-rebuild": AIDirectorApp.#onCartographerRebuild,
      "cartographer-refresh": AIDirectorApp.#onCartographerRefresh,

      send: AIDirectorApp.#onSubmitIntent,
      submitIntent: AIDirectorApp.#onSubmitIntent,
      clearLog: AIDirectorApp.#onClearLog
    }
  };

  static PARTS = {
    form: {
      template: "modules/ai-director/templates/ai-director-app.hbs"
    }
  };

  static _getControlledPCToken() {
    if (!canvas.ready || !canvas.tokens?.controlled.length) return null;

    const candidateTokens = canvas.tokens.controlled.filter(t => {
      const actor = t.actor;
      if (!actor) return false;
      const isOwned = actor.isOwner;
      const isInPCFolder = actor.folder?.name === "PCs";
      return isOwned && isInPCFolder;
    });

    if (!candidateTokens.length) return null;
    return candidateTokens[candidateTokens.length - 1];
  }

  static async #onRecapWrapper(event, target) {
    await DirectorActions.onRecap(event, target);
    const appInstance = foundry.applications.instances.get("ai-director-app");
    if (appInstance?.streamBuffer) {
      const { MemoryManager } = await import("../scripts/data/memory-manager.js");
      await MemoryManager.updateNPCMemoriesFromNarrative(appInstance.streamBuffer);
    }
  }

  /**
   * Opens the Scene Scope Selection Modal before invoking Scene Generation.
   * @private
   */
  static async #onSceneWrapper(event, target) {
    event.preventDefault();

    const app = foundry.applications.instances.get("ai-director-app");
    const root = app?.element || target?.closest?.(".ai-director-app");
    const textarea = root?.querySelector("textarea[name='chat-input']");
    const streamOutput = root?.querySelector(".stream-output") || null;
    const rawPrompt = textarea?.value?.trim() || "";

    const profileOptions = LayoutProfileLibrary.list()
      .map(profile => {
        const label = `${profile.id.replaceAll("_", " ")} (${profile.family})`;
        return `<option value="${profile.id}">${label}</option>`;
      })
      .join("");

    const escapedPrompt = AIDirectorApp.#escapeDialogText(rawPrompt);
    const content = `
      <form class="ai-director-scene-dialog" style="display:grid; gap:10px; padding:6px;">
        <div class="form-group">
          <label for="director-prompt-input"><strong>Scene Directive</strong></label>
          <textarea id="director-prompt-input" rows="4" style="width:100%; resize:vertical;" placeholder="Describe the scene or facility...">${escapedPrompt}</textarea>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
          <div class="form-group">
            <label for="director-scene-scope">Scene Scope</label>
            <select id="director-scene-scope" style="width:100%;">
              <option value="single">Single Area</option>
              <option value="multi" selected>Multi-Sector</option>
            </select>
          </div>
          <div class="form-group">
            <label for="director-map-engine">Map Engine</label>
            <select id="director-map-engine" style="width:100%;">
              <option value="cartographer" selected>Cartographer</option>
              <option value="comfyUI">ComfyUI</option>
            </select>
          </div>
        </div>
        <div style="display:grid; grid-template-columns:2fr 1fr; gap:10px;">
          <div class="form-group">
            <label for="director-layout-profile">Architectural Profile</label>
            <select id="director-layout-profile" style="width:100%;">
              <option value="auto" selected>Automatic</option>
              ${profileOptions}
            </select>
          </div>
          <div class="form-group">
            <label for="director-architectural-scale">Scale</label>
            <select id="director-architectural-scale" style="width:100%;">
              <option value="auto" selected>Automatic</option>
              <option value="SMALL">Small</option>
              <option value="STANDARD">Standard</option>
              <option value="LARGE">Large</option>
              <option value="GRAND">Grand</option>
            </select>
          </div>
        </div>
        <div style="display:grid; gap:6px; padding:8px; border:1px solid var(--color-border-light-2); border-radius:4px;">
          <label><input id="director-auto-build" type="checkbox" checked> Build map automatically</label>
          <label><input id="director-render-ventilation" type="checkbox" checked> Render ventilation</label>
          <label><input id="director-clear-existing" type="checkbox" checked> Replace existing Cartographer geometry</label>
        </div>
      </form>
    `;

    const submit = async html => {
      const container = html instanceof HTMLElement ? html : html?.[0];
      const read = selector => container?.querySelector(selector);
      const options = {
        mode: read("#director-scene-scope")?.value || "multi",
        mapEngine: read("#director-map-engine")?.value || "cartographer",
        layoutProfile: read("#director-layout-profile")?.value || "auto",
        architecturalScale: read("#director-architectural-scale")?.value || "auto",
        autoBuild: read("#director-auto-build")?.checked !== false,
        renderVentilation: read("#director-render-ventilation")?.checked !== false,
        clearExisting: read("#director-clear-existing")?.checked !== false
      };
      const directive = read("#director-prompt-input")?.value?.trim() || "";
      if (textarea) textarea.value = "";
      return executeSceneGeneration(streamOutput, 0.5, app, directive, options);
    };

    const DialogV2 = foundry.applications?.api?.DialogV2;
    if (DialogV2?.wait) {
      return DialogV2.wait({
        window: { title: "AI Director | Scene Generation" },
        content,
        modal: true,
        buttons: [
          { action: "cancel", label: "Cancel" },
          {
            action: "generate",
            label: "Generate Scene",
            icon: "fas fa-clapperboard",
            default: true,
            callback: (_event, button, dialog) => submit(dialog?.element || button?.form)
          }
        ]
      });
    }

    return new Dialog({
      title: "AI Director | Scene Generation",
      content,
      buttons: {
        cancel: { label: "Cancel" },
        generate: {
          icon: '<i class="fas fa-clapperboard"></i>',
          label: "Generate Scene",
          callback: submit
        }
      },
      default: "generate"
    }).render(true);
  }

  static #escapeDialogText(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  static async #promptSectorGuidance() {
    const DialogV2 = foundry.applications.api.DialogV2;

    return await DialogV2.prompt({
      window: {
        title: "Sector Regeneration"
      },
      content: `
        <div class="form-group">
          <label>Optional player guidance</label>
          <textarea
            id="sector-guidance"
            rows="8"
            style="width:100%;">
          </textarea>
        </div>
      `,
      callback: html => {
        return html.querySelector("#sector-guidance")?.value ?? "";
      }
    });
  }

  static async #onCartographerGenerate(event, target) {
    event?.preventDefault();
    return CartographerUIController.generate(
      this,
      event || target
    );
  }

  static async #onCartographerPreview(event, target) {
    event?.preventDefault();
    return CartographerUIController.previewChanges(
      this,
      event || target
    );
  }

  static async #onCartographerSync(event, target) {
    event?.preventDefault();
    return CartographerUIController.synchronize(
      this,
      event || target
    );
  }

  static async #onCartographerRebuild(event, target) {
    event?.preventDefault();
    return CartographerUIController.rebuild(
      this,
      event || target
    );
  }

  static async #onCartographerRefresh(event, target) {
    event?.preventDefault();
    return CartographerUIController.refresh(this);
  }

  /**
   * Toggles the GM Master Reveal Blinding Overlay.
   * @private
   */
  static #onToggleMasterReveal(event, target) {
    this.isMasterRevealed = !this.isMasterRevealed;
    this.render(false);
  }

  _onRender(context, options) {
    super._onRender(context, options);

    // PASS 5: Dungeon Ledger inline edit binding.
    // Connects .sector-inline-field changes to DungeonLedgerManager.updateSectorField(...).
    const ledgerRoot = this.element || this._element || document.querySelector("#ai-director-app");
    if (ledgerRoot && !ledgerRoot.dataset.ledgerInlineBound) {
      ledgerRoot.dataset.ledgerInlineBound = "true";
      ledgerRoot.addEventListener("change", async event => {
        const field = event.target?.closest?.(".sector-inline-field");
        if (!field) return;

        const card = field.closest(".sector-card");
        const sectorId = card?.dataset?.sectorId;
        const fieldName = field.dataset.field;
        if (!sectorId || !fieldName) return;

        const value = field.type === "checkbox" ? field.checked : field.value;

        try {
          const { DungeonLedgerManager } = await import("/modules/ai-director/scripts/data/dungeon-ledger-manager.js");
          const updated = await DungeonLedgerManager.updateSectorField(sectorId, fieldName, value);
          if (updated) this.render(false);
        } catch (error) {
          console.error("AI Director | Ledger inline field update failed:", error);
          ui.notifications?.error?.("AI Director | Ledger update failed. See console.");
        }
      });
    }

    if (ledgerRoot && !ledgerRoot.dataset.regenerationBound) {
      ledgerRoot.dataset.regenerationBound = "true";

      ledgerRoot.addEventListener("click", async event => {
        const regenButton = event.target.closest(".sector-regenerate-btn");

        if (regenButton) {
          const sectorId = regenButton.dataset.sectorId;

          try {
            await executeSectorRegeneration({
              sectorId,
              mode: "CONTENT_AND_PROMPTS"
            });
            this.render(false);
          } catch (error) {
            console.error("AI Director | EN-17 failed.", error);
            ui.notifications.error("Sector regeneration failed.");
          }

          return;
        }

        const guidedButton = event.target.closest(".sector-regenerate-guided-btn");

        if (guidedButton) {
          const sectorId = guidedButton.dataset.sectorId;

          const manualGuidance = await AIDirectorApp.#promptSectorGuidance();

          if (manualGuidance === null) {
            return;
          }

          try {
            await executeSectorRegeneration({
              sectorId,
              mode: "CONTENT_AND_PROMPTS",
              manualGuidance
            });
            this.render(false);
          } catch (error) {
            console.error("AI Director | EN-17 guided regeneration failed.", error);
            ui.notifications.error("Sector regeneration failed.");
          }
        }
      });
    }

    const cartographerPanel =
      this.element.querySelector("[data-cartographer-panel]");

    if (cartographerPanel) {
      const floorStyleFields = new Set([
        "cartographerAssignmentMode",
        "cartographerGenre",
        "cartographerFloorPreset",
        "cartographerTextureScale",
        "cartographerOutlineWidth",
        "cartographerOutlineColor",
        "cartographerOutlineEnabled",
        "cartographerShowAllFloors"
      ]);

      cartographerPanel.addEventListener(
        "change",
        async event => {
          const field = event.target;
          if (!floorStyleFields.has(field?.name)) return;

          try {
            await CartographerUIController.applyFloorStyleChange(
              this,
              cartographerPanel
            );
          } catch (error) {
            console.error(
              "ai-director | Floor style update failed.",
              error
            );
            ui.notifications.error(
              `Cartographer: ${error?.message || error}`
            );
          }
        }
      );
    }

    // ---- 1. Tab Click Navigation UI Logic ----
    this.element.querySelectorAll(".nav-item").forEach(nav => {
      nav.addEventListener("click", (event) => {
        event.preventDefault();
        const tabName = event.currentTarget.dataset.tab;
        if (!tabName) return;

        this.element.querySelectorAll(".nav-item, .tab").forEach(el => el.classList.remove("active"));
        event.currentTarget.classList.add("active");
        this.element.querySelector(`.tab[data-tab="${tabName}"]`)?.classList.add("active");

        game.settings.set(MODULE_ID, "lastActiveTab", tabName);
      });
    });

    const savedTab = game.settings.get(MODULE_ID, "lastActiveTab") || "dashboard";
    this.element.querySelectorAll(".nav-item, .tab").forEach(el => el.classList.remove("active"));

    const initialNav = this.element.querySelector(`.nav-item[data-tab="${savedTab}"]`);
    const initialTab = this.element.querySelector(`.tab[data-tab="${savedTab}"]`);

    if (initialNav && initialTab) {
      initialNav.classList.add("active");
      initialTab.classList.add("active");
    }

    // ---- 2. Sector Inline Editor Real-Time Change Listeners ----
    this.element.querySelectorAll(".sector-inline-field").forEach(input => {
      input.addEventListener("change", async (event) => {
        const target = event.target;
        const card = target.closest(".sector-card");
        const sectorId = card?.dataset.sectorId;
        const fieldName = target.dataset.field;
        const newValue = target.value.trim();

        if (sectorId && fieldName) {
          await DungeonLedgerManager.updateSectorField(sectorId, fieldName, newValue);
        }
      });
    });

    // ---- 3. Live Chaos Matrix Slider Listeners ----
    const chaosPanel = this.element.querySelector(".chaos-control-panel");
    if (chaosPanel) {
      chaosPanel.addEventListener("change", async (event) => {
        const input = event.target;
        if (input.classList.contains("relation-slider")) {
          const settingName = input.name;
          const newValue = Number(input.value);
          await game.settings.set(MODULE_ID, settingName, newValue);
          
          const feedbackText = input.closest(".slider-container").querySelector(".slider-percentage");
          if (feedbackText) {
            feedbackText.textContent = settingName === "chaosFactor" ? newValue : `${newValue}%`;
          }
        }
      });

      chaosPanel.addEventListener("input", (event) => {
        const input = event.target;
        if (input.classList.contains("relation-slider")) {
          const feedbackText = input.closest(".slider-container").querySelector(".slider-percentage");
          if (feedbackText) {
            feedbackText.textContent = input.name === "chaosFactor" ? input.value : `${input.value}%`;
          }
        }
      });
    }

    // ---- 4. Action Panel Auto-scrolling & Shortcuts ----
    const outputPanel = this.element.querySelector(".stream-output");
    if (outputPanel) {
      outputPanel.scrollTop = outputPanel.scrollHeight;
    }

    const textarea = this.element.querySelector("textarea[name='chat-input']") || this.element.querySelector(".prompt-textarea");
    if (textarea) {
      textarea.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          this.element.querySelector("[data-action='send']")?.click();
        }
      });
    }

    // ---- 5. Conditional Action Modifiers Panel Toggle ----
    const modeSelect = this.element.querySelector("select[name='mode']");
    const modifiersPanel = this.element.querySelector(".director-action-modifiers");
    
    if (modeSelect && modifiersPanel) {
      const togglePanelVisibility = () => {
        const selectedMode = modeSelect.value?.toLowerCase().replace(/[^a-z]/g, "") || "";
        const shouldShowModifiers = selectedMode === "skillcheck" || selectedMode === "contestedroll";
        
        if (shouldShowModifiers) {
          modifiersPanel.removeAttribute("hidden");
        } else {
          modifiersPanel.setAttribute("hidden", "");
        }
      };
      togglePanelVisibility();
      modeSelect.addEventListener("change", togglePanelVisibility);
    }

    // ---- 6. Live Canvas Auto-Target Synchronizer ----
    const answerAsSelect = this.element.querySelector("select[name='answer-as']");
    if (answerAsSelect) {
      const synchronizeSelection = () => {
        const currentTarget = game.user.targets.first();
        if (!currentTarget) return;

        const matchingOption = Array.from(answerAsSelect.options).find(opt => opt.value === currentTarget.name);
        if (matchingOption) {
          answerAsSelect.value = currentTarget.name;
        }
      };

      synchronizeSelection();

      Hooks.on("targetToken", (user, token, targeted) => {
        if (user.id !== game.user.id) return;
        if (this.element && document.body.contains(this.element)) {
          const dynamicSelect = this.element.querySelector("select[name='answer-as']");
          if (dynamicSelect) {
            const freshTarget = game.user.targets.first();
            if (freshTarget) {
              const matchedOpt = Array.from(dynamicSelect.options).find(o => o.value === freshTarget.name);
              if (matchedOpt) dynamicSelect.value = freshTarget.name;
            }
          }
        }
      });
    }

    // ---- 7. Live Director Autonomous Toggle Listener ----
    const directorToggle = this.element.querySelector("#ai-director-autonomous-toggle");
    if (directorToggle) {
      directorToggle.addEventListener("change", async (event) => {
        const isChecked = event.target.checked;
        await game.settings.set(MODULE_ID, "autonomousDirector", isChecked);
        ui.notifications.info(`AI Director state set to: ${isChecked ? "ACTIVE" : "STANDBY"}`);
      });
    }
  }

  async _prepareContext(options) {
    let currentTraits = {
      dominance: 5, openness: 5, secrecy: 5, agreeableness: 5,
      restraint: 5, conscientiousness: 5, volatility: 5,
      extraversion: 5, opportunism: 5, neuroticism: 5
    };
    
    const activePCToken = AIDirectorApp._getControlledPCToken();
    const mainActor = activePCToken?.actor || game.user.character;
    
    if (mainActor) {
      const profile = mainActor.flags?.[MODULE_ID]?.profile;
      if (profile?.traits) currentTraits = profile.traits;
    }

    const answerAsOptions = ["Game Master", "AI Director", "Narrator", "Environment"];
    if (canvas.ready && canvas.tokens?.placeables) {
      const nonPCTokenNames = new Set();
      for (const token of canvas.tokens.placeables) {
        const actor = token.actor;
        if (actor && token.name) {
          const hasPlayerOwner = actor.hasPlayerOwner;
          const isInPCFolder = actor.folder?.name === "PCs";
          if (!hasPlayerOwner && !isInPCFolder) nonPCTokenNames.add(token.name);
        }
      }
      answerAsOptions.push(...Array.from(nonPCTokenNames).sort());
    }

    const enrichedFactions = FactionManager.getRegistry().map(f => ({
      ...f,
      isMajor: f.tier === "major",
      isMinor: f.tier === "minor" || !f.tier,
      isMicro: f.tier === "micro",
      sentiment: f.sentiment || "neutral",
      trust: f.trust ?? 50
    }));

    const getSettingSafe = (key, fallback) => {
      try { return game.settings.get(MODULE_ID, key); } 
      catch (e) { return fallback; }
    };

    const systemSkills = DirectorActions.getSystemSkills();

    const { getLiveUIContext } = await import("../scripts/ai/rag-ui-bridge.js");
    const ragMatrix = await getLiveUIContext();

    // Fetch active dungeon manifest for the Dungeon Ledger tab
    const activeDungeon = DungeonLedgerManager.getActiveManifest();

    const baseContext = {
      systemId: game.system.id,
      isCPR: game.system.id === "cpr" || game.system.id === "cyberpunk-red-core", 
      activeActorName: mainActor ? mainActor.name : "No Token Selected",
      isGM: game.user.isGM,
      autonomousDirector: getSettingSafe("autonomousDirector", true),
      streamBuffer: this.streamBuffer,
      isStreaming: this.isStreaming,
      isMasterRevealed: this.isMasterRevealed, // Safety Blinding Toggle Context
      activeDungeon: activeDungeon, // Dungeon Ledger Manifest Context
      chaosFactor: getSettingSafe("chaosFactor", 5),
      entropyRating: getSettingSafe("entropyRating", 35),
      instabilityIndex: getSettingSafe("instabilityIndex", 20),
      surgeThreshold: getSettingSafe("surgeThreshold", 75),
      traits: currentTraits,
      lastEvent: "Simulation active.",
      modes: ["Auto", "Question", "Yes/No", "Description", "Action", "NPC Chat", "Skill Check", "Contested Roll"],
      answerAs: answerAsOptions,
      factions: enrichedFactions,
      systemSkills: systemSkills,
      ragChunks: ragMatrix.ragChunks,
      journalEntries: ragMatrix.journalEntries
    };

    return CartographerUIController.prepareContext(
      this,
      baseContext
    );
  }

  static async #onSubmitIntent(event, target) {
    event.preventDefault();
    
    const html = this.element;
    const promptInput = html.querySelector("textarea[name='chat-input']") || html.querySelector(".prompt-textarea");
    const rawInput = promptInput?.value?.trim();

    if (!rawInput) {
      ui.notifications.warn("AI Director | Input field is blank.");
      return;
    }

    const modeSelect = html.querySelector("select[name='mode']");
    const selectedMode = modeSelect?.value?.toLowerCase().replace(/[^a-z]/g, "") || "auto";
    
    const skillOverrideSelect = html.querySelector("select[name='actionSkill']");
    const enforcedSkill = (skillOverrideSelect?.value && skillOverrideSelect.value !== "N/A") ? skillOverrideSelect.value : null;

    this.isStreaming = true;
    this.streamBuffer = `<p class="chat-line system-line"><em>Consulting central prompt matrix [Mode: ${selectedMode}]...</em></p>`;
    this.render(false);

    const pcTokenInstance = AIDirectorApp._getControlledPCToken();
    const pcActor = pcTokenInstance?.actor || game.user.character;
    const pcName = pcActor ? pcActor.name : "The Player";

    const identityEl = html.querySelector("select[name='answer-as']");
    const chosenIdentity = identityEl?.value || "Game Master";
    
    let targetActor = game.actors.contents.find(a => a.name === chosenIdentity) || null;
    const externalTargetToken = game.user.targets.first();
    
    if (!targetActor && externalTargetToken) {
      targetActor = externalTargetToken.actor;
    }

    try {
      if (promptInput) promptInput.value = "";

      this.streamBuffer = `<p class="chat-line user-line"><strong>Dispatched Request:</strong> "${rawInput}"</p>`;
      this.streamBuffer += `<p class="chat-line director-line"><strong>Director Processing...</strong></p>`;
      this.render(false);

      let requiresMechanicalRouting = selectedMode === "skillcheck" || selectedMode === "contestedroll";
      let dynamicMode = selectedMode;

      if (selectedMode === "auto") {
        const evaluation = await classifyPlayerIntent(rawInput);
        if (evaluation?.requiresRoll) {
          requiresMechanicalRouting = true;
          dynamicMode = evaluation.suggestedMode === "action" ? "skillcheck" : evaluation.suggestedMode; 
        }
      }

      if (requiresMechanicalRouting) {
        ui.notifications.info(`AI Director | Diverting straight to Flow Orchestrator...`);
        
        if (dynamicMode === "contestedroll") {
          const { ContestedOrchestrator } = await import("../scripts/engines/contested-orchestrator.js");
          await ContestedOrchestrator.requestContestedCard({
            intent: rawInput,
            actorId: pcActor?.id,
            targetActorId: targetActor?.id, 
            mode: "contestedroll",
            skill: enforcedSkill
          });
          
          this.streamBuffer += `<p class="chat-line system-line">✅ Handed off to Contested Flow Sequence engine.</p>`;
        } else {
          const { SkillCheckOrchestrator } = await import("../scripts/engines/skill-check-orchestrator.js").catch(() => ({}));
          if (SkillCheckOrchestrator?.requestChallengeCard) {
            await SkillCheckOrchestrator.requestChallengeCard({
              intent: rawInput,
              actorId: pcActor?.id,
              mode: dynamicMode,
              skill: enforcedSkill,
              checkType: "STANDARD"
            });
            this.streamBuffer += `<p class="chat-line system-line">✅ Handed off to Skill Check Sequence engine.</p>`;
          } else {
            console.warn("AI Director | SkillCheckOrchestrator missing. Falling back to standard inference.");
            requiresMechanicalRouting = false; 
          }
        }

        if (requiresMechanicalRouting) {
          this.isStreaming = false;
          this.render(false);
          return; 
        }
      }

      if (!requiresMechanicalRouting) {
        const inputCorrelationId = foundry.utils.randomID();
        const inputFlags = FlagFactory.createFlags({
          isAi: false, 
          processType: "DIRECTOR_INPUT_LOG", 
          correlationId: inputCorrelationId,
          context: {
            mode: selectedMode,
            rawPrompt: rawInput,
            addressedTo: chosenIdentity
          }
        });

        let labelTag = selectedMode.toUpperCase();
        if (selectedMode === "npcchat" && chosenIdentity) {
          labelTag = `NPC CHAT to ${chosenIdentity.toUpperCase()}`;
        }

        await ChatMessage.create({
          user: game.user.id,
          speaker: { alias: pcName, actor: pcActor?.id },
          content: `<strong>[Director Input - ${labelTag}]:</strong> ${rawInput}`,
          flags: inputFlags,
          style: CONST.CHAT_MESSAGE_STYLES?.OTHER || 0
        });
      }

      if (selectedMode === "npcchat") {
        ui.notifications.info(`AI Director | Intercepted explicit NPC Chat option. Redirecting to Actor engine...`);

        const contextData = { 
          mode: "npcchat", 
          routingSource: "explicit_ui", 
          currentOutput: this.streamBuffer, 
          journalText: "", 
          memoryText: "", 
          chatHistoryText: "" 
        };
        
        try { contextData.memoryText = game.settings.get(MODULE_ID, "worldMemory") || "None"; } catch (e) {}
        
        const chatLog = document.querySelector("#chat-log");
        if (chatLog) {
          const lines = Array.from(chatLog.querySelectorAll(".message-content"));
          contextData.chatHistoryText = lines.map(el => el.textContent.trim()).join("\n");
        }

        const generatedResponse = await executeNPCChatMode(rawInput, targetActor, chosenIdentity, contextData);

        this.streamBuffer += `<div class="chat-line response-line"><strong>${chosenIdentity}:</strong> ${generatedResponse}</div>`;
        this.isStreaming = false;
        this.render(false);
        return; 
      }

      let generatedResponse = "";
      if (targetActor) {
        generatedResponse = await executeNPCChatMode(rawInput, targetActor, chosenIdentity);
      } else {
        generatedResponse = await executeGMMode(rawInput, selectedMode, {
          userCharacterName: pcName,
          enforcedSkill: enforcedSkill
        });
      }

      this.streamBuffer += `<div class="chat-line response-line">${generatedResponse}</div>`;
      this.render(false);

      if (generatedResponse.includes("{")) {
        try {
          let cleanJson = generatedResponse.substring(generatedResponse.indexOf("{"), generatedResponse.lastIndexOf("}") + 1);
          cleanJson = cleanJson.replace(/,(\s*[\]}])/g, '$1');
          cleanJson = cleanJson.replace(/(['"])?([a-zA-Z0-9_]+)(['"])?\s*:/g, '"$2":');

          let mechanicalAnalysis = JSON.parse(cleanJson);

          const correlationId = foundry.utils.randomID();
          const cardHtml = generateDirectorCardHtml(mechanicalAnalysis, rawInput, pcName, correlationId);

          const flagPayload = FlagFactory.createFlags({
            isAi: true,
            processType: PROCESS_TYPES.MECHANICAL_RESOLUTION,
            correlationId: correlationId,
            context: {
              status: "pending_roll",
              targetValue: mechanicalAnalysis.suggestedDV || mechanicalAnalysis.suggestedDC || 14,
              targetSkill: enforcedSkill || mechanicalAnalysis.skill,
              challengeContext: rawInput
            }
          });

          await ChatMessage.create({
            user: game.user.id,
            speaker: { alias: "AI Director" },
            content: cardHtml,
            flags: flagPayload,
            style: CONST.CHAT_MESSAGE_STYLES?.OTHER || 0
          });
        } catch (jsonErr) {
          console.warn("AI Director | Guardrail intercepted malformed JSON mechanics. Treating response as pure narrative block.", jsonErr);
        }
      }

    } catch (err) {
      console.error("AI Director | Processing crash:", err);
      this.streamBuffer += `<p class="chat-line system-line" style="color: #ff4a4a;"><strong>[EXCEPTION]</strong> ${err.message}</p>`;
    } finally {
      this.isStreaming = false;
      this.render(false);
    }
  }

  static #onClearLog(event, target) {
    this.streamBuffer = "";
    this.render(false);
  }
}