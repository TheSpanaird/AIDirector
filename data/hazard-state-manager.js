// modules/ai-director/scripts/data/hazard-state-manager.js

export class HazardStateManager {

    static discover(hazard) {
        hazard.hazardState = "DISCOVERED";
        hazard.discoveredAt = Date.now();
        return hazard;
    }

    static disable(hazard) {
        hazard.hazardState = "DISABLED";
        hazard.disabledAt = Date.now();
        return hazard;
    }

    static trigger(hazard) {
        hazard.hazardState = "TRIGGERED";
        hazard.triggeredAt = Date.now();
        return hazard;
    }

    static resolve(hazard) {
        hazard.hazardState = "RESOLVED";
        hazard.resolvedAt = Date.now();
        return hazard;
    }
}

if (typeof window !== "undefined") {

    window.AIDirector =
        window.AIDirector || {};

    window.AIDirector
        .HazardStateManager =
            HazardStateManager;
}
