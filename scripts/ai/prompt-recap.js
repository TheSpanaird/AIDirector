// modules/ai-director/scripts/ai/prompt-recap.js

/**
 * Builds the structural system and user prompts for the session recap.
 * @param {string} currentMemoryState - The plain text contents of the single "Current Memory State" master document.
 * @param {string} campaignArchives - Merged historical logs from the Session Recaps folder.
 * @param {string} recentChatLog - The filtered game chat log text.
 * @returns {Object} An object containing the system and user prompt strings.
 */
export function buildRecapPrompt(currentMemoryState, campaignArchives, recentChatLog) {
  const systemInstructions = `You are the AI Game Director acting as an objective Campaign Archivist.
Your duty is to ingest recent session dialogue/events and update the campaign continuity tracking.

CRITICAL RULES:
- ONLY use facts explicitly present in the session inputs. Do not invent details.
- Present events as a flowing chronological narrative for players.
- You must isolate your output sections using the exact XML divider tags provided. Do not add any conversational filler outside of these tags.`;

  const userPayload = `### MASTER CURRENT MEMORY STATE (EXISTING BULLETS):
${currentMemoryState || "None compiled yet."}

### HISTORICAL CAMPAIGN ARCHIVES REFERENCE:
${campaignArchives || "None"}

### CURRENT CHAT TRANSCRIPT:
${recentChatLog}

### FINAL INSTRUCTION:
Review all recent chat transcripts and historical entries. Compile the session evaluation into the exact 3-part XML layout defined below. Do not include introductory text, conversational filler, or Markdown formatting outside of these tags. Start immediately with PLAYER_RECAP.

PLAYER_RECAP
<PLAYER_RECAP>
(Write a flowing, dramatic prose narrative retelling of the session in 2-3 tight paragraphs for the players. Absolutely no bullet points or technical jargon.)
</PLAYER_RECAP>

GM_NOTES
<GM_NOTES>
(Write behind-the-scenes GM tracking notes, hidden developments, factions shifting, secrets, or unresolved plot hooks from this specific session. This represents the session delta.)
</GM_NOTES>

CUMULATIVE_BULLETS
<CUMULATIVE_BULLEVA>
(Review the MASTER CURRENT MEMORY STATE provided above. Update, rewrite, append, or prune those facts to create a freshly consolidated, comprehensive master list of all confirmed world facts, NPC states, and long-term campaign tracking points up to this exact moment. Provide ONLY plain text bullet points.)
</CUMULATIVE_BULLETS>`;

  return {
    system: systemInstructions,
    user: userPayload
  };
}