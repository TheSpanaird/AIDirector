// modules/ai-director/scripts/ai/state-manager.js

import { buildDefaultNPCProfile } from "./npc-profile-builder.js";

/**
 * Manages the persistence and retrieval of NPC state (traits, relationships, memory).
 * Unified to read/write cleanly to the core "profile" data flag.
 */
export const StateManager = {
    async getActorState(actor) {
        if (!actor) return null;
        // Fetch centralized data profile flag parameters
        let profile = await actor.getFlag("ai-director", "profile");
        if (!profile) {
            profile = buildDefaultNPCProfile(actor);
            await actor.setFlag("ai-director", "profile", profile);
        }
        return profile;
    },

    async updateState(actor, newState) {
        if (!actor || !newState) return;
        await actor.setFlag("ai-director", "profile", newState);
    },

    async updateTrust(actor, delta) {
        const profile = await this.getActorState(actor);
        if (!profile) return;

        // Ensure structural tree definitions exist cleanly
        if (!profile.relationships) profile.relationships = {};
        if (!profile.relationships.party) {
            profile.relationships.party = {
                disposition: "Neutral",
                trust: 5,
                historyLog: "No prior significant interactions recorded with the party."
            };
        }

        // Clamp values safely on the core schema tracking parameters (1-9 scale)
        let currentTrust = profile.relationships.party.trust ?? 5;
        profile.relationships.party.trust = Math.min(9, Math.max(1, currentTrust + delta));
        
        // Synchronized disposition tracking conditions
        const currentTrustScore = profile.relationships.party.trust;
        if (currentTrustScore > 7) profile.relationships.party.disposition = "Loyal";
        else if (currentTrustScore > 5) profile.relationships.party.disposition = "Friendly";
        else if (currentTrustScore < 3) profile.relationships.party.disposition = "Hostile";
        else if (currentTrustScore === 3) profile.relationships.party.disposition = "Suspicious";
        else profile.relationships.party.disposition = "Neutral";
        
        await this.updateState(actor, profile);
    },

    /**
     * Securely resolves an actor's parent faction from the global registry setting.
     * Maintains stateless decoupling by reading settings directly to avoid circular imports.
     * 
     * @param {Actor} actor - The target Foundry Actor document.
     * @returns {Promise<Object|null>} The matched faction object from the registry, or null.
     */
    async getActorFaction(actor) {
        const profile = await this.getActorState(actor);
        if (!profile || !profile.factionId) return null;

        // Safely fetch registry setting array while checking environment boundaries
        const registry = (typeof game !== "undefined" && game.settings)
            ? (game.settings.get("ai-director", "faction-registry") || [])
            : [];
        
        return registry.find(f => f.id === profile.factionId) || null;
    }
};