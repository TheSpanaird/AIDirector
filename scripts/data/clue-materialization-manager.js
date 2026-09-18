// modules/ai-director/scripts/data/clue-materialization-manager.js

export const CLUE_TYPES = Object.freeze([
    "INVESTIGATION",
    "EVIDENCE",
    "TESTIMONY",
    "DOCUMENT",
    "PHYSICAL_TRACE",
    "ENVIRONMENTAL",
    "GENERAL_CLUE"
]);

export const CLUE_VISIBILITY = Object.freeze([
    "VISIBLE",
    "HIDDEN",
    "GM_ONLY"
]);

export const CLUE_STATES = Object.freeze([
    "UNDISCOVERED",
    "DISCOVERED",
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

export class ClueMaterializationManager {
    static inferClueType(clue = "") {
        const text = normalizeText(clue).toLowerCase();

        if (
            text.includes("blood") ||
            text.includes("footprint") ||
            text.includes("footprints") ||
            text.includes("fingerprint") ||
            text.includes("residue") ||
            text.includes("weapon") ||
            text.includes("fragment")
        ) {
            return "PHYSICAL_TRACE";
        }

        if (
            text.includes("ledger") ||
            text.includes("record") ||
            text.includes("archive") ||
            text.includes("letter") ||
            text.includes("message") ||
            text.includes("document")
        ) {
            return "DOCUMENT";
        }

        if (
            text.includes("witness") ||
            text.includes("testimony") ||
            text.includes("interview") ||
            text.includes("confession")
        ) {
            return "TESTIMONY";
        }

        if (
            text.includes("symbol") ||
            text.includes("marking") ||
            text.includes("smell") ||
            text.includes("sound") ||
            text.includes("damage") ||
            text.includes("tracks")
        ) {
            return "ENVIRONMENTAL";
        }

        if (
            text.includes("proof") ||
            text.includes("evidence") ||
            text.includes("proves") ||
            text.includes("confirms")
        ) {
            return "EVIDENCE";
        }

        if (
            text.includes("investigate") ||
            text.includes("search") ||
            text.includes("discover") ||
            text.includes("find")
        ) {
            return "INVESTIGATION";
        }

        return "GENERAL_CLUE";
    }

    static inferVisibility(clue = "") {
        const text = normalizeText(clue).toLowerCase();

        if (
            text.includes("hidden") ||
            text.includes("concealed") ||
            text.includes("secret") ||
            text.includes("encrypted") ||
            text.includes("coded") ||
            text.includes("buried")
        ) {
            return "HIDDEN";
        }

        return "VISIBLE";
    }

    static buildTitle(clue = "") {
        const text = normalizeText(clue, "Unknown Clue");

        if (text.length <= 80) {
            return text;
        }

        return `${text.slice(0, 77).trim()}...`;
    }

    static materialize(
        clue,
        opportunityId = null,
        sourceRefs = []
    ) {
        const description = normalizeText(clue);

        if (!description) {
            return null;
        }

        const visibility =
            this.inferVisibility(description);

        return {
            clueId: crypto.randomUUID(),
            clueType:
                this.inferClueType(description),

            title:
                this.buildTitle(description),

            description,
            text: description,

            visibility,

            clueState:
                visibility === "VISIBLE"
                    ? "DISCOVERED"
                    : "UNDISCOVERED",

            discoveredAt:
                visibility === "VISIBLE"
                    ? Date.now()
                    : null,

            resolvedAt: null,

            sourceOpportunityId:
                normalizeText(opportunityId) || null,

            sourceRefs:
                normalizeSourceRefs(sourceRefs)
        };
    }
}

if (typeof window !== "undefined") {
    window.AIDirector =
        window.AIDirector || {};

    window.AIDirector.CLUE_TYPES =
        CLUE_TYPES;

    window.AIDirector.CLUE_VISIBILITY =
        CLUE_VISIBILITY;

    window.AIDirector.CLUE_STATES =
        CLUE_STATES;

    window.AIDirector
        .ClueMaterializationManager =
            ClueMaterializationManager;
}