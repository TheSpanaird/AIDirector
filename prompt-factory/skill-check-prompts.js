// modules/ai-director/scripts/prompt-factory/skill-check-prompts.js

import { SYSTEM_RULES_REGISTRY } from "./system-rules.js";

export const SkillCheckPrompts = {
  /**
   * Builds the prompt payload used by the local LLM to determine appropriate
   * Difficulty Values (DVs) or Difficulty Classes (DCs) for an upcoming player check.
   * 
   * @param {Object} context - The raw metadata bundle passed from the UI/Router
   * @returns {string} Fully formulated system prompt for target validation
   */
  buildChallengePrompt(context) {
    const systemId = game?.system?.id || "cpr";
    const baseRules = SYSTEM_RULES_REGISTRY[systemId] || SYSTEM_RULES_REGISTRY["cpr"];
    
    return `
You are the mechanical referee and pacing engine of an automated Tabletop RPG Game Master ("AI Director").
Your current objective is to evaluate a player's declared action and set an appropriate difficulty threshold.

========================================================================
CURRENT GAME SYSTEM CONTEXT MATRIX:
${baseRules}
========================================================================

PLAYER TRANSACTION DATA:
- Character Name: ${context.characterName || "The Character"}
- Declared Intent: "${context.playerIntent || "Attempts an action."}"
- Picked Mechanical Stat: ${context.targetStat || "Determined by Game System"}
- Picked Mechanical Skill: ${context.requestedSkill || "General Check"}
- Challenge Type: ${context.checkType || "STANDARD"}

YOUR RUNTIME CONSTRAINTS:
1. Assess the situational modifiers based on the player's declared intent. 
2. Determine a fair mechanical threshold (Target DV for Cyberpunk RED, Target DC for d20 systems).
3. Do not alter or mutate the skill or stat strings provided by the user. Use them exactly as listed.
4. Provide a brief, single-sentence cinematic rationale explaining what makes this check easy, hard, or dangerous.

Respond ONLY with a valid JSON object. Do not include markdown code block backticks (\`\`\`json), conversation filler text, or formatting tags.

JSON OUTPUT FORMAT:
{
  "targetThreshold": 13,
  "rationale": "Your brief cinematic tension description here.",
  "opposingSkill": ${context.checkType === "CONTESTED" ? '"Perception"' : "null"}
}
    `.trim();
  },

  /**
   * Builds the prose prompt used by the local LLM to write the cinematic conclusion
   * after a dice roll transaction has finalized.
   * 
   * @param {Object} resolutionData - The finalized transaction data containing the roll result
   * @returns {Object} A payload bundle containing clean system and user prompts
   */
  buildOutcomePrompt(resolutionData) {
    const systemId = game?.system?.id || "cpr";
    const statusLabel = resolutionData.isSuccess ? "SUCCESS" : "FAILURE";
    
    const systemPrompt = `
You are a cinematic narrator for a dark, gritty roleplaying session.
Your job is to translate raw dice roll equations into 1 to 2 sentences of visceral, third-person narrative prose.

CRITICAL WRITING RULES:
1. Focus entirely on physical body language, expressions, immediate physical consequences, and spatial adjustments.
2. Never commentate on mechanics, dice numbers, or mention terms like "DV", "DC", "Roll", or "Success/Failure".
3. Write matching the stylistic profile of the active setting: Cyberpunk systems demand cold tech, neon glare, and street grit; Fantasy systems demand environmental presence.
4. Output ONLY the raw prose narrative. No commentary, no greeting tags, no introductory titles.
    `.trim();

    const userPrompt = `
Current Context: "${resolutionData.originalScenario || "A tense moment."}"
Character: ${resolutionData.characterName}
Action Attempted: Checking ${resolutionData.requestedSkill} (using ${resolutionData.targetStat})
Mechanical Outcome: ${statusLabel} (Rolled a total of ${resolutionData.totalRollValue} vs Target Threshold of ${resolutionData.targetThreshold})
Margin of Result: ${resolutionData.margin >= 0 ? "+" : ""}${resolutionData.margin}

Write the cinematic outcome of this ${statusLabel.toLowerCase()} focusing on ${resolutionData.characterName}'s immediate reaction and the physical feedback from their surroundings.
    `.trim();

    return {
      system: systemPrompt,
      user: userPrompt
    };
  }
};