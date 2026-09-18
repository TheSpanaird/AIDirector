// modules/ai-director/scripts/data/secret-materialization-manager.js

export const SECRET_TYPES = Object.freeze([
    "HIDDEN_CLUE",
    "MYSTERY",
    "REVELATION",
    "EVIDENCE",
    "HIDDEN_ACCESS",
    "HIDDEN_LOCATION",
    "GENERAL_SECRET"
]);

export const SECRET_VISIBILITY = Object.freeze([
    "HIDDEN",
    "GM_ONLY",
    "REVEALED"
]);

export const SECRET_STATES = Object.freeze([
    "UNDISCOVERED",
    "DISCOVERED",
    "REVEALED",
    "RESOLVED"
]);

export const SECRET_SOURCE_TYPES = Object.freeze([
    "CLUE",
    "MYSTERY",
    "REVELATION",
    "EVIDENCE",
    "DISCOVERY"
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

export class SecretMaterializationManager {
    static inferSecretType(
        text = "",
        sourceType = "CLUE"
    ) {
        const normalized =
            normalizeText(text).toLowerCase();

        const normalizedSource =
            normalizeText(
                sourceType,
                "CLUE"
            ).toUpperCase();

        if (
            normalized.includes("passage") ||
            normalized.includes("door") ||
            normalized.includes("entrance") ||
            normalized.includes("tunnel") ||
            normalized.includes("route")
        ) {
            return "HIDDEN_ACCESS";
        }

        if (
            normalized.includes("location") ||
            normalized.includes("lair") ||
            normalized.includes("hideout") ||
            normalized.includes("sanctum") ||
            normalized.includes("base")
        ) {
            return "HIDDEN_LOCATION";
        }

        if (normalizedSource === "REVELATION") {
            return "REVELATION";
        }

        if (normalizedSource === "MYSTERY") {
            return "MYSTERY";
        }

        if (
            normalizedSource === "EVIDENCE" ||
            normalized.includes("evidence") ||
            normalized.includes("proof")
        ) {
            return "EVIDENCE";
        }

        if (normalizedSource === "CLUE") {
            return "HIDDEN_CLUE";
        }

        return "GENERAL_SECRET";
    }

    static buildTitle(text = "") {
        const normalized = normalizeText(
            text,
            "Unknown Secret"
        );

        if (normalized.length <= 80) {
            return normalized;
        }

        return `${normalized.slice(0, 77).trim()}...`;
    }

    static materialize(
        text,
        {
            sourceType = "CLUE",
            opportunityId = null,
            sourceRefs = []
        } = {}
    ) {
        const description = normalizeText(text);

        if (!description) {
            return null;
        }

        const normalizedSource = normalizeText(
            sourceType,
            "CLUE"
        ).toUpperCase();

        const validSourceType =
            SECRET_SOURCE_TYPES.includes(normalizedSource)
                ? normalizedSource
                : "CLUE";

        return {
            secretId: crypto.randomUUID(),
            secretType: this.inferSecretType(
                description,
                validSourceType
            ),
            sourceType: validSourceType,
            title: this.buildTitle(description),
            description,
            visibility: "GM_ONLY",
            secretState: "UNDISCOVERED",
            discoveredAt: null,
            revealedAt: null,
            resolvedAt: null,
            sourceOpportunityId:
                normalizeText(opportunityId) || null,
            sourceRefs: normalizeSourceRefs(sourceRefs)
        };
    }

    static shouldMaterializeClue(
        clue = "",
        index = 0
    ) {
        const text = normalizeText(clue).toLowerCase();

        if (!text) {
            return false;
        }

        if (
            text.includes("hidden") ||
            text.includes("secret") ||
            text.includes("concealed") ||
            text.includes("encrypted") ||
            text.includes("coded") ||
            text.includes("unknown") ||
            text.includes("who ") ||
            text.includes("what ") ||
            text.includes("where ") ||
            text.includes("why ") ||
            text.includes("how ") ||
            text.endsWith("?")
        ) {
            return true;
        }

        return index % 2 === 1;
    }
}

if (typeof window !== "undefined") {
    window.AIDirector = window.AIDirector || {};

    window.AIDirector.SECRET_TYPES =
        SECRET_TYPES;

    window.AIDirector.SECRET_VISIBILITY =
        SECRET_VISIBILITY;

    window.AIDirector.SECRET_STATES =
        SECRET_STATES;

    window.AIDirector.SECRET_SOURCE_TYPES =
        SECRET_SOURCE_TYPES;

    window.AIDirector.SecretMaterializationManager =
        SecretMaterializationManager;
}
