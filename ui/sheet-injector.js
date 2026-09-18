// modules/ai-director/scripts/ui/sheet-injector.js

import { buildDefaultNPCProfile } from "../scripts/ai/npc-profile-builder.js";
import { MODULE_ID } from "../scripts/settings.js";

Hooks.on("renderActorSheet", async (app, html, data) => {
  // Prevent the injector from running on your AI Director app window
  if (app.id === "ai-director-app") return; 

  const actor = app.actor;  
  if (!actor) return;
  
  // 1. Safety Guard: Only inject into standard NPC sheets
  const pcFolder = game.folders.find(f => f.name === "PCs" && f.type === "Actor"); 
  if (pcFolder && actor.folder?.id === pcFolder.id) return; 
  if (actor.type === "character" || actor.type === "Player") return; 

  // 2. Safely capture cached document data layers synchronously to prevent lockups
  let profile = actor.flags?.[MODULE_ID]?.profile; 
  if (!profile) {
    profile = buildDefaultNPCProfile(actor); 
    await actor.setFlag(MODULE_ID, "profile", profile); 
  }

  const traits = profile.traits || { dominance: 5, restraint: 5, secrecy: 5, volatility: 5 }; 
  const speech = profile.speechStyle || { tone: "Neutral", sentenceLength: "Medium", vocabulary: "Standard", quirks: "None" }; 
  const currentMemory = actor.flags?.[MODULE_ID]?.profile?.["recap-notes"] || "";

  // 3. Construct the HTML Slider Dashboard Panel
  const injectorHtml = `
  <div class="ai-director-sheet-panel" style="margin-top: 10px; border: 1px solid #7a7975; border-radius: 5px; background: rgba(0, 0, 0, 0.4); padding: 10px;">
    <h3 style="border-bottom: 1px solid #7a7975; padding-bottom: 3px; margin-bottom: 8px; color: #ffbc00; font-family: 'Signika', sans-serif; font-size: 14px;">
      <i class="fas fa-brain"></i> AI Director Diagnostics
    </h3>
    
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px;">
      <div style="display: flex; flex-direction: column; gap: 2px;">
        <label style="font-size: 11px; font-weight: bold; display: flex; justify-content: space-between;">
          <span>Dominance / Aggression</span> <span class="val-display" id="val-dominance" style="color: #ffbc00;">${traits.dominance}</span>
        </label>
        <input type="range" class="ai-trait-slider" data-trait="dominance" min="1" max="9" value="${traits.dominance}" style="width: 100%; margin: 0;">
      </div>
      
      <div style="display: flex; flex-direction: column; gap: 2px;">
        <label style="font-size: 11px; font-weight: bold; display: flex; justify-content: space-between;">
          <span>Restraint / Control</span> <span class="val-display" id="val-restraint" style="color: #ffbc00;">${traits.restraint}</span>
        </label>
        <input type="range" class="ai-trait-slider" data-trait="restraint" min="1" max="9" value="${traits.restraint}" style="width: 100%; margin: 0;">
      </div>

      <div style="display: flex; flex-direction: column; gap: 2px;">
        <label style="font-size: 11px; font-weight: bold; display: flex; justify-content: space-between;">
          <span>Secrecy / Guardedness</span> <span class="val-display" id="val-secrecy" style="color: #ffbc00;">${traits.secrecy}</span>
        </label>
        <input type="range" class="ai-trait-slider" data-trait="secrecy" min="1" max="9" value="${traits.secrecy}" style="width: 100%; margin: 0;">
      </div>

      <div style="display: flex; flex-direction: column; gap: 2px;">
        <label style="font-size: 11px; font-weight: bold; display: flex; justify-content: space-between;">
          <span>Volatility / Instability</span> <span class="val-display" id="val-volatility" style="color: #ffbc00;">${traits.volatility}</span>
        </label>
        <input type="range" class="ai-trait-slider" data-trait="volatility" min="1" max="9" value="${traits.volatility}" style="width: 100%; margin: 0;">
      </div>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin-bottom: 10px;">
      <div style="display: flex; align-items: center; gap: 5px;">
        <label style="font-size: 11px; white-space: nowrap; width: 45px;">Tone:</label>
        <input type="text" class="ai-speech-input" data-field="tone" value="${speech.tone}" style="height: 22px; font-size: 11px;">
      </div>
      <div style="display: flex; align-items: center; gap: 5px;">
        <label style="font-size: 11px; white-space: nowrap; width: 45px;">Cadence:</label>
        <input type="text" class="ai-speech-input" data-field="sentenceLength" value="${speech.sentenceLength}" style="height: 22px; font-size: 11px;" placeholder="e.g. Short, Curt">
      </div>
      <div style="display: flex; align-items: center; gap: 5px;">
        <label style="font-size: 11px; white-space: nowrap; width: 45px;">Vocab:</label>
        <input type="text" class="ai-speech-input" data-field="vocabulary" value="${speech.vocabulary}" style="height: 22px; font-size: 11px;" placeholder="e.g. Slang, Formal">
      </div>
      <div style="display: flex; align-items: center; gap: 5px;">
        <label style="font-size: 11px; white-space: nowrap; width: 45px;">Quirk:</label>
        <input type="text" class="ai-speech-input" data-field="quirks" value="${speech.quirks}" style="height: 22px; font-size: 11px;" placeholder="e.g. Stutters, Grunts">
      </div>
    </div>

    <div class="ai-director-memory-section" style="border-top: 1px dashed #7a7975; padding-top: 8px; margin-top: 8px;">
      <label style="font-size: 11px; font-weight: bold; display: block; margin-bottom: 4px; color: #ffbc00;">
        <i class="fas fa-history"></i> AI Director Memory Ledger (Recap Notes)
      </label>
      <textarea 
        class="ai-memory-inspector" 
        style="width: 100%; min-height: 60px; font-family: monospace; font-size: 11px; background: rgba(0, 0, 0, 0.6); color: #fff; border: 1px solid #555; border-radius: 3px; padding: 4px; resize: vertical;"
        placeholder="No historical data streams extracted for this unit."
      >${currentMemory}</textarea>
    </div>
  </div>`; 

  // 4. Safely append our dashboard to the sheet's DOM layout window natively
  const rootEl = html.length ? html[0] : html;
  const targetContainer = rootEl.querySelector('.sheet-body, form, [data-tab="biography"]'); 
  
  if (!targetContainer) return;

  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = injectorHtml.trim();
  const panelElement = tempDiv.firstElementChild;
  targetContainer.appendChild(panelElement); 

  // 5. Active Event Listeners: Live Matrix Flag Syncing using Vanilla Delegation
  panelElement.querySelectorAll(".ai-trait-slider").forEach(slider => {
    slider.addEventListener("input", async (e) => {
      const trait = e.target.dataset.trait; 
      const value = parseInt(e.target.value, 10) || 5; 
      
      const displayEl = panelElement.querySelector(`#val-${trait}`); 
      if (displayEl) displayEl.textContent = value; 

      const currentProfile = actor.flags?.[MODULE_ID]?.profile || buildDefaultNPCProfile(actor); 
      if (!currentProfile.traits) currentProfile.traits = {}; 
      currentProfile.traits[trait] = value; 
      
      await actor.setFlag(MODULE_ID, "profile", currentProfile); 
    });
  });

  panelElement.querySelectorAll(".ai-speech-input").forEach(inputEl => {
    inputEl.addEventListener("change", async (e) => {
      const field = e.target.dataset.field; 
      const value = e.target.value.trim() || "None"; 

      const currentProfile = actor.flags?.[MODULE_ID]?.profile || buildDefaultNPCProfile(actor); 
      if (!currentProfile.speechStyle) currentProfile.speechStyle = {}; 
      currentProfile.speechStyle[field] = value; 

      await actor.setFlag(MODULE_ID, "profile", currentProfile); 
    });
  });

  const memoryInspector = panelElement.querySelector(".ai-memory-inspector");
  if (memoryInspector) {
    memoryInspector.addEventListener("change", async (e) => {
      await actor.setFlag(MODULE_ID, "profile.recap-notes", e.target.value.trim());
      ui.notifications.info(`AI Director | Log modifications updated for ${actor.name}`);
    });
  }
});