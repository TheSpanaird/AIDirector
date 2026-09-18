// modules/ai-director/scripts/ai/event-listeners.js

import { parseChatMessage } from "./parser.js";
import { pushEvent, getSecondsSinceActivity } from "./state-store.js";
import { evaluateInteraction } from "./trust-evaluator.js";

export function registerAIListeners() {
  
  // 1. Existing Message Listener (Kept intact for flag interceptions)
  Hooks.on("createChatMessage", async (msg) => {
    if (!game.user.isGM) return;
    const content = msg.content?.trim() || "";
    const directorPattern = /^\[Director Input\s*-\s*([^\]]+?)\s*CHAT\s+to\s+([^\]]+?)\]\s*:\s*(.*)/i;
    const match = content.match(directorPattern);

    if (match) {
      const targetName = match[2].trim();
      const rawDialogue = match[3].trim();
      const targetActor = game.actors.contents.find(a => a.name.toLowerCase().includes(targetName.toLowerCase()));
      if (targetActor) {
        await evaluateInteraction(targetActor, rawDialogue, "Acknowledged exchange.");
      }
    }
  });

  // 2. THE IMPROVED PACING HEARTBEAT (Pacing Engine)
  // Tracks a rolling trigger probability so events are rare and never interrupt action.
  let dynamicTriggerChance = 5; // Starts at a low 5% chance

  setInterval(async () => {
    if (!game.user.isGM) return;

    // RULE A: Absolute Protection. If a combat tracker is running, freeze the narrative clock.
    if (game.combats?.active && game.combats.viewed?.started) {
      dynamicTriggerChance = 5; // Keep probability bottomed out during fights
      return;
    }

    const idleSeconds = getSecondsSinceActivity();
    
    // RULE B: Check pacing window every 10 minutes (600 seconds) of table silence
    if (idleSeconds >= 600) {
      pushEvent({ type: "heartbeat" }); // Clear transient state tracking clock

      // Roll a virtual d100 countdown check
      const pacingRoll = Math.floor(Math.random() * 100) + 1;
      console.log(`🎲 AI Director | Idle check. Rolling Pacing: ${pacingRoll} vs Target: ${dynamicTriggerChance}%`);

      if (pacingRoll <= dynamicTriggerChance) {
        // Success! An event triggers. Reset pacing escalation parameters.
        dynamicTriggerChance = 5; 
        
        try {
          console.log("🧠 AI Director | Pacing threshold breached. Dispatching background pulse...");
          // 🛠️ FIXED: Updated import path to point to the correct scripts/modes folder
          const { executeDirectorPulse } = await import("/modules/ai-director/scripts/modes/director-pulse.js");
          await executeDirectorPulse();
        } catch (err) {
          console.error("AI Director | Heartbeat background update sequence failed:", err);
        }
      } else {
        // Failure: No event happens this time, but tension builds.
        // Increase the chance of an event happening during the *next* 10-minute lull.
        dynamicTriggerChance += 15; 
        console.log(`📈 AI Director | World remains quiet. Tension building. Next trigger chance: ${dynamicTriggerChance}%`);
      }
    }
  }, 60000); // Poll status once per minute
}