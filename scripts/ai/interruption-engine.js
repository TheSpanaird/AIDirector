// modules/ai-director/scripts/ai/interruption-engine.js

import { OllamaClient } from "../api/ollama-client.js";
import { MODULE_ID } from "../settings.js";

// Keep track of rounds/turns since the last interruption to prevent chat flooding
let globalInterruptionCooldown = 0;

/**
 * Evaluates the current scene to see if a secondary NPC should organically interject.
 * Returns the name of the interjecting actor or null.
 */
export async function evaluateInterruptionOpportunity(playerMessage, primaryActor, participants) {
  if (participants.length === 0) return null;
  
  // Enforce a strict 2-turn cooldown between scene interruptions
  if (globalInterruptionCooldown > 0) {
    globalInterruptionCooldown--;
    return null;
  }

  const systemPrompt = `
You are the narrative pacing controller for a tabletop RPG. Your job is to determine if a secondary NPC standing in the room has a compelling, organic reason to interrupt or join the current conversation between the Player and the Primary NPC.

SECONDARY PARTICIPANTS IN THE ROOM:
${participants.map(p => `- Name: ${p.name}, Dominance: ${p.traits.dominance}/10, Restraint: ${p.traits.restraint}/10, Relationship: ${p.perceptionState}`).join("\n")}

RULES FOR INTERRUPTION:
1. HIGH DOMINANCE: If a secondary NPC has high Dominance (7+) and low Restraint (<4), they will naturally cut in if they disagree or want to show authority.
2. RELEVANCE / SELECTION: If the player asks a broad question (e.g., "Do you guys have work?"), a secondary NPC might speak up if the primary NPC can't help.
3. CONSTRAINT: Interruption should be rare. If the exchange is a standard 1-on-1 personal question, do NOT interrupt.

OUTPUT FORMAT:
You MUST respond in exactly one of these two formats. Do not include any other text:
INTERRUPT: [NPC Name]
or
STATUS: SILENT
`;

  const userPrompt = `
EXCHANGE:
Player said: "${playerMessage}"
Primary NPC (${primaryActor.name}) is responding.
`;

  // 🛠️ INTEGRATED FIX: Target original "modelName" setting inside a safe initialization block
  let activeModel = "hermes3";
  try {
    if (typeof game !== "undefined" && game.settings) {
      activeModel = game.settings.get(MODULE_ID, "modelName") || "hermes3";
    }
  } catch (e) {
    console.warn("AI Director | 'modelName' fetch bypassed interruption-engine.js initialization checks. Defaulting to hermes3.");
  }

  try {
    // REFACTORED: Replaced raw fetch boilerplate with clean, unified gateway connection
    const rawOutput = await OllamaClient.chat([
      { role: "system", content: systemPrompt.trim() },
      { role: "user", content: userPrompt.trim() }
    ], {
      model: activeModel,
      temperature: 0.1,
      num_predict: 20 // Fast, low-token execution window
    });

    const output = rawOutput || "";
    const match = output.match(/INTERRUPT:\s*(.*)/i);
    
    if (match) {
      const interjectorName = match[1].trim();
      // Verify the model picked an actual participant in the room
      const verifiedParticipant = participants.find(p => p.name.toLowerCase() === interjectorName.toLowerCase());
      if (verifiedParticipant) {
        globalInterruptionCooldown = 2; // Lock interruptions for the next 2 turns
        return verifiedParticipant;
      }
    }
  } catch (e) {
    console.error("AI Director | Interruption evaluation failed:", e);
  }

  return null;
}