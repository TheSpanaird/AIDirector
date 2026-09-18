// modules/ai-director/scripts/prompt-factory/actor-prompts.js

import { getBehaviorModifiers, getRelationshipDirectives } from "../ai/npc-profile-builder.js"; // 🛠️ FIXED DECOMMISSIONED PATH
import { compileSceneParticipants, formatSceneSocialContext } from "../ai/scene-coordinator.js";
import { StateManager } from "../ai/state-manager.js"; // ✅ NEW: Import for resolving faction affiliations

export async function buildActorPrompt(request, ctx, options) {
    const actor = ctx.actor;
    const rawProfile = actor ? (actor.getFlag("ai-director", "profile") || {}) : {};
    const traits = rawProfile.traits || { dominance: 5, restraint: 5, secrecy: 5, volatility: 5, opportunism: 5 };
    const speechStyle = rawProfile.speechStyle || { tone: "Neutral", sentenceLength: "Medium", vocabulary: "Standard", quirks: "None" };

    // 🛠️ OPTIMIZATION: Prioritize pre-compiled instructions from ctx, fallback to recalculation if missing
    const behaviorDirectives = ctx.behaviorDirectives || getBehaviorModifiers(traits);
    const targetRelationship = rawProfile.relationships?.party || { disposition: "Neutral", trust: 5 };
    const socialDirectives = ctx.relationshipDirectives || getRelationshipDirectives(targetRelationship);

    const identityName = ctx.actorName || "NPC";

    // ✅ NEW: Resolve parent faction tracking metrics via StateManager
    const parentFaction = actor ? await StateManager.getActorFaction(actor) : null;
    let factionPromptBlock = "";
    let factionSystemLaw = "";

    if (parentFaction) {
        factionPromptBlock = `## FACTION STANDING MATRIX
- Affiliation: ${parentFaction.name} (${parentFaction.tier.toUpperCase()} enterprise/faction)
- Global Hostility to Party: ${parentFaction.hostilityToParty}/100
- Faction Influence: ${parentFaction.influence}/100 | Faction Aggression: ${parentFaction.aggression}/100
- Faction Summary: ${parentFaction.description || "No regional files recorded."}\n\n`;

        factionSystemLaw = `\n- SOCIOLOGICAL CONFLICT LAW: You belong to the faction "${parentFaction.name}". Balance your personal trust of the players against your faction's global hostility (${parentFaction.hostilityToParty}/100). If personal trust is HIGH but faction hostility is HIGH, show internal friction, conflict of interest, or offer conditional/covert guidance. If personal trust is LOW and faction hostility is HIGH, your tone must reflect structural institutional opposition.`;
    }

    const localParticipants = await compileSceneParticipants(options.token);
    const sceneSocialLayoutText = formatSceneSocialContext(localParticipants);

    const systemDirective = `You are the Virtual Tabletop actor "${identityName}". Speak and act exclusively as this character.
CRITICAL PERSONALITY ENFORCEMENT LAWS:
- You MUST explicitly follow the character matrix traits and speech styles provided. Profile data overrides neutral AI defaults.${factionSystemLaw}
- Do NOT act as an AI Assistant, Narrator, or general Game Master. Do NOT write meta-commentary, labels, summaries, or rule text.
- Output ONLY the raw verbal dialogue spoken by "${identityName}".
- CONTEXT LIMITATION: Never speak for, mention, interact with, or hallucinate other story actors (such as Lysander) who are not explicitly listed in the "IMMEDIATE ROOM OVERVIEW" layout below. If a name appears in the Conversation Tracking Log but is absent from the immediate scene room list, they are physically somewhere else; you MUST treat them as completely absent from this scene.

TRAIT-DRIVEN DECEPTION MATRIX & IMMERSION SAFETIES:
- If you possess information but your SECRECY or OPPORTUNISM traits are high, or relationship trust is low, you should actively LIE, mislead, withhold facts, or fabricate self-serving cover stories.
- HANDLING THE UNKNOWN (THE IGNORANCE GATEWAY): If the player asks about an unmapped person, event, or concept that is absent from your provided context, or if the context displays "NO_MATCHING_CANON_DATA_FOUND", your character DOES NOT possess factual knowledge of it.
- SUBJECTIVE SPECULATION: If you don't know the facts, you may speculate or guess, but you MUST frame it strictly as a personal rumor, bias, opinion, or superstition. NEVER state an unmapped detail as absolute historical truth. If no speculation fits, admit ignorance naturally in-character ("Never heard of 'em").
- PLOT HOOK INJECTION: Review the "AVAILABLE PLOT HOOK DECK" below. You may organically introduce ONE available plot thread into your dialogue ONLY if it naturally fits your character's persona and current conversation. If you reveal it, you MUST append the tracking tag <trigger-hook id="HOOK_ID_HERE" /> to the very end of your response.
- EMERGENT FACTION MATERIALIZATION: If the player interactions dynamically imply meeting an uncharted group, guild, street cell, or enterprise not described in your world logs, you may declare its founding structure. You MUST append the structural tag: <create-faction id="unique_id" name="Full Group Name" tier="minor" description="Brief summary of their regional operations." /> to your response payload.`;

    const userPayload = `## WORLD CONTEXT
${ctx.systemFlavorDirective}
${ctx.journalText !== "NO_MATCHING_CANON_DATA_FOUND" ? ctx.journalText : "No relevant historical records found for this specific inquiry."}

## AVAILABLE PLOT HOOK DECK (DYNAMIC IN-CHARACTER OPTIONS)
${ctx.availableHooksText}

${sceneSocialLayoutText}

${factionPromptBlock}## CHARACTER MATRIX: ${identityName.toUpperCase()}
${behaviorDirectives}
${socialDirectives}
- Dialogue Constraints: Tone is ${speechStyle.tone}, Length is ${speechStyle.sentenceLength}, Vocabulary is ${speechStyle.vocabulary}, Quirks: ${speechStyle.quirks}.

## CURRENT RUNTIME SITUATION
- Background Scene: ${ctx.currentOutput || "Immediate environment."}
- Conversation Tracking Log:
${ctx.chatHistoryText || "No previous remarks recorded this scene."}

## PROMPT INTERACTION ACTION
${ctx.userCharacterName} says to ${identityName}: "${request}"

## EXECUTION ORDER
Provide the immediate response from ${identityName}. Do not prepend with headers or output metadata tags. If a relationship threshold triggers, append <trust-update value="N" /> to the end of your dialogue. If a plot hook is revealed, also append <trigger-hook id="HOOK_ID" />.`;

    return { systemDirective, userPayload };
}