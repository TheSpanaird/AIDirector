// hybrid-connection-planner.js
// Selects direct room doors, hallway access, and corridor extensions.
import { CorridorRouterEngine }
  from "/modules/ai-director/scripts/cartographer/corridor-router-engine.js";

export class HybridConnectionPlanner {
  static plan(sectors = [], profile = {}, config = {}) {
    const requirements = CorridorRouterEngine.extractConnections(sectors, {
      connectionPolicy: config.connectionPolicy || profile.connectionPolicy || "PRESERVE_GRAPH"
    });
    const knownPairs = new Set(requirements.map(connection =>
      [connection.sourceId, connection.targetId].sort().join(":")
    ));
    for (const sector of sectors) {
      if (!sector.preferredAccessFrom) continue;
      const pair = [sector.sectorId, sector.preferredAccessFrom].sort().join(":");
      if (knownPairs.has(pair)) continue;
      requirements.push({
        sourceId: sector.preferredAccessFrom,
        targetId: sector.sectorId,
        connectionType: "SHARED_WALL",
        doorType: "STANDARD",
        required: true,
        generatedBy: "PARTITION_ACCESS"
      });
      knownPairs.add(pair);
    }
    const candidates = CorridorRouterEngine.planConnectionModes(requirements, sectors, {
      ...config,
      preferSharedWalls: true
    });
    const maximumRoomDegree = Math.max(1, Number(config.maximumRoomDegree || profile.maximumRoomDegree) || 3);
    const degree = new Map();
    const shared = [];
    const deferred = [];
    const sorted = [...(candidates.shared || [])].sort((a, b) =>
      this._directScore(b, sectors, profile) - this._directScore(a, sectors, profile)
    );
    for (const connection of sorted) {
      const sourceDegree = degree.get(connection.sourceId) || 0;
      const targetDegree = degree.get(connection.targetId) || 0;
      const allowed = sourceDegree < maximumRoomDegree && targetDegree < maximumRoomDegree &&
        this._directScore(connection, sectors, profile) >= 0;
      if (!allowed) {
        deferred.push({ ...connection, preferredMode: "HALLWAY_ACCESS" });
        continue;
      }
      shared.push({ ...connection, accessMode: "SHARED_WALL" });
      degree.set(connection.sourceId, sourceDegree + 1);
      degree.set(connection.targetId, targetDegree + 1);
    }
    const rooted = this._reachableFromEntry(sectors, shared);
    const pattern = String(config.corridorPattern || profile.corridorPattern || "MINIMAL").toUpperCase();
    const hallwayDominant = ["CENTRAL_HALL", "PUBLIC_SPINE", "SERVICE_SPINE", "MODULAR_GRID", "DECK_SPINE", "LAYERED", "DEFENSIVE_RING"].includes(pattern);
    const hallwaySectorIds = sectors
      .filter(sector => sector.hallwayAccessCandidate !== false)
      .filter(sector => hallwayDominant || !rooted.has(sector.sectorId) || this._requiresHall(sector))
      .map(sector => sector.sectorId);
    return {
      mode: "HYBRID_ACCESS",
      requirements,
      shared,
      deferred,
      routedRequirements: [...(candidates.routed || []), ...deferred],
      hallwaySectorIds: [...new Set(hallwaySectorIds)],
      maximumRoomDegree,
      degree: Object.fromEntries(degree)
    };
  }

  static _directScore(connection, sectors, profile) {
    const source = sectors.find(sector => sector.sectorId === connection.sourceId) || {};
    const target = sectors.find(sector => sector.sectorId === connection.targetId) || {};
    const pair = [this._purpose(source), this._purpose(target)];
    let score = profile.sharedWallPreference === true || profile.preferSharedWalls === true ? 20 : 0;
    if (pair.some(value => value.includes("STORAGE")) && pair.some(value => /KITCHEN|SERVICE|RECORD/.test(value))) score += 50;
    if (pair.some(value => value.includes("BATH")) && pair.some(value => value.includes("BED"))) score += 50;
    if (pair.some(value => /ENTRY|FOYER/.test(value)) && pair.some(value => /LIVING|PUBLIC|RECEPTION/.test(value))) score += 30;
    if (pair.some(value => /BED|PRIVATE|SECURITY|COMMAND/.test(value)) && pair.some(value => /KITCHEN|SERVICE|PUBLIC/.test(value))) score -= 60;
    return score;
  }

  static _requiresHall(sector) {
    const purpose = this._purpose(sector);
    return /OFFICE|BEDROOM|PRIVATE|SECURITY|RESTROOM|BATHROOM|STAIR|ELEVATOR/.test(purpose);
  }

  static _reachableFromEntry(sectors, connections) {
    const entry = sectors.find(sector => String(sector.graphRole || "").toUpperCase() === "ENTRY") || sectors[0];
    const reachable = new Set(entry ? [entry.sectorId] : []);
    let changed = true;
    while (changed) {
      changed = false;
      for (const connection of connections) {
        if (reachable.has(connection.sourceId) && !reachable.has(connection.targetId)) {
          reachable.add(connection.targetId); changed = true;
        }
        if (reachable.has(connection.targetId) && !reachable.has(connection.sourceId)) {
          reachable.add(connection.sourceId); changed = true;
        }
      }
    }
    return reachable;
  }

  static _purpose(sector = {}) {
    return String(sector.purpose || sector.sectorPurpose || sector.roomType || sector.name || "ROOM")
      .trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_");
  }
}
