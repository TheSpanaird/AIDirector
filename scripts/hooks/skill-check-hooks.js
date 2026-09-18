// modules/ai-director/scripts/hooks/skill-check-hooks.js

import { SkillCheckOrchestrator } from "../engines/skill-check-orchestrator.js";

export const SkillCheckHooks = {
  /**
   * Registers all core hooks related to skill checks and campaign narration boundaries.
   */
  register() {
    Hooks.on("createChatMessage", async (messageDoc, options, userId) => {
      // 1. Quick Guard: Only process if the current user is the GM and the message has rolls
      if (!game.user.isGM || !messageDoc.rolls?.length) return;

      // 2. Extract the AI Director flags from the message
      const rawFlags = messageDoc.flags?.["ai-director"] || {};
      const aiFlags = messageDoc.getFlag("ai-director", "sequenceContext") 
        || rawFlags.routing
        || rawFlags;

      if (!aiFlags || !aiFlags.correlationId) return;

      // 3. Strict Context Guard: ONLY allow the modern sandbox sequence type to pass
      const topProcess = aiFlags.process || aiFlags.processType;
      if (topProcess !== "SKILL_CHECK_SEQUENCE") return;

      // 4. Verification: Double check it hasn't already been processed
      if (aiFlags.context?.isResolutionProcessing || aiFlags.isResolutionProcessing) return;

      // 5. Direct handoff to the modern orchestrator for LLM narration generation
      ui.notifications.info("AI Director | Active challenge roll detected. Generating cinematic narration...");
      await SkillCheckOrchestrator.resolveChallengeRoll(messageDoc, aiFlags);
    });
  }
};