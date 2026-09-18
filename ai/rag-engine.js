// scripts/ai/rag-engine.js

/**
 * Final-pass payload sanitizer to strip lingering HTML entities, raw JSON arrays, 
 * or structure markers that derail local model focus boundaries.
 */
function sanitizePayload(text) {
  if (!text) return "";
  return text
    .replace(/<\/?[^>]+(>|$)/g, " ")
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&nbsp;/g, " ")
    .replace(/\[\s*\{\s*"npcName":[\s\S]*?\}\s*\]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Summarizes a massive block of raw text by filtering out non-essential sentences
 * and returning only the top sentences containing campaign keywords.
 * 
 * @param {string} text - The raw journal text.
 * @param {string[]} keywords - Active search keywords.
 * @param {number} maxSentences - Maximum summarized bullet count.
 * @returns {string} Highly condensed summary layout.
 */
function summarizeTextAlgorithmic(text, keywords, maxSentences = 3) {
  if (!text) return "• No text provided.";
  
  // Split content cleanly into sentences using standard ending delimiters
  const sentences = text.match(/[^.!?]+[.!?]+(\s|$)/g) || [text];
  
  // Score sentences based on keyword density
  const scoredSentences = sentences.map(sentence => {
    let score = 0;
    const lowerSentence = sentence.toLowerCase();
    keywords.forEach(kw => {
      if (lowerSentence.includes(kw)) score += 2; // Keyword hits match heavily
    });
    return { text: sentence.trim(), score };
  });

  // Filter out completely irrelevant background sentences, sort by importance
  const relevant = scoredSentences
    .filter(s => s.score > 0 || s.text.length < 150) // Keep short plot sentences
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSentences)
    .map(s => `• ${s.text}`);

  return relevant.length > 0 ? relevant.join("\n") : "• No exact match details summary extracted.";
}

/**
 * Searches Foundry's data store for content relevant to the player's current input.
 * Filters journals, actor sheets, and scenes for keyword matches.
 * 
 * @param {string} query - The user's input string or current scene focus.
 * @returns {Promise<string>} Compiled context text for the AI.
 */
export async function getRelevantContext(query) {
  const searchKeywords = query.toLowerCase().split(" ").filter(w => w.length > 3);
  let retrievedContext = [];

  if (searchKeywords.length === 0 && query.trim().length > 0) {
    searchKeywords.push(query.toLowerCase().trim());
  }

  // 1. Search Journal Entries (The Compressed "Lore" Layer)
  const journals = game.journal.filter(j => 
    searchKeywords.some(k => j.name.toLowerCase().includes(k) || j.pages.contents.some(p => p.text.content?.toLowerCase().includes(k)))
  );
  
  // Strict context budgeting cap: only search the top 3 most relevant entries
  const targetedJournals = journals.slice(0, 3);

  for (const j of targetedJournals) {
    const rawContent = j.pages.contents.map(p => p.text.content || "").join(" ");
    const cleanContent = rawContent.replace(/<\/?[^>]+(>|$)/g, " ").replace(/\s+/g, " ").trim();

    // Generate an optimized summary layout instead of a massive raw string window
    const summary = summarizeTextAlgorithmic(cleanContent, searchKeywords, 3);
    
    retrievedContext.push(`SUMMARY LORE FROM ${j.name}:\n${summary}`);
  }

  // 2. Search Active Tokens (The "Status" Layer)
  const activeActors = canvas.tokens.placeables.map(t => t.actor).filter(a => a);
  for (const actor of activeActors) {
    if (searchKeywords.some(k => actor.name.toLowerCase().includes(k))) {
      const hpValue = actor.system?.attributes?.hp?.value 
                   || actor.system?.derivedStats?.hp?.value 
                   || "N/A";
      const statusEffects = actor.effects?.map(e => e.name || e.label).filter(Boolean).join(", ") || "None";

      retrievedContext.push(`CHARACTER DATA FOR ${actor.name}: HP: ${hpValue}, Status Effects: ${statusEffects}`);
    }
  }

  // 3. Search Current Scene Description
  if (canvas.scene) {
    const rawSceneDesc = canvas.scene.description?.replace(/<\/?[^>]+(>|$)/g, "").trim() || "";
    let shortSceneDesc = "No descriptive map notes provided.";

    if (rawSceneDesc && rawSceneDesc !== "undefined") {
      // Safely perform match execution only on verified strings
      const sentenceMatch = rawSceneDesc.match(/[^.!?]+[.!?]+(\s|$)/g);
      shortSceneDesc = sentenceMatch ? sentenceMatch.slice(0, 2).join(" ").trim() : rawSceneDesc;
    }
    
    retrievedContext.push(`CURRENT LOCATION: ${canvas.scene.name}. Description Summary: ${shortSceneDesc}`);
  }

  if (retrievedContext.length === 0) {
    return "NO_MATCHING_CANON_DATA_FOUND";
  }

  const joinedPayload = retrievedContext.join("\n\n");
  const finalizedText = sanitizePayload(joinedPayload);

  return finalizedText.replace(/NPC GENERATION LIST:\s*$/gm, "").trim();
}