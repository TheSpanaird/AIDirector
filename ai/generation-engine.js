// modules/ai-director/scripts/ai/generation-engine.js

import { OllamaClient } from "../api/ollama-client.js";
import { MODULE_ID } from "../settings.js";

export const generateScene = async ({
  chaosFactor,
  memoryText,
  journalText,
  buildPrompt
}) => {
  const promptData = await buildPrompt(`Advance the story and generate a NEW scene that occurs AFTER the most recent events.

CRITICAL CANON DATA (ALWAYS TRUE — USE THIS FIRST):
${journalText}

PERSISTENT MEMORY:
${memoryText}

CHAOS FACTOR: ${chaosFactor}

IMPORTANT:
- Chaos Factor affects how predictable or disruptive the scene is
- It does NOT restrict what types of events can occur
- Combat, danger, NPCs, and major story developments can occur at ANY chaos level

FORMAT YOUR RESPONSE EXACTLY AS:

GM NOTES:
- Purpose of the scene
- Hidden developments
- NPC NEEDED: YES or NO
- NPC ROLE: if needed, what role should the NPC fill

PLAYER SCENE:
- What players experience
`);

  const activeModel = game.settings.get(MODULE_ID, "defaultModel") || "llama3";

  // ✅ FIXED: Unified Client execution matching positional parameters (Prompt, System, Options)
  const responseText = await OllamaClient.generate(
    promptData.user, 
    promptData.system || "", 
    { model: activeModel }
  );

  return responseText || "No response from AI.";
};

export const generateNPC = async ({
  fullText,
  memoryText,
  journalText,
  profile,
  buildPrompt
}) => {
  const sceneParts = fullText.split("PLAYER SCENE:");
  if (sceneParts.length < 2) {
    return { skipped: true, text: "Could not locate a valid PLAYER SCENE block to parse out." };
  }

  const playerScene = sceneParts[1].trim();

  // Parse out whether the scene block explicitly flags an NPC requirement
  const npcNeededMatch = fullText.match(/- NPC NEEDED:\s*(YES|NO)/i);
  const npcRoleMatch = fullText.match(/- NPC ROLE:\s*(.*)/i);

  const npcNeeded = npcNeededMatch ? npcNeededMatch[1].toUpperCase() === "YES" : false;
  const npcRole = npcRoleMatch ? npcRoleMatch[1].trim() : null;

  if (!npcNeeded) {
    return { skipped: true, text: "Scene parameters do not require a fresh NPC asset generation lifecycle." };
  }

  let formatBlock = "";
  if (profile === "cyberpunk-red") {
    formatBlock = `
FORMAT (CYBERPUNK RED — GENERATOR SAFE):
- Name / Handle
- Role (Fixer, Solo, Netrunner, etc.)
- Appearance / Style
- Attitude
- Motivation
- Reputation / Presence
- Hooks for interaction

IMPORTANT:
- Do NOT generate gear, weapons, or cyberware
- Keep this compatible with an external NPC generator
`;
  } else if (profile === "dnd5e") {
    formatBlock = `
FORMAT (D&D 5E):
- Name
- Race / Type
- Role
- Personality
- Motivation
- Combat Role
- Suggested CR
- Signature abilities
`;
  } else if (profile === "sw5e") {
    formatBlock = `
FORMAT (STAR WARS 5E):
- Name
- Species
- Role
- Personality
- Motivation
- Combat Role
- Suggested CR
- Signature abilities
`;
  } else {
    formatBlock = `
FORMAT:
- NPC NAME
- NPC ROLE
- NPC DESCRIPTION
- NPC MOTIVATION
- NPC SECRET
- PLAYER-FACING INTRO
`;
  }

  const promptData = await buildPrompt(`Generate an NPC who fits naturally into this scene.

CRITICAL CANON DATA (ALWAYS TRUE — USE THIS FIRST):
${journalText}

PERSISTENT MEMORY:
${memoryText}

SCENE:
${playerScene}

${npcRole ? `SUGGESTED SCENE ROLE:\n${npcRole}\n` : ""}

${formatBlock}
`);

  const activeModel = game.settings.get(MODULE_ID, "defaultModel") || "llama3";

  // ✅ FIXED: Positionally separated variables to prevent API object collisions and layout structural drops
  const responseText = await OllamaClient.generate(
    promptData.user,
    promptData.system || "",
    { model: activeModel }
  );

  return {
    skipped: false,
    text: responseText || "No response from AI NPC Generator engine block."
  };
};