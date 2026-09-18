// multi-level-contract-validator.js
// Presentation-neutral validation for semantic multi-floor manifests.

export class MultiLevelContractValidator {
  static PRESENTATIONS = Object.freeze([
    "STACKED_CANVAS",
    "SEPARATE_SCENES"
  ]);

  static CONNECTOR_TYPES = Object.freeze([
    "STAIR",
    "ELEVATOR",
    "LADDER",
    "HATCH",
    "RAMP",
    "MAINTENANCE_SHAFT"
  ]);

  static validate(manifest = {}) {
    const problems = [];
    const sectors = Array.isArray(manifest.sectors) ? manifest.sectors : [];
    const floors = Array.isArray(manifest.floors) ? manifest.floors : [];
    const verticalConnections = Array.isArray(manifest.verticalConnections)
      ? manifest.verticalConnections
      : [];

    const floorIds = floors.map(floor => Number(floor.floor));
    const floorSet = new Set(floorIds);
    const sectorById = new Map(sectors.map(sector => [sector.sectorId, sector]));

    if (!Number.isInteger(Number(manifest.floorCount)) || Number(manifest.floorCount) < 1) {
      problems.push({ check: "floorCount", problem: "invalid-floor-count" });
    }
    if (Number(manifest.floorCount) !== floors.length) {
      problems.push({
        check: "floorCount",
        expected: floors.length,
        actual: Number(manifest.floorCount),
        problem: "floor-count-does-not-match-floors"
      });
    }
    if (!this.PRESENTATIONS.includes(String(manifest.floorPresentation || "").toUpperCase())) {
      problems.push({ check: "floorPresentation", problem: "unsupported-presentation" });
    }
    if (new Set(floorIds).size !== floorIds.length) {
      problems.push({ check: "floors", problem: "duplicate-floor-number" });
    }
    for (const floor of floors) {
      if (!Number.isInteger(Number(floor.floor))) {
        problems.push({ check: "floors", floor: floor.floor, problem: "invalid-floor-number" });
      }
      if (!String(floor.name || "").trim()) {
        problems.push({ check: "floors", floor: floor.floor, problem: "missing-floor-name" });
      }
      if (!String(floor.role || "").trim()) {
        problems.push({ check: "floors", floor: floor.floor, problem: "missing-floor-role" });
      }
    }

    for (const sector of sectors) {
      if (!floorSet.has(Number(sector.floor))) {
        problems.push({
          check: "sectorFloor",
          sectorId: sector.sectorId,
          floor: sector.floor,
          problem: "sector-references-undeclared-floor"
        });
      }
    }
    for (const floorId of floorIds) {
      if (!sectors.some(sector => Number(sector.floor) === floorId)) {
        problems.push({ check: "floorCoverage", floor: floorId, problem: "declared-floor-empty" });
      }
    }

    const connectorIds = new Set();
    for (const connector of verticalConnections) {
      const id = String(connector.connectionId || "").trim();
      if (!id) {
        problems.push({ check: "verticalConnection", problem: "missing-connection-id" });
      } else if (connectorIds.has(id)) {
        problems.push({ check: "verticalConnection", connectionId: id, problem: "duplicate-connection-id" });
      } else {
        connectorIds.add(id);
      }

      const type = String(connector.connectionType || "").toUpperCase();
      if (!this.CONNECTOR_TYPES.includes(type)) {
        problems.push({ check: "verticalConnection", connectionId: id, problem: "unsupported-connection-type" });
      }

      const from = connector.from || {};
      const to = connector.to || {};
      const fromSector = sectorById.get(from.sectorId);
      const toSector = sectorById.get(to.sectorId);

      if (!fromSector) {
        problems.push({ check: "verticalConnection", connectionId: id, endpoint: "from", problem: "missing-sector" });
      }
      if (!toSector) {
        problems.push({ check: "verticalConnection", connectionId: id, endpoint: "to", problem: "missing-sector" });
      }
      if (fromSector && Number(fromSector.floor) !== Number(from.floor)) {
        problems.push({ check: "verticalConnection", connectionId: id, endpoint: "from", problem: "floor-does-not-match-sector" });
      }
      if (toSector && Number(toSector.floor) !== Number(to.floor)) {
        problems.push({ check: "verticalConnection", connectionId: id, endpoint: "to", problem: "floor-does-not-match-sector" });
      }
      if (Number(from.floor) === Number(to.floor)) {
        problems.push({ check: "verticalConnection", connectionId: id, problem: "vertical-connection-stays-on-one-floor" });
      }
      if (String(from.anchorId || "") !== String(to.anchorId || "")) {
        problems.push({ check: "verticalConnection", connectionId: id, problem: "anchor-id-not-reciprocal" });
      }
    }

    const normalAdjacency = this._normalAdjacency(sectors);
    for (const floorId of floorIds) {
      const floorSectorIds = sectors
        .filter(sector => Number(sector.floor) === floorId)
        .map(sector => sector.sectorId);
      if (!this._isConnected(floorSectorIds, normalAdjacency)) {
        problems.push({ check: "floorReachability", floor: floorId, problem: "floor-not-internally-reachable" });
      }
    }

    const fullAdjacency = new Map(
      [...normalAdjacency].map(([id, neighbors]) => [id, new Set(neighbors)])
    );
    for (const connector of verticalConnections) {
      const a = connector.from?.sectorId;
      const b = connector.to?.sectorId;
      if (!sectorById.has(a) || !sectorById.has(b)) continue;
      if (!fullAdjacency.has(a)) fullAdjacency.set(a, new Set());
      if (!fullAdjacency.has(b)) fullAdjacency.set(b, new Set());
      fullAdjacency.get(a).add(b);
      fullAdjacency.get(b).add(a);
    }
    if (!this._isConnected(sectors.map(sector => sector.sectorId), fullAdjacency)) {
      problems.push({ check: "structureReachability", problem: "structure-not-fully-reachable" });
    }

    return {
      valid: problems.length === 0,
      problems,
      metrics: {
        floors: floors.length,
        sectors: sectors.length,
        verticalConnections: verticalConnections.length,
        floorPresentation: manifest.floorPresentation || null
      }
    };
  }

