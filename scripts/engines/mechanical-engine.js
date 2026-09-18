// modules/ai-director/scripts/engines/mechanical-engine.js

import { buildPrompt } from "../ai/prompt-builder.js";
import { FlagFactory, PROCESS_TYPES } from "../core/flag-factory.js";

export const MechanicalEngine = {
  /**
   * Baseline processing bridge for explicit system resolutions
   * @param {ChatMessage} messageDoc - The native Foundry roll message document
   */
console.log("DEBUG | Engine triggered by:", messageDoc.id);
  async resolve(messageDoc) {
    try {
      const flags = FlagFactory.getFlags(messageDoc);
      
      // 🛑 STRICT GUARD: Ignore any message lacking our explicit transaction process token
      if (flags.processType !== PROCESS_TYPES.MECHANICAL_RESOLUTION) return;

      const totalRollValue = messageDoc.rolls[0]?.total;
      const targetDC = flags.targetDC || flags.targetValue || 15;
      const isSuccess = totalRollValue >= targetDC;
      const margin = totalRollValue - targetDC;

      ui.notifications.info(`AI Director | Engine baseline execution: ${totalRollValue} vs ${targetDC}`);

      // Execution hand-off passes context structures to the dedicated sandbox loop
      const outcomeContext = `The player rolled a total of ${totalRollValue} against a Target DV/DC of ${targetDC}. Result: ${isSuccess ? "SUCCESS" : "FAILURE"} with a margin of ${margin}.`;
      const promptPayload = await buildPrompt(outcomeContext, { mode: "action" });
      
      const { executeGMMode } = await import("../modes/gm-modes.js");
      const narrativeResult = await executeGMMode(promptPayload.system, promptPayload.user, { silent: true });

      const characterName = flags.characterName || messageDoc.speaker?.alias || "AI Director";
      const systemId = game?.system?.id || "cpr";

      const aiOutputFlags = FlagFactory.createFlags({
        isAi: true,
        processType: PROCESS_TYPES.RAW_CONVERSATION,
        correlationId: flags.correlationId || messageDoc.id
      });

      await ChatMessage.create({
        speaker: { alias: characterName },
        content: `
          <div class="ai-director-chat-card system-${systemId} outcome-card" style="border: 1px solid var(--color-border-dark); background: var(--color-bg); color: var(--color-text-dark); border-radius: 4px; overflow: hidden; border-left: 4px solid ${isSuccess ? '#2ecc71' : '#e74c3c'};">
            <div style="background: rgba(0, 0, 0, 0.15); padding: 6px 10px; display: flex; justify-content: space-between; align-items: center;">
              <span style="font-weight: bold; font-size: 0.95em; color: ${isSuccess ? '#2ecc71' : '#e74c3c'};">MECHANICAL RESOLUTION</span>
              <span class="ai-director-actor-badge" style="font-size: 0.8em; opacity: 0.7; font-family: monospace; background: rgba(0,0,0,0.2); padding: 1px 5px; border-radius: 3px;">${characterName}</span>
            </div>
            <div style="padding: 10px;">
              <p style="margin: 0; font-style: italic;">"${narrativeResult}"</p>
            </div>
          </div>
        `,
        flags: aiOutputFlags,
        style: CONST.CHAT_MESSAGE_STYLES?.OTHER || 0
      });

    } catch (err) {
      console.error("AI Director | Baseline Mechanical Engine loop failed:", err);
    }
  }
};