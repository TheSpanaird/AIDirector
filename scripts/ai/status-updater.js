// modules/ai-director/scripts/ai/status-updater.js

import { StateManager } from "./state-manager.js";
import { FactionManager } from "../simulation/faction-manager.js"; // ✅ NEW: Import for executing the Social Ripple database write

/**
 * Advanced Social State Engine
 * Translates numerical trust deltas into evolving perception states and history logs.
 * Fully synchronized with StateManager's data scaling limits.
 */
export async function updateActorSocialState(actor, delta, rawReason) {
  if (!actor) return;

  // Retrieve existing profile safely using our centralized manager
  const profile = await StateManager.getActorState(actor);
  if (!profile) return;

  if (!profile.relationships) profile.relationships = {};
  if (!profile.relationships.party) {
    profile.relationships.party = {
      disposition: "Neutral",
      trust: 5,
      historyLog: "No records."
    };
  }

  const currentPartyState = profile.relationships.party;
  
  // 1. Calculate and clamp trust cleanly on the core 1-9 scale
  const oldTrust = currentPartyState.trust ?? 5;
  const newTrust = Math.max(1, Math.min(9, oldTrust + delta));
  currentPartyState.trust = newTrust;
  
  // 2. Synchronized Disposition and Perception State tracking conditions
  if (newTrust > 7) {
    currentPartyState.disposition = "Loyal";
    currentPartyState.perceptionState = "Ride-or-Die Ally";
  } else if (newTrust > 5) {
    currentPartyState.disposition = "Friendly";
    currentPartyState.perceptionState = "Trusted Contact";
  } else if (newTrust < 3) {
    currentPartyState.disposition = "Hostile";
    currentPartyState.perceptionState = "Active Adversary / Threat";
  } else if (newTrust === 3) {
    currentPartyState.disposition = "Suspicious";
    currentPartyState.perceptionState = "Suspicious Competitor";
  } else {
    currentPartyState.disposition = "Neutral";
    currentPartyState.perceptionState = "Pragmatic Business Relation";
  }

  // 3. Maintain a rolling structural interaction history log (Max 5 entries)
  if (!currentPartyState.historyArray) {
    currentPartyState.historyArray = currentPartyState.historyLog && currentPartyState.historyLog !== "No records."
      ? [currentPartyState.historyLog]
      : [];
  }

  const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const logEntry = `[${timestamp}][Trust ${delta >= 0 ? "+" : ""}${delta}] ${rawReason}`;
  
  currentPartyState.historyArray.push(logEntry);
  if (currentPartyState.historyArray.length > 5) {
    currentPartyState.historyArray.shift(); // Keep context window clean
  }

  // Compile back into a clean string for your prompt builder's historyLog field
  currentPartyState.historyLog = currentPartyState.historyArray.join(" | ");

  // 4. Persist to database using unified State Manager architecture
  await StateManager.updateState(actor, profile);

  // ✅ NEW: 4b. Execute Social Ripple Effect (Individual standing shifts global alignment)
  if (delta !== 0) {
    const parentFaction = await StateManager.getActorFaction(actor);
    if (parentFaction) {
      const registry = FactionManager.getRegistry();
      const fIndex = registry.findIndex(f => f.id === parentFaction.id);
      
      if (fIndex !== -1) {
        // Inverse Relationship: Higher trust reduces parent faction hostility; lower trust raises it
        const hostilityDelta = -delta * 5; 
        const oldHostility = registry[fIndex].hostilityToParty ?? 50;
        
        registry[fIndex].hostilityToParty = Math.clamped(oldHostility + hostilityDelta, 0, 100);
        
        // Commit change and automatically update any open GM interfaces
        await FactionManager.saveRegistry(registry);
        console.log(`AI Director | Social Ripple: ${actor.name}'s trust shift caused ${parentFaction.name} hostility to adjust by ${hostilityDelta} (New Level: ${registry[fIndex].hostilityToParty}/100)`);
      }
    }
  }

  // 5. Dynamic Visual/UI feedback for the Game Master
  console.log(`AI Director | Social State Update for ${actor.name}: ${currentPartyState.perceptionState} (${newTrust}/9)`);
  
  // If the token is active on the map, float status text over their head
  if (canvas.ready && canvas.tokens) {
    const activeToken = canvas.tokens.placeables.find(t => t.actor?.id === actor.id);
    if (activeToken && delta !== 0) {
      const color = delta > 0 ? "#00FF00" : "#FF0000"; // Safe hex string interpretation
      
      // 🛠️ FIXED: Dual-version compatibility layout for canvas interface scrolling text
      const interfaceLayer = canvas.interface || ui.scrollingText;
      if (interfaceLayer && typeof interfaceLayer.createScrollingText === "function") {
        interfaceLayer.createScrollingText(activeToken.center, `Social Shift: ${currentPartyState.perceptionState}`, {
          anchor: CONST.TEXT_ANCHOR_POINTS?.TOP || 1,
          direction: CONST.TEXT_ANCHOR_POINTS?.TOP || 1,
          distance: 40,
          fontSize: 24,
          fill: color,
          stroke: "#000000",
          strokeThickness: 4
        });
      }
    }
  }
}