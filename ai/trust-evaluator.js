// modules/ai-director/scripts/ai/trust-evaluator.js

import { updateActorSocialState } from "./status-updater.js";
import { OllamaClient } from "../api/ollama-client.js";
import { MODULE_ID } from "../settings.js";

/**
 * Silently evaluates a conversational exchange to determine relationship shifts.
 * Pipes results into the state machine for database persistence.
 */
export async function evaluateInteraction(actor, playerMessage, npcResponse) {
    if (!actor) return;

    const profile = actor.getFlag("ai-director", "profile");
    if (!profile || !profile.relationships || !profile.relationships.party) {
        console.warn(`AI Director | No valid relationship profile found for ${actor.name} to evaluate.`);
        return;
    }

    const currentTrust = profile.relationships.party.trust || 5;
    const currentDisposition = profile.relationships.party.disposition || "Neutral";

    const systemPrompt = `
You are a psychological analysis engine for a tabletop RPG. 
Your task is to analyze a brief conversational exchange between a Player and an NPC.

CURRENT NPC STATE:
- Trust Level: ${currentTrust}/9
- Disposition: ${currentDisposition}

RULES OF EVALUATION:
1. Did the player lie, threaten, insult, or act with high aggression? If yes, Trust decreases.
2. Did the player offer help, pay well, show deep respect, or protect the NPC? If yes, Trust increases.
3. Was the exchange standard, transactional, or neutral? If yes, Trust remains unchanged.

OUTPUT FORMAT:
You MUST output your evaluation in the exact structure below. Do not add conversational text or introduction prose.
DELTA: [Choose: -1, 0, or +1]
REASON: [1 short sentence explaining why]
`;

    const userPrompt = `
EXCHANGE TO EVALUATE:
Player said: "${playerMessage}"
NPC replied: "${npcResponse}"
`;

    // Updated setting key to "modelName" with protective try/catch wrap
    let activeModel = "hermes3";
    try {
        if (typeof game !== "undefined" && game.settings) {
            activeModel = game.settings.get(MODULE_ID, "modelName") || "hermes3";
        }
    } catch (e) {
        console.warn(`AI Director | 'modelName' fetch bypassed trust-evaluator.js constraint checks. Defaulting to hermes3.`);
    }

    try {
        // FIXED: Realigned structure arguments to match standard array signature payload requirements
        const responseData = await OllamaClient.chat([
            { role: "system", content: systemPrompt.trim() },
            { role: "user", content: userPrompt.trim() }
        ], {
            model: activeModel,
            temperature: 0.1,
            num_predict: 100
        });

        const rawOutput = responseData?.message?.content || "";

        const deltaMatch = rawOutput.match(/DELTA:\s*([+-]?\d+)/i);
        const reasonMatch = rawOutput.match(/REASON:\s*(.*)/i);
        
        if (deltaMatch) {
            const delta = parseInt(deltaMatch[1], 10);
            const rawReason = reasonMatch ? reasonMatch[1].trim() : "Standard social exchange.";
            await updateActorSocialState(actor, delta, rawReason);
        }

    } catch (error) {
        console.error(`AI Director | Trust evaluation failed for ${actor.name}:`, error);
    }
}