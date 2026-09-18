// spaceship-quality-validator.js
import { SpaceshipAcceptanceLibrary }
  from "./spaceship-acceptance-library.js";

export class SpaceshipQualityValidator {
  static validate(layout = {}, archetypeId = "FREIGHTER") {
    const rules = SpaceshipAcceptanceLibrary.resolve(archetypeId);
    const sectors = Array.isArray(layout.sectors) ? layout.sectors : [];
    const openings = layout.openingPlan?.openings || layout.openings || [];
    const purposes = sectors.map(sector =>
      String(sector.purpose || sector.roomType || "").toUpperCase()
    );
    const problems = [];

    for (const purpose of rules.requiredPurposes) {
      if (!purposes.includes(purpose)) {
        problems.push({ check: "requiredPurpose", purpose, problem: "missing-required-purpose" });
      }
    }

    for (const purpose of rules.forbiddenPurposes) {
      if (purposes.includes(purpose)) {
        problems.push({ check: "forbiddenPurpose", purpose, problem: "forbidden-purpose-present" });
      }
    }

    for (const [first, second] of rules.requiredAdjacencies) {
      if (!this._purposeConnectionExists(sectors, openings, first, second)) {
        problems.push({ check: "requiredAdjacency", first, second, problem: "required-purpose-connection-missing" });
      }
    }

    for (const [first, second] of rules.prohibitedAdjacencies) {
      if (this._purposeConnectionExists(sectors, openings, first, second)) {
        problems.push({ check: "prohibitedAdjacency", first, second, problem: "prohibited-purpose-connection-present" });
      }
    }

    const exteriorAirlock = openings.some(opening =>
      opening.targetId === "__exterior__" &&
      opening.exterior === true &&
      ["AIRLOCK", "ENTRY"].includes(
        this._purposeForId(sectors, opening.sourceId || opening.hostId)
      )
    );
    if (!exteriorAirlock) {
      problems.push({ check: "airlock", problem: "missing-exterior-airlock" });
    }

    const reachable = this._openingReachability(sectors, openings);
    problems.push(...reachable.problems);

    const zoneResults = rules.zones.map(zone => ({
      zone,
      count: sectors.filter(sector =>
        String(sector.architecturalZone || "").toUpperCase() === zone
      ).length
    }));

    return {
      valid: problems.length === 0,
      archetypeId: rules.id,
      rules,
      problems,
      metrics: {
        rooms: sectors.length,
        openings: openings.length,
        exteriorAirlock,
        reachableRooms: reachable.reached,
        zones: zoneResults
      }
    };
  }

  static compareDeterminism(first = {}, second = {}) {
    return { valid: this._signature(first) === this._signature(second) };
  }

  static compareVariability(first = {}, second = {}) {
    return { valid: this._signature(first) !== this._signature(second) };
  }

  static _purposeConnectionExists(sectors, openings, firstPurpose, secondPurpose) {
    const firstIds = new Set(
      sectors.filter(sector => this._purpose(sector) === firstPurpose)
        .map(sector => sector.sectorId)
    );
    const secondIds = new Set(
      sectors.filter(sector => this._purpose(sector) === secondPurpose)
        .map(sector => sector.sectorId)
    );

    if (firstPurpose === "CENTRAL_PASSAGE") firstIds.add("central-passage");
    if (secondPurpose === "CENTRAL_PASSAGE") secondIds.add("central-passage");

    return openings.some(opening =>
      (firstIds.has(opening.sourceId) && secondIds.has(opening.targetId)) ||
      (secondIds.has(opening.sourceId) && firstIds.has(opening.targetId))
    );
  }

  static _openingReachability(sectors, openings) {
    const graph = new Map(sectors.map(sector => [sector.sectorId, new Set()]));
    for (const opening of openings) {
      if (!graph.has(opening.sourceId) || !graph.has(opening.targetId)) continue;
      graph.get(opening.sourceId).add(opening.targetId);
      graph.get(opening.targetId).add(opening.sourceId);
    }
    const start = graph.has("central-passage")
      ? "central-passage"
      : sectors[0]?.sectorId;
    const visited = new Set(start ? [start] : []);
    const queue = start ? [start] : [];
    while (queue.length) {
      for (const next of graph.get(queue.shift()) || []) {
        if (!visited.has(next)) {
          visited.add(next);
          queue.push(next);
        }
      }
    }
    const problems = sectors
      .filter(sector => !visited.has(sector.sectorId))
      .map(sector => ({
        check: "reachability",
        sectorId: sector.sectorId,
        problem: "unreachable-by-actual-openings"
      }));
    return { valid: problems.length === 0, problems, reached: visited.size };
  }

  static _purposeForId(sectors, sectorId) {
    return this._purpose(
      sectors.find(sector => sector.sectorId === sectorId) || {}
    );
  }

  static _purpose(sector) {
    return String(sector.purpose || sector.roomType || "").toUpperCase();
  }

  static _signature(layout) {
    return JSON.stringify(
      (layout.sectors || [])
        .map(sector => [
          sector.sectorId,
          sector.gridPosition,
          sector.gridDimensions,
          sector.architecturalZone
        ])
        .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
    );
  }
}
