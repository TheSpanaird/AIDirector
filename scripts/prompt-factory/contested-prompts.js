// modules/ai-director/scripts/prompt-factory/contested-prompts.js

import { SYSTEM_RULES_REGISTRY } from "./system-rules.js";

export const ContestedCheckPrompts = {
  /**
   * Builds the prompt payload used by the local LLM to assess an ongoing interaction 
   * and determine the correct opposing counter-skill for an NPC or Player matchup.
   * 
   * @param {Object} context - The metadata bundle passed from the App UI Router
   * @returns {string} Fully formulated system prompt for target validation
   */
  buildContestedPrompt(context) {
    const systemId = game?.system?.id || "cpr";
    const baseRules = SYSTEM_RULES_REGISTRY[systemId] || SYSTEM_RULES_REGISTRY["cpr"];
    
    return `
You are the mechanical referee and tactical engine of an automated Tabletop RPG Game Master ("AI Director").
Your objective is to evaluate a multi-actor interaction context and select the perfect opposing/defending skill.

========================================================================
CURRENT GAME SYSTEM CONTEXT MATRIX:
${baseRules}
========================================================================

CONTESTED TRANSACTION DATA:
- Initiating Character Name: ${context.characterName || "The Initiator"}
- Target/Defending Character Name: ${context.targetName || "The Target"}
- Narrative Interaction Intent: "${context.playerIntent || "Attempts a conflicting action."}"
- Initiator Selected Skill: ${context.requestedSkill || "General Check"}
- Challenge Type: CONTESTED

YOUR RUNTIME CONSTRAINTS:
1. Assess the narrative friction between the initiating action and the defender's physical or mental stance.
2. Choose the single most appropriate opposing skill code that matches your current game system rules context matrix (e.g., 'Human Perception' against a lie, 'Evasion' against a grapple, or 'Athletics' against a shove).
3. Do not modify or override the primary initiator skill provided by the user. Use it exactly as listed.
4. Provide a brief, single-sentence tactical rationale explaining what specific reaction or defense mechanism the target is deploying.

Respond ONLY with a valid JSON object. Do not include markdown code block backticks (\`\`\`json), conversation filler text, or formatting tags.

JSON OUTPUT FORMAT:
{
  "rationale": "Your brief cinematic description of the mechanical friction here.",
  "opposingSkillKey": "human_perception",
  "opposingSkillName": "Human Perception"
}
    `.trim();
  },

  /**
   * Builds the prose prompt used by the local LLM to write the cinematic conclusion
   * after both rolls inside the contested ledger frame have completed.
   * Scales descriptive prose impact dynamically relative to the mathematical margin.
   * 
   * @param {Object} resolutionData - The compiled matchup results
   * @returns {Object} A payload bundle containing system and user prompts
   */
  buildContestedOutcomePrompt(resolutionData) {
    const systemId = game?.system?.id || "cpr";
    const winnerName = resolutionData.isInitiatorSuccess ? resolutionData.initiatorName : resolutionData.defenderName;
    const loserName = resolutionData.isInitiatorSuccess ? resolutionData.defenderName : resolutionData.initiatorName;
    
    const marginValue = Math.abs(resolutionData.margin || 0);

    // Dynamic Thresholds: Scale the emotional weight of the vocabulary based on the dice differential
    let victoryIntensity = "a razor-thin, touch-and-go advantage where structural positioning or luck barely carried the day";
    if (marginValue >= 3 && marginValue <= 5) {
      victoryIntensity = "a decisive, solid breakthrough displaying clear technical or presence superiority";
    } else if (marginValue > 5) {
      victoryIntensity = "an absolute, overwhelming landslide that utterly commands the scene and forces a total defensive collapse";
    }

    const systemPrompt = `
You are a cinematic narrator for a dark, gritty roleplaying session.
Your job is to translate a contested clash of skill totals into 1 to 2 sentences of visceral, third-person narrative prose.

CRITICAL WRITING RULES:
1. Focus strictly on psychological reaction, intent, emotional shifts, tactical positioning, and changes in character posture. Describe the direct clash in terms of spatial dominance or defensive maneuvers.
2. NEVER narrate physical combat resolutions, landing specific blows, inflicting damage, or tracking physical injuries. Game mechanics handle combat entirely.
3. If the tension breaks into violence, describe the character launching into motion or escalating the conflict, stopping right at the precipice of action (e.g., "...and lunges forward as combat begins.").
4. Never commentate on mechanics, dice totals, modifiers, or mention terms like "Roll", "Success", "Failure", or "Ledger".
5. Write matching the stylistic profile of the active setting: Cyberpunk systems demand street grit and cold calculations; Fantasy systems demand momentum and physical presence.
6. Reflect the scale of victory specified by the margin guidelines. Do not soften an overwhelming landslide or amplify a narrow scrape.
7. Output ONLY the raw prose narrative. No commentary, no greeting tags, no introductory titles.
    `.trim();

    const userPrompt = `
Current Context: "${resolutionData.originalScenario || "A direct physical or social contest."}"
Initiator: ${resolutionData.initiatorName} (Rolled ${resolutionData.initiatorRoll} using ${resolutionData.initiatorSkill})
Defender: ${resolutionData.defenderName} (Rolled ${resolutionData.defenderRoll} using ${resolutionData.defenderSkill})
Outcome Matrix: ${winnerName} overcomes ${loserName} by a margin total of ${marginValue}.

Scale of Victory Metric: This outcome was ${victoryIntensity}.

Write the cinematic outcome of this contested clash focusing on how ${winnerName}'s action breaks through or shuts down ${loserName}'s attempt. Remember to halt the prose at the precipice of physical conflict if violence breaks out.
    `.trim();

    return {
      system: systemPrompt,
      user: userPrompt
    };
  }
};