// modules/ai-director/scripts/engines/mechanics-bridge.js
import { MODULE_ID } from "/modules/ai-director/scripts/settings.js";

export class MechanicsBridge {
  /**
   * System-specific reference guidelines to inject into the AI's background context.
   */
  static getSystemRulesetPrompt() {
    const systemId = game.system.id;
    
    let ruleset = `CURRENT SYSTEM CONTEXT: ${systemId}\n`;
    if (systemId === "sw5e" || systemId === "dnd5e") {
      ruleset += `
      You must evaluate tasks using the d20 system. Set Difficulty Class (DC) using this baseline:
      - Easy/Routine: DC 10
      - Moderate/Challenging: DC 15
      - Hard/Expert: DC 20
      - Heroic/Nearly Impossible: DC 25
      Adjust the DC based on target disposition (e.g., +2 if hostile, -3 if caught off guard).
      Your JSON output must specify the "ability" (str, dex, con, int, wis, cha) and the relevant "skill".
      `;
    } else if (systemId === "cyberpunk-red-core" || systemId === "cpred" || systemId === "cpr") {
      ruleset += `
      You must evaluate tasks using the Interlock d10 system. Set Difficulty Value (DV) using this baseline:
      - Simple (Everyday tasks): DV 9
      - Everyday (Requires some training): DV 13
      - Competent (Professional level): DV 17
      - Heroic (World-class effort): DV 21
      Your JSON output must specify the primary "stat" (e.g., COOL, REF, TECH) and the specific "skill" or "facedown".
      `;
    } else {
      ruleset += `Generic system active. Provide a standard d20 DC scaling from 10 to 25.`;
    }
    
    return ruleset;
  }

  /**
   * Posts an interactive challenge card to the chat log targeting the specific player.
   * @param {Object} mechanicData - The JSON payload evaluated by the AI
   */
  static async renderRollPromptCard(mechanicData) {
    const systemId = game.system.id;
    const isCPR = systemId.includes("cyberpunk") || systemId === "cpr" || systemId === "cpred" || systemId === "cyberpunk-red-core";
    const targetLabel = isCPR ? "DV" : "DC";
    
    // Create a robust temporary ID if a master correlation chain isn't explicitly defined yet
    const correlationId = mechanicData.correlationId || `challenge-${foundry.utils.randomID()}`;
    const cleanAction = mechanicData.action || "Check";
    const assignedStat = mechanicData.stat || mechanicData.ability || "";

    let content = `
      <div class="ai-director-challenge-card system-${systemId}" data-correlation-id="${correlationId}" data-target-dc="${mechanicData.difficultyClass}">
        <h3 style="border-bottom: 2px solid var(--color-border-highlight); padding-bottom: 4px; margin-top: 0;">
          🎭 AI Director Challenge
        </h3>
        <p style="font-style: italic; font-size: 0.95em; color: var(--color-text-dark);">
          "${mechanicData.rationale || 'A test of wits and nerves details...'}"
        </p>
        <div style="background: rgba(0,0,0,0.2); padding: 8px; border-radius: 4px; margin: 10px 0; font-weight: bold; text-align: center;">
          Task: ${cleanAction} &mdash; Target ${targetLabel}: <span class="challenge-target-dc">${mechanicData.difficultyClass}</span>
        </div>
        
        <button class="ai-director-roll-action-btn" 
                data-correlation-id="${correlationId}" 
                data-skill="${cleanAction}" 
                data-stat="${assignedStat}" 
                data-target="${mechanicData.difficultyClass}" 
                data-check-type="${(cleanAction.toLowerCase() === 'facedown') ? 'CONTESTED' : 'STANDARD'}"
                style="width: 100%; padding: 6px; cursor: pointer; font-weight: bold;">
          🎲 Execute ${cleanAction} Roll (${isCPR ? '1d10x' : 'd20'})
        </button>
      </div>
    `;

    const messageData = {
      user: game.user.id,
      content: content,
      speaker: { alias: "AI Director" },
      flags: {
        "ai-director": {
          isChallengeCard: true,
          correlationId: correlationId,
          targetDC: mechanicData.difficultyClass,
          skill: cleanAction,
          stat: assignedStat,
          targetEntity: mechanicData.target || "Surroundings",
          challengeContext: mechanicData.rationale || ""
        }
      }
    };

    await ChatMessage.create(messageData);
  }

  /**
   * Analyzes a finalized roll result against the card's target DC/DV
   * @param {number} totalResult - Total calculation from the rolled dice
   * @param {number} targetDC - Required threshold (or the NPC's locked contested roll)
   * @returns {string} SUCCESS or FAILURE prefix string
   */
  static evaluateOutcome(totalResult, targetDC) {
    if (totalResult >= targetDC) {
      return `[SUCCESS] The check total (${totalResult}) beats or meets the challenge threshold of ${targetDC}.`;
    } else {
      return `[FAILURE] The check total (${totalResult}) fails to meet the challenge threshold of ${targetDC}.`;
    }
  }
}