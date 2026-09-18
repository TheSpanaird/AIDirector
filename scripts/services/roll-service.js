// modules/ai-director/services/roll-service.js

import { SYSTEM_RULES_REGISTRY } from "../scripts/prompt-factory/system-rules.js";
import { FlagFactory } from "../core/flag-factory.js";

/**
 * SERVICE: Handles system-agnostic and system-specific TTRPG rule evaluations.
 * Bridges the gap between intent classification outputs and actual document sheets.
 */
export const RollService = {
    /**
     * Determines the active system identity and structural metrics.
     * @returns {Object} System ID and human-readable metadata.
     */
    getSystemContext() {
        const systemId = game?.system?.id || "cpr";
        let label = "Cyberpunk RED";
        let isD20 = false;

        if (systemId === "sw5e") {
            label = "Star Wars 5e";
            isD20 = true;
        } else if (systemId === "dnd5e") {
            label = "D&D 5th Edition";
            isD20 = true;
        }

        return { systemId, label, isD20 };
    },

    /**
     * Extracts the final operational skill/attribute base modifier for a given actor.
     * @param {Actor} actor - The native Foundry Document instance.
     * @param {string} skillName - Literal string target of the skill (e.g. "Perception").
     * @param {string} statName - Primary fallback stat (e.g. "TECH").
     * @returns {number} The absolute flat modifier value to add to the roll expression.
     */
    getActorModifier(actor, skillName = "", statName = "") {
        if (!actor) return 0;
        const { isD20 } = this.getSystemContext();

        // 1. Cyberpunk RED (Interlock System Evaluation)
        if (!isD20) {
            const cleanTarget = (skillName || "").toLowerCase().replace(/[^a-z0-9]/gi, "");
            
            // Special Handle: Facedown checks
            if (cleanTarget === "facedown") {
                const cool = Number(actor.system?.stats?.cool?.value || 0);
                const will = Number(actor.system?.stats?.will?.value || actor.system?.stats?.willpower?.value || 0);
                const rep = Number(actor.system?.reputation?.value || actor.getFlag("ai-director", "profile")?.reputation || 0);
                return cool + will + rep;
            }

            // Standard Skill Matching
            const skillKey = Object.keys(actor.system?.skills || {}).find(k => {
                const cleanKey = k.toLowerCase().replace(/[^a-z0-9]/gi, "");
                return cleanKey === cleanTarget || cleanKey.includes(cleanTarget);
            });

            if (skillKey) {
                const skillData = actor.system.skills[skillKey];
                return Number(skillData.stat || 0) + Number(skillData.level || 0) + Number(skillData.mods || 0);
            }

            // Fallback to pure attribute rating
            const targetStat = (statName || "").toLowerCase();
            return Number(actor.system?.stats?.[targetStat]?.value || 0);
        }

        // 2. d20 Engine Rulesets (DND5E / SW5E)
        const cleanTarget = (skillName || "").toLowerCase().trim();
        const skillData = actor.system?.skills?.[cleanTarget] || Object.values(actor.system?.skills || {}).find(s => s.label?.toLowerCase() === cleanTarget);

        if (skillData) {
            return Number(skillData.total || skillData.mod || 0);
        }

        const targetStat = (statName || "").toLowerCase().substring(0, 3);
        return Number(actor.system?.abilities?.[targetStat]?.mod || 0);
    },

    /**
     * Programmatically executes an automated roll expression tagged with transactional tracking metadata.
     * @param {Actor} actor - The rolling actor instance.
     * @param {Object} intent - The parsed classification object from the LLM.
     * @param {string} correlationId - Ancestral challenge identity string.
     * @returns {Promise<Roll>} The executed Foundry Roll instance.
     */
    async executeTrackedRoll(actor, intent, correlationId) {
        const { isD20, systemId } = this.getSystemContext();
        const skill = intent.skill || "";
        const stat = intent.stat || "";
        const target = intent.suggestedDV || intent.suggestedDC || 13;

        const modifier = this.getActorModifier(actor, skill, stat);
        const formula = isD20 ? `1d20 + ${modifier}` : `1d10x + ${modifier}`;

        const roll = new Roll(formula, actor.getRollData());
        await roll.evaluate();

        const outboundFlags = FlagFactory.createFlags({
            isAi: false,
            processType: "mechanical_resolution",
            correlationId: correlationId
        });

        const systemLabel = isD20 ? "DC" : "DV";
        const flavorText = `🎲 <strong>${actor.name}</strong> checks <strong>${skill || stat}</strong> (Target ${systemLabel} ${target})`;

        await roll.toMessage({
            speaker: ChatMessage.getSpeaker({ actor }),
            flavor: flavorText,
            flags: outboundFlags
        });

        return roll;
    },

    /**
     * Evaluates whether a target value meets or exceeds an objective difficulty boundary.
     * @param {number} total - Calculated final total of the dice roll.
     * @param {number} threshold - Target target difficulty scale.
     * @returns {boolean} True if the check passed.
     */
    evaluateSuccess(total, threshold) {
        // Attacker/player wins on ties across target systems
        return total >= threshold;
    }
};