// modules/ai-director/scripts/chat/parser.js

/**
 * Chat Message Telemetry Parser
 * Sanitizes incoming text streams and performs lightweight algorithmic sentiment evaluation
 * to feed real-time mood modifiers into the state engine.
 */
export function parseChatMessage(msg) {
  if (!msg || !msg.content) {
    return { type: "ignored", text: "", sentimentModifier: 0 };
  }

  // 🛠️ FIXED: Replaced document global leakage layout with an isolated parsing fragment context
  const doc = new DOMParser().parseFromString(msg.content, 'text/html');
  const cleanText = (doc.body.textContent || "").trim();

  // SAFE GUARD: Instead of returning null and crashing the layout, 
  // return an 'ignored' status that your UI renderer can skip gracefully.
  if (!cleanText || cleanText.length < 3) {
    return { type: "ignored", text: "", sentimentModifier: 0 };
  }

  const speaker = msg.alias || msg.author?.name || "Unknown";
  let type = speaker === "GM" ? "world" : (speaker !== "Unknown" ? "player" : "chat");

  const lowered = cleanText.toLowerCase();
  const trivial = ["ok", "yes", "no", "lol", "haha"];
  if (trivial.includes(lowered)) {
    return { type: "ignored", text: "", sentimentModifier: 0 };
  }

  // --- PHASE 4: SENTIMENT ANALYSIS ENGINE ---
  let sentimentModifier = 0;
  
  // Hostility / Aggression triggers
  const hostile = ["kill", "attack", "stupid", "idiot", "hate", "liar", "threaten", "damn", "shut up"];
  // Friendliness / Trust triggers
  const friendly = ["thanks", "help", "please", "agree", "friend", "trust", "good", "deal"];
  // Intrigue / Questioning triggers
  const curious = ["why", "how", "what", "tell me", "secret", "explain"];

  if (hostile.some(word => lowered.includes(word))) {
    sentimentModifier = -1;
  } else if (friendly.some(word => lowered.includes(word))) {
    sentimentModifier = 1;
  } else if (curious.some(word => lowered.includes(word))) {
    sentimentModifier = 0.5; // Slight lean towards analytical curiosity tracking
  }

  return {
    type,
    text: cleanText,
    sentimentModifier,
    speakerName: speaker
  };
}