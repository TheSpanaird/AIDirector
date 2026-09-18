// modules/ai-director/scripts/journal/journal-hooks.js

import { autoLogSceneToJournal } from "./journal-manager.js";
import { MODULE_ID } from "../settings.js";

/**
 * Native Foundry VTT Lifecycle Hook Registrations
 * Automatically triggers Phase 6 Journal Logging without requiring GM macro input.
 */
export function registerAutomationHooks() {
  
  // ⚔️ AUTOMATION 1: End of Combat Encounter
  // Fires instantly when a combat encounter is deleted or completed from the combat tracker
  Hooks.on("deleteCombat", async (combat, options, userId) => {
    // Ensure the event process only executes once (via the primary GM user)
    if (game.user.id !== userId && !game.user.isGM) return;

    console.log("AI-Director | Combat lifecycle end detected. Initializing auto-journal extraction...");
    
    const encounterName = combat.scene?.name || "Unknown Skirmish Location";
    const contextOptions = {
      currentOutput: `Combat Encounter Concluded at: ${encounterName}`,
      systemSetting: game.settings.get(MODULE_ID, "systemType") || "generic"
    };

    // Grab the last 25 chat messages to capture the combat flavor and dialogue spikes
    const messages = game.messages.contents.slice(-25);
    contextOptions.chatHistoryText = messages.map(m => `${m.speaker.alias || "System"}: ${m.content}`).join("\n");

    await autoLogSceneToJournal(contextOptions);
  });

  // 🎬 AUTOMATION 2: Transition / Requesting a New Scene
  // Fires whenever the active scene status shifts across the game session canvas
  Hooks.on("updateScene", async (scene, updateData, options, userId) => {
    // Only fire if the active scene flag is being altered to true
    if (!updateData.active) return;
    
    // Safety check: ensure only the execution engine of the GM processes the write cycle
    if (!game.user.isGM) return;

    console.log(`AI-Director | Scene transition detected. Archiving history before activating: ${scene.name}`);

    // Fetch the name of the PREVIOUS scene we are leaving behind to compile its data history safely
    const previousSceneName = canvas.scene ? canvas.scene.name : "Previous Scene Workspace";
    
    const contextOptions = {
      currentOutput: `Scene Transition Event. Leaving: "${previousSceneName}" -> Entering: "${scene.name}"`,
      systemSetting: game.settings.get(MODULE_ID, "systemType") || "generic"
    };

    // Extract the chat block from the scene that just concluded
    const maxMessages = 20;
    const messages = game.messages.contents.slice(-maxMessages);
    contextOptions.chatHistoryText = messages.map(m => `${m.speaker.alias || "Unknown"}: ${m.content}`).join("\n");

    await autoLogSceneToJournal(contextOptions);
  });
}