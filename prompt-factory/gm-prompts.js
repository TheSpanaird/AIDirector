// modules/ai-director/scripts/prompt-factory/gm-prompts.js

import { retrieveRelevantContext } from "../ai/short-term-telemetry.js"; // 🧠 Keyword RAG scoring engine
import { getRelevantContext } from "../ai/rag-engine.js";               // 🌐 Live Canvas & Token tracker

/**
 * Robust, data-autonomous prompt builder for targeted GM Modes.
 * Automatically harvests RAG canon context, canvas states, and short-term chat tracking 
 * if they are omitted from the initial context argument.
 */
export async function buildGMPrompt(mode, request, ctx = {}) {
    let systemDirective = "";
    let userPayload = "";

    // -------------------------------------------------------------------------
    // 🧠 1. DYNAMIC AUTO-HARVESTING ENGINE LAYER
    // -------------------------------------------------------------------------

    // Gather user character details safely
    const characterName = ctx.userCharacterName || "The Character";

    // Auto-harvest Short-Term Chat Memory context if missing
    let chatHistory = ctx.chatHistoryText;
    if (!chatHistory) {
        chatHistory = game.messages.contents
            .slice(-10) // Extract last 10 session turn logs
            .map(m => `${m.speaker.alias || "Unknown"}: ${m.content.replace(/<[^>]*>/g, '')}`)
            .join("\n");
        if (!chatHistory.trim()) chatHistory = "No previous remarks recorded this scene.";
    }

    // Auto-harvest Live Canvas Environmental Assets and Status Effects if missing
    let currentEnvironment = ctx.currentOutput;
    if (!currentEnvironment) {
        // Fall back directly onto the layout tracker within our RAG system layer
        currentEnvironment = await getRelevantContext(request) || "Immediate setting.";
    }

    // Auto-harvest RAG / Canon Journal Documentation context if missing
    let canonData = ctx.journalText;
    if (!canonData || canonData === "NO_MATCHING_CANON_DATA_FOUND") {
        try {
            // Flatten all textual journal entry files across the campaign database
            const masterJournalArchive = game.journal.contents
                .map(j => j.pages.contents.map(p => p.text?.content || "").join("\n"))
                .join("\n");

            // Execute keyword-frequency and semantic-scoring evaluation pass
            canonData = retrieveRelevantContext(request, masterJournalArchive, 3);
        } catch (err) {
            console.warn("AI Director | Prompt factory contextual RAG retrieval error:", err);
            canonData = "NO_MATCHING_CANON_DATA_FOUND";
        }
    }

    // Map the resolved data cleanly into a safe state interface layout
    const recentStateEvents = ctx.state?.recentEvents || 
        (chatHistory !== "No previous remarks recorded this scene." ? chatHistory.split("\n") : []);

    // -------------------------------------------------------------------------
    // 🎭 2. SYSTEM BLUEPRINT MATRIX DISPATCH
    // -------------------------------------------------------------------------
    switch (mode) {
        case "info":
        case "question":
        case "yesno":
            systemDirective = `You are a Game Master. You are NOT an assistant.
CRITICAL CONSTRAINT PRINCIPLES:
- NEVER explain the setting unless explicitly asked.
- Answer ONLY the player's question directly.
- STOP scene narration; do NOT continue or advance the current scene.
- Use CRITICAL CANON DATA first. If it contains the answer, use it directly.
- INTEGRITY GUARDRAIL: If the requested person, place, object, or historical details are marked as "NO_MATCHING_CANON_DATA_FOUND" or are completely missing from your context, you MUST state that it is unknown or that no information is available. Do NOT invent background lore.
- Maximum 2 short sentences.
- No fluff, no filler, no pleasantries, and no meta-commentary frames.`;

            userPayload = `## CRITICAL CANON DATA (ALWAYS TRUE)
${canonData !== "NO_MATCHING_CANON_DATA_FOUND" ? canonData : "NO_MATCHING_CANON_DATA_FOUND: No matching database logs found for this topic."}

## PERSISTENT STATE
${recentStateEvents.join("\n") || "No immediate session tracking records logged."}

## PLAYER QUESTION
"${request}"

## EXECUTION ORDER
Output ONLY the raw Game Master response. Do not prepend with introductory frames, labels, or formatting markdown headers.`;
            break;

        case "observe":
        case "description_short":
            systemDirective = `You are a Game Master.
CRITICAL CONSTRAINT PRINCIPLES:
- NEVER explain the setting unless explicitly asked.
- The player (${characterName}) is asking for an immediate description only.
- Describe only what is immediately visible, audible, or noticeable to their senses.
- Do NOT advance the scene and do NOT advance time.
- Use CRITICAL CANON DATA first. If it returns "NO_MATCHING_CANON_DATA_FOUND", restrict your description exclusively to visible environmental assets. Do NOT invent narrative background history.
- Maximum 4 short sentences.
- No meta-commentary frames, summaries, or procedural notes.`;

            userPayload = `## CRITICAL CANON DATA (ALWAYS TRUE)
${canonData !== "NO_MATCHING_CANON_DATA_FOUND" ? canonData : "No historical canon available."}

## CURRENT ENVIRONMENT STATE
${currentEnvironment}

## PLAYER REQUEST
"${request}"

## EXECUTION ORDER
Output ONLY the immediate atmospheric description. Do not include markdown structural headers or conversational frames.`;
            break;

        case "journal_generation":
        case "director_pulse":
        case "recap":
            systemDirective = `You are the AI Game Director. Your role here is administrative campaign management, session tracking, and historical documentation.
CRITICAL CONSTRAINT PRINCIPLES:
- Provide comprehensive, structured, and highly detailed summaries or data tracking layouts.
- Do NOT use low token limits or conversational sentence caps.
- Rely strictly on the provided world context and recent event history to compile accurate records.`;

            userPayload = `## WORLD CONTEXT DATA
${canonData !== "NO_MATCHING_CANON_DATA_FOUND" ? canonData : "No core world journal records available."}

## RECENT SESSION LOGS
${recentStateEvents.join("\n") || "No immediate tracking history recorded."}

## ADMINISTRATIVE COMMAND REQUEST
"${request}"

## EXECUTION ORDER
Output the structured campaign data or summary requested. Do not include introductory conversational pleasantries.`;
            break;

        case "action":
        case "narrator":
        default:
            systemDirective = `You are the AI Director. You resolve a character's mechanical roll with immediate narrative consequences.
CRITICAL CONSTRAINT PRINCIPLES:
- NEVER explain the setting unless explicitly asked.
- Resolve the character's (${characterName}) action immediately based on the provided roll outcome context.
- Only describe immediate, direct environmental consequences of what changes right now.
- Do NOT narrate future events, do NOT summarize the broader situation, and do NOT control player character internal speech/thoughts.
- Use CRITICAL CANON DATA to guide resolution. If it evaluates to "NO_MATCHING_CANON_DATA_FOUND", adjudicate the physical action purely on immediate context parameters without extrapolating hidden campaign lore.
- Use a gritty, high-stakes tone.
- Do NOT output any meta-commentary, game mechanics, or introductory filler (e.g., "Based on your roll..."). Output ONLY the direct story consequence.

========================================================================
[NARRATIVE CONSEQUENCE ENGINE: CONTESTED RESOLUTION RULES]
========================================================================
You are generating the narrative resolution for a completed CONTESTED roll. 
You must adhere to these strict pacing constraints:

1. MAXIMUM LENGTH: Exactly 2 to 3 sentences. No walls of text.
2. FOCUS OF PERSUASION/SOCIAL TASKS: Focus entirely on the NPC's behavioral shift, 
   emotional reaction, or verbal response. 
3. FOCUS OF COVERT/STEALTH TASKS: Focus on the narrow slip of positioning, 
   noticing a shadow, or a guard looking away at the perfect moment.
4. ABSOLUTE PROHIBITIONS:
   - Do NOT write physical descriptions of the environment or background lore.
   - Do NOT describe weapon crossfires or combat actions unless the check was explicitly physical.
   - Never permanently strip player agency or conclude a scene definitively.`;

            userPayload = `## CRITICAL CANON DATA (ALWAYS TRUE)
${canonData !== "NO_MATCHING_CANON_DATA_FOUND" ? canonData : "No specific canon context matched."}

## CURRENT ENVIRONMENT STATE
${currentEnvironment}

## CONVERSATION TRACKING HISTORY
${chatHistory}

## PLAYER ACTION & RESOLUTION MARGIN
"${characterName} attempts: ${request}"

## EXECUTION ORDER
Output ONLY the direct consequence of the action as a Game Master. Do not append structural labels or summaries.`;
            break;
    }

    return { systemDirective, userPayload };
}