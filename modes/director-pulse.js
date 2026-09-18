// modules/ai-director/scripts/modes/director-pulse.js

import { buildPrompt } from "../ai/prompt-builder.js";
import { OllamaClient } from "../api/ollama-client.js";
import { MODULE_ID } from "../settings.js";
import { getOrCreateActiveVolumePage } from "../journal/volume-helper.js";

/**
 * Executes an automated administrative background world pulse when the table goes idle.
 */
export async function executeDirectorPulse() {
  // 🛑 AUTONOMOUS GUARD: Halt execution if the Director checkbox is toggled off
  const isAutonomousActive = game.settings.get(MODULE_ID, "autonomousDirector");
  if (!isAutonomousActive) {
    console.log("AI Director | Background pulse suppressed (Autonomous Director is STANDBY).");
    return;
  }

  console.log("AI Director | Starting automated background pulse generation...");
  
  const pulsePrompt = await buildPrompt("The world feels quiet. What happens next?", { 
    mode: "director_pulse" 
  });

  try {
    const settingKey = `${MODULE_ID}.defaultModel`;
    const model = game.settings.settings.has(settingKey) 
      ? game.settings.get(MODULE_ID, "defaultModel") 
      : "hermes3";

    const pulseContent = await OllamaClient.generate(pulsePrompt.user, pulsePrompt.system);

    const finalNarrative = pulseContent?.trim() || "The world remains quiet.";

    const folderName = "AI Director Canon";
    const pageTitle = `Pulse Event - ${new Date().toLocaleTimeString()}`;
    const htmlContent = `<p>${finalNarrative}</p>`;

    await getOrCreateActiveVolumePage(folderName, pageTitle, htmlContent);
    
    ui.notifications.info("AI Director: A quiet event has been recorded to the logs.");

  } catch (err) {
    console.error("AI Director | Unified pulse transaction failed:", err);
    ui.notifications.error("AI Director: Automated heartbeat pulse failed to generate.");
  }
}