  static compareDeterminism(first, second) {
    const normalize = manifest => JSON.stringify({
      floorCount: manifest.floorCount,
      floorPresentation: manifest.floorPresentation,
      floors: manifest.floors,
      sectors: (manifest.sectors || []).map(sector => ({
        sectorId: sector.sectorId,
        floor: sector.floor,
        purpose: sector.purpose,
        connections: sector.connections
      })),
      verticalConnections: manifest.verticalConnections
    });
    return { valid: normalize(first) === normalize(second) };
  }

  static _normalAdjacency(sectors) {
    const ids = new Set(sectors.map(sector => sector.sectorId));
    const adjacency = new Map(sectors.map(sector => [sector.sectorId, new Set()]));
    for (const sector of sectors) {
      for (const connection of sector.connections || []) {
        if (!ids.has(connection.to)) continue;
        const target = sectors.find(candidate => candidate.sectorId === connection.to);
        if (!target || Number(target.floor) !== Number(sector.floor)) continue;
        adjacency.get(sector.sectorId).add(connection.to);
        adjacency.get(connection.to).add(sector.sectorId);
      }
    }
    return adjacency;
  }

  static _isConnected(ids, adjacency) {
    if (!ids.length) return false;
    const allowed = new Set(ids);
    const visited = new Set();
    const queue = [ids[0]];
    while (queue.length) {
      const current = queue.shift();
      if (visited.has(current) || !allowed.has(current)) continue;
      visited.add(current);
      for (const neighbor of adjacency.get(current) || []) {
        if (allowed.has(neighbor) && !visited.has(neighbor)) queue.push(neighbor);
      }
    }
    return visited.size === allowed.size;
  }
}
