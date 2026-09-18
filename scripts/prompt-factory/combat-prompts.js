// modules/ai-director/scripts/prompt-factory/combat-prompts.js

/**
 * Generates tactical AI combat directives for NPCs based on active encounter maps.
 * @param {string} request - The action or trigger initiating the combat pass.
 * @param {object} ctx - Structural context payload.
 * @returns {object} Compiled system and user instructions.
 */
export function buildCombatPrompt(request, ctx) {
    const activeCombat = typeof game !== "undefined" ? game.combats?.active : null;
    const currentRound = activeCombat ? activeCombat.round : 0;
    const currentTurnActor = activeCombat?.combatant?.actor?.name || "Active Hostile";

    const systemDirective = `You are the AI Tactical Director. Your objective is to adjudicate tactical combat positioning, weapon choice, threat profiling, and immediate environmental round resolution.
CRITICAL CONSTRAINT PRINCIPLES:
- Focus strictly on gritty, tactical combat positioning, cover usage, ammunition limits, and realistic combat pacing.
- Adhere strictly to the mechanical constraints of the active system ruleset.
- Do NOT control player internal thoughts or describe permanent physical mutilation unless damage rules explicitly demand it.
- Output ONLY the combat action or tactical resolution. No meta-commentary, rules arguments, or filler text.`;

    const userPayload = `## COMBAT ENVIRONMENT DATA
- Active Encounter Status: Round ${currentRound}
- Current Tactical Turn: ${currentTurnActor}
- Grid Environmental Context: ${ctx.currentOutput || "Immediate combat arena."}

## RECENT ENGAGEMENT TIMELINE
${ctx.state?.recentEvents?.join("\n") || "Initiative brackets locked. Firefights active."}

## TACTICAL ACTION INPUT
"${request}"

## EXECUTION ORDER
Output ONLY the direct cinematic and tactical consequence of the combat action. Do not include markdown procedural titles, damage calculations text, or summary labels.`;

    return { systemDirective, userPayload };
}