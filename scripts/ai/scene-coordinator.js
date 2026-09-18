// modules/ai-director/scripts/ai/scene-coordinator.js

import { getOrInitializeProfile } from "./npc-profile-builder.js";

/**
 * Scans the active canvas layer to extract nearby active NPC actors 
 * within a strict 45-foot (15-meter) conversational radius.
 */
export async function compileSceneParticipants(activeToken) {
  const participants = [];
  if (!canvas.ready || !activeToken) return participants;

  const activeScene = game.scenes?.active;
  if (!activeScene) return participants;

  // Maximum grid unit distance allowed for conversation hearing/interruption
  const MAX_CONVERSATIONAL_DISTANCE = 45; 

  /**
   * Helper function to safely measure distance using modern v12+ grid pathing API
   */
  const getDistanceBetween = (p1, p2) => {
    if (canvas.grid && typeof canvas.grid.measurePath === "function") {
      // Modern v12/v13+ path measurement strategy
      const path = [
        { x: p1.x, y: p1.y },
        { x: p2.x, y: p2.y }
      ];
      const measurement = canvas.grid.measurePath(path, { gridSpaces: true });
      return measurement.distance;
    }
    // Geometric fallback if canvas grid functions are undergoing initialization cycles
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  };

  // Gather all tokens in the active map scene matching our proximity and document parameters
  const sceneTokens = canvas.tokens.placeables.filter(t => {
    // 1. Must have an active actor document reference
    if (!t.actor) return false;

    // 2. Exclude Player Characters (Must not be standard characters)
    if (t.actor.type === "character") return false;

    // 3. Exclude the primary token currently being spoken to
    if (t.id === activeToken.id) return false;

    // 4. Proximity Check: Calculate distance in grid units (feet/meters) between tokens
    const distance = getDistanceBetween(activeToken.center, t.center);
    if (distance > MAX_CONVERSATIONAL_DISTANCE) return false;

    return true;
  });

  for (const token of sceneTokens) {
    try {
      const profile = await getOrInitializeProfile(token.actor);
      if (profile) {
        // Calculate the physical distance one more time to include it in the prompt background data
        const distanceToTarget = Math.round(getDistanceBetween(activeToken.center, token.center));

        participants.push({
          tokenId: token.id,
          actorId: token.actor.id,
          name: token.name,
          distance: distanceToTarget, // Added to provide physical context to the LLM
          traits: profile.traits || { dominance: 5, restraint: 5 },
          relationship: profile.relationships?.party || { disposition: "Neutral", trust: 5 },
          perceptionState: profile.relationships?.party?.perceptionState || "Neutral Acquaintance"
        });
      }
    } catch (error) {
      console.warn(`AI Director | Failed to extract scene profile for token: ${token.name}`, error);
    }
  }

  // Sort participants by DOMINANCE (highest dominance wants to control turn pacing)
  participants.sort((a, b) => (b.traits.dominance || 5) - (a.traits.dominance || 5));
  return participants;
}

/**
 * Formats compiled scene profiles into a rigid markdown string for system prompts.
 */
export function formatSceneSocialContext(participants) {
  if (!participants || participants.length === 0) {
    return "No other active narrative actors are currently close enough to hear or notice this interaction.";
  }

  let markdown = "## IMMEDIATE ROOM OVERVIEW (OTHER ACTIVE TOKENS WITHIN EARSHOT):\n";
  participants.forEach(p => {
    markdown += `- **${p.name.toUpperCase()}**: Located ${p.distance} units away. Status is "${p.perceptionState}" (Trust: ${p.relationship.trust}/10). Psychology: Dominance ${p.traits.dominance}/10, Restraint: ${p.traits.restraint}/10.\n`;
  });
  
  markdown += `\n[INTER-TOKEN OPERATIONAL RULES]:
1. Acknowledge the physical presence of these local actors if the conversation naturally relates to them or their proximity.
2. Dominance Hierarchy: Characters with higher Dominance ratings will aggressively attempt to control the interaction frame, cut off less dominant actors, or project higher social authority in the room.`;

  return markdown;
}