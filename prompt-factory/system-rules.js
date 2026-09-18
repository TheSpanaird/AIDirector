// modules/ai-director/scripts/prompt-factory/system-rules.js

import { OllamaClient } from "../api/ollama-client.js"; 
import { MODULE_ID } from "../settings.js";

export const SYSTEM_RULES_REGISTRY = {
    "cpr": `
        SYSTEM: Cyberpunk RED
        STATS: INT, REF, DEX, TECH, COOL, WILL, MOVE, BODY, EMP
        SKILLS: 
            Accounting (INT), Animal Handling (INT), Bureaucracy (INT), Business (INT), Composition (INT), Conceal/Reveal Object (INT), Criminology (INT), Cryptography (INT), Deduction (INT), Education (INT), Gamble (INT), Language (INT), Library Search (INT), Lip Reading (INT), Local Expert (INT), Perception (INT), Science (INT), Streetslang (INT), Tactics (INT), Tracking (INT), Wilderness Survival (INT),
            Drive Land Vehicle (REF), Pilot Air Vehicle (REF), Pilot Sea Vehicle (REF), Riding (REF),
            Athletics (DEX), Contortionist (DEX), Dance (DEX), Stealth (DEX),
            Air Vehicle Tech (TECH), Basic Tech (TECH), Cybertech (TECH), Demolitions (TECH), Electronics/Security Tech (TECH), First Aid (TECH), Forgery (TECH), Land Vehicle Tech (TECH), Paint/Draw/Sculpt (TECH), Paramedic (TECH), Photography/Film (TECH), Pick Lock (TECH), Pick Pocket (TECH), Play Instrument (TECH), Sea Vehicle Tech (TECH), Weaponstech (TECH),
            Acting (COOL), Bribery (COOL), Interrogation (COOL), Persuasion (COOL), Personal Grooming (COOL), Streetwise (COOL), Trading (COOL), Wardrobe & Style (COOL),
            Concentration (WILL), Endurance (WILL), Resist Torture/Drugs (WILL),
            Conversation (EMP), Human Perception (EMP), Facedown
        SPECIAL MECHANICS:
            Facedown: A duel of wills to intimidate or force an opponent to back down. Uses 1d10 + COOL + Reputation vs NPC's 1d10 + COOL + Reputation. Loser backs down or suffers a -2 penalty to actions if they fight.
        DIFFICULTY METRIC: Target DV (9 = Simple, 13 = Everyday, 17 = Professional, 21 = Heroic)
    `,
    "dnd5e": `
        SYSTEM: Dungeons & Dragons 5th Edition
        STATS: STR, DEX, CON, INT, WIS, CHA
        SKILLS: 
            Athletics (STR), 
            Acrobatics (DEX), Sleight of Hand (DEX), Stealth (DEX), 
            Arcana (INT), History (INT), Investigation (INT), Nature (INT), Religion (INT), 
            Animal Handling (WIS), Insight (WIS), Medicine (WIS), Perception (WIS), Survival (WIS), 
            Deception (CHA), Intimidation (CHA), Performance (CHA), Persuasion (CHA)
        DIFFICULTY METRIC: Target DC (10 = Easy, 15 = Medium, 20 = Hard, 25 = Very Hard)
    `,
    "sw5e": `
        SYSTEM: Star Wars 5th Edition (SW5e)
        STATS: STR, DEX, CON, INT, WIS, CHA
        SKILLS: 
            Athletics (STR),
            Acrobatics (DEX), Sleight of Hand (DEX), Stealth (DEX),
            Investigation (INT), Lore (INT), Nature (INT), Piloting (INT), Technology (INT),
            Animal Handling (WIS), Insight (WIS), Medicine (WIS), Perception (WIS), Survival (WIS),
            Deception (CHA), Intimidation (CHA), Performance (CHA), Persuasion (CHA)
        DIFFICULTY METRIC: Target DC (10 = Easy, 15 = Medium, 20 = Hard, 25 = Very Hard)
    `
};

