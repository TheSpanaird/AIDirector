// modules/ai-director/scripts/data/threat-materialization-manager.js

export const THREAT_TYPES = Object.freeze([
    "HOSTILE_FORCE",
    "PATROL",
    "AMBUSH",
    "CREATURE",
    "ELITE",
    "BOSS",
    "SURVEILLANCE",
    "GENERAL_THREAT"
]);

export const THREAT_SEVERITY = Object.freeze([
    "LOW",
    "MEDIUM",
    "HIGH",
    "CRITICAL"
]);

export const THREAT_VISIBILITY = Object.freeze([
    "VISIBLE",
    "HIDDEN",
    "CONCEALED",
    "UNKNOWN"
]);

export const THREAT_STATES = Object.freeze([
    "UNKNOWN",
    "IDENTIFIED",
    "ACTIVE",
    "DEFEATED",
    "ESCAPED",
    "RESOLVED"
]);

function normalizeText(value, fallback = "") {
    return String(value ?? fallback).trim();
}

function normalizeSourceRefs(value) {
    if (!Array.isArray(value)) {
        return [];
    }

    return [
        ...new Set(
            value
                .map(entry => normalizeText(entry))
                .filter(Boolean)
        )
    ];
}

export class ThreatMaterializationManager {
    static inferThreatType(threat = "") {
        const text =
            normalizeText(threat).toLowerCase();

        if (
            text.includes("boss") ||
            text.includes("leader") ||
            text.includes("commander") ||
            text.includes("priestess") ||
            text.includes("warlord")
        ) {
            return "BOSS";
        }

        if (
            text.includes("elite") ||
            text.includes("champion") ||
            text.includes("veteran")
        ) {
            return "ELITE";
        }

        if (
            text.includes("ambush") ||
            text.includes("assassin")
        ) {
            return "AMBUSH";
        }

        if (
            text.includes("patrol") ||
            text.includes("guard") ||
            text.includes("soldier")
        ) {
            return "PATROL";
        }

        if (
            text.includes("monster") ||
            text.includes("creature") ||
            text.includes("beast") ||
            text.includes("undead") ||
            text.includes("construct")
        ) {
            return "CREATURE";
        }

        if (
            text.includes("surveillance") ||
            text.includes("watcher") ||
            text.includes("spy") ||
            text.includes("spies") ||
            text.includes("informant")
        ) {
            return "SURVEILLANCE";
        }

        if (
            text.includes("cult") ||
            text.includes("gang") ||
            text.includes("force") ||
            text.includes("network") ||
            text.includes("hostile")
        ) {
            return "HOSTILE_FORCE";
        }

        return "GENERAL_THREAT";
    }

    static inferSeverity(threat = "") {
        const text =
            normalizeText(threat).toLowerCase();

        if (
            text.includes("boss") ||
            text.includes("warlord") ||
            text.includes("overwhelming") ||
            text.includes("deadly")
        ) {
            return "CRITICAL";
        }

        if (
            text.includes("elite") ||
            text.includes("assassin") ||
            text.includes("commander") ||
            text.includes("priestess")
        ) {
            return "HIGH";
        }

        if (
            text.includes("minor") ||
            text.includes("weak") ||
            text.includes("scout")
        ) {
            return "LOW";
        }

        return "MEDIUM";
    }

    static inferVisibility(threat = "") {
        const text =
            normalizeText(threat).toLowerCase();

        if (
            text.includes("ambush") ||
            text.includes("hidden") ||
            text.includes("secret") ||
            text.includes("assassin")
        ) {
            return "HIDDEN";
        }

        if (
            text.includes("spy") ||
            text.includes("informant") ||
            text.includes("disguised")
        ) {
            return "CONCEALED";
        }

        return "VISIBLE";
    }

    static materialize(
        threat,
        opportunityId = null,
        sourceRefs = []
    ) {
        const description =
            normalizeText(threat);

        if (!description) {
            return null;
        }

        const visibility =
            this.inferVisibility(description);

        return {
            threatId: crypto.randomUUID(),

            threatType:
                this.inferThreatType(description),

            name: description,
            description,

            severity:
                this.inferSeverity(description),

            visibility,

            threatState:
                visibility === "VISIBLE"
                    ? "ACTIVE"
                    : "UNKNOWN",

            identifiedAt:
                visibility === "VISIBLE"
                    ? Date.now()
                    : null,

            defeatedAt: null,
            resolvedAt: null,

            sourceOpportunityId:
                normalizeText(opportunityId) || null,

            sourceRefs:
                normalizeSourceRefs(sourceRefs),

            /*
             * EN-15 owns conversion into EntityPlan[].
             * This record intentionally contains no
             * actor UUID, compendium UUID, token data,
             * count, level, or placement geometry.
             */
            entityPlanningRequired: true
        };
    }
}

if (typeof window !== "undefined") {
    window.AIDirector =
        window.AIDirector || {};

    window.AIDirector.THREAT_TYPES =
        THREAT_TYPES;

    window.AIDirector.THREAT_SEVERITY =
        THREAT_SEVERITY;

    window.AIDirector.THREAT_VISIBILITY =
        THREAT_VISIBILITY;

    window.AIDirector.THREAT_STATES =
        THREAT_STATES;

    window.AIDirector
        .ThreatMaterializationManager =
            ThreatMaterializationManager;
}