export async function classifyPlayerIntent(playerInput) {
    const activeSystem = typeof game !== "undefined" ? game.system?.id : "cpr";
    const systemRules = SYSTEM_RULES_REGISTRY[activeSystem] || SYSTEM_RULES_REGISTRY["cpr"];

    const classificationPrompt = `
    You are the AI Director intent classification engine for a tabletop RPG session.
    Your task is to analyze the following player input and determine if it requires a mechanical resolution check.

    CRITICAL RULES:
    1. If the player is acting against the static environment, a hazard, or an unresisting object, set "checkType" to "STANDARD" and provide an appropriate "suggestedDV" (or "suggestedDC").
    2. If the player is actively competing against an NPC, sneaking past an alert guard, lying to a merchant, or wrestling an enemy, set "checkType" to "CONTESTED".
    3. For "CONTESTED" checks, you MUST specify an "opposingSkill" representing the NPC's defensive reaction (e.g., Perception, Cool, Athletics) and set "suggestedDV" to a default baseline target (like 13 or 14).

    ========================================================================
    [SYSTEM MATRIX RULE: CONTESTED SKILL SELECTION]
    ========================================================================
    When evaluating an action where a player is directly competing with an NPC, 
    the task type is "CONTESTED". You must follow these skill pairing constraints:

    1. ABSOLUTELY NO COMBAT SKILLS: Do not use Evasion, Brawling, Martial Arts, 
       or Melee Weapon for contested skill checks. Combat uses standard defense DVs.
    2. SPECIAL FACEDOWN RULES (HIGH PRIORITY):
       - If the player is attempting to glare down, stare down, intimidate an enemy through sheer presence/reputation, or trigger a standoff duel of wills, you MUST use these exact literal parameters:
         * "skill": "Facedown"
         * "stat": "COOL + Reputation"
         * "checkType": "CONTESTED"
         * "opposingSkill": "Facedown"
    3. CONTESTED SOCIAL/COVERT MATRICES:
       - If Player uses STEALTH ──> NPC Opposing Skill MUST be PERCEPTION.
       - If Player uses PERSUASION/CONVERSATION ──> NPC Opposing Skill MUST be HUMAN PERCEPTION.
       - If Player uses INTERROGATION ──> NPC Opposing Skill MUST be HUMAN PERCEPTION or COOL.
       - If Player uses BRIBERY/TRADING ──> NPC Opposing Skill MUST be TRADING or COOL.
       - If Player uses FORGERY ──> NPC Opposing Skill MUST be EDUCATION or CRIMINOLOGY.

    Match the NPC's counter-skill dynamically to their *active* mental or social resistance, never a physical dodge.

    UI INTERACTION MODES (CHOOSE EXACTLY ONE FOR "suggestedMode"):
    - "yesno": The player is asking a direct factual question, checking lore, or looking for a short confirmation.
    - "observe": The player is asking for an immediate environmental description.
    - "npcchat": The player is actively speaking or acting directly toward a specific NPC.
    - "action": The player is describing a physical effort, a hack, or a declaration of physical consequence.

    Target System Context:
    ${systemRules}

    Player Input: "${playerInput}"

    Respond ONLY with a valid raw JSON object. Do not include markdown formatting, code blocks, intro text, or outro text. 

    JSON Output Structure:
    {
      "requiresRoll": true,
      "checkType": "STANDARD" | "CONTESTED", 
      "stat": "TECH" | "COOL + Reputation",           
      "skill": "Electronics/Security Tech" | "Facedown",    
      "suggestedDV": 13,     
      "suggestedMode": "action", 
      "opposingSkill": "Perception" | "Facedown" | null, 
      "reasoning": "Brief explanation of the routing and rule alignment"
    }
    `;

    // Updated setting key to "modelName" with protective try/catch wrap
    let fallbackModel = "hermes3";
    try {
        if (typeof game !== "undefined" && game.settings) {
            fallbackModel = game.settings.get(MODULE_ID, "modelName") || "hermes3";
        }
    } catch (e) {
        console.warn("AI Director | 'modelName' fetch bypassed system-rules.js constraint checks. Defaulting to hermes3.");
    }

    try {
        const rawJsonResult = await OllamaClient.chat([
            { role: "user", content: classificationPrompt }
        ], { 
            model: fallbackModel,
            temperature: 0.1,
            num_predict: 200
        });
        
        const cleanJsonString = (rawJsonResult || "").replace(/```json|```/g, "").trim();
        return JSON.parse(cleanJsonString);
    } catch (err) {
        console.error("AI Director | Intent Classification failed:", err);
        return { requiresRoll: false, suggestedMode: "action" }; 
    }
}