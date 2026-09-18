// building-program-planner.js
// Resolves deterministic building-level requirements before floor layout.
export class BuildingProgramPlanner {
  static plan(manifest = {}, profile = {}, sectors = [], config = {}) {
    const floors = [...new Set(sectors.map(sector => Number(sector.floor || 1)))].sort((a, b) => a - b);
    const floorCount = Math.max(1, Number(manifest.floorCount) || floors.length || 1);
    const seed = String(config.layoutSeed || manifest.layoutSeed || manifest.manifestId || manifest.dungeonTitle || "cartographer");
    const entranceCount = Math.max(1, Number(config.entranceCount ?? profile.entranceCount ?? manifest.entranceCount) || 1);
    const vertical = manifest.verticalCirculation && typeof manifest.verticalCirculation === "object"
      ? manifest.verticalCirculation
      : {};
    const needsVerticalCore = floorCount > 1 || sectors.some(sector => this._purpose(sector).includes("STAIR") || this._purpose(sector).includes("ELEVATOR"));
    const stairWidth = Math.max(3, Number(vertical.stairWidth || config.stairWidth || profile.stairWidth) || 4);
    const stairHeight = Math.max(4, Number(vertical.stairHeight || config.stairHeight || profile.stairHeight) || 5);
    return Object.freeze({
      profileId: profile.id || null,
      layoutFamily: profile.family || null,
      seed,
      floorRange: structuredClone(
        profile.floorRange || [1, 1]
      ),
      floorCount,
      floors: floors.length ? floors : [1],
      entranceCount,
      emergencyExitCount: Math.max(0, Number(config.emergencyExitCount ?? profile.emergencyExitCount ?? (floorCount > 1 ? 1 : 0)) || 0),
      corridorPattern: String(config.corridorPattern || profile.corridorPattern || "MINIMAL").toUpperCase(),
      secondaryNetworks: structuredClone(
        profile.secondaryNetworks || []
      ),
      sharedWallPreference: config.preferSharedWalls ?? profile.preferSharedWalls ?? profile.sharedWallPreference ?? false,
      maximumRoomDegree: Math.max(1, Number(config.maximumRoomDegree || profile.maximumRoomDegree) || 3),
      partitionBuildings: config.partitionBuildings !== false,
      hallOrientation: this._seedHash(`${seed}:hall`) % 2 === 0 ? "VERTICAL" : "VERTICAL",
      entranceSide: ["NORTH", "SOUTH"][this._seedHash(`${seed}:entrance`) % 2],
      verticalCores: needsVerticalCore ? [{
        id: "primary-stair",
        type: "STAIR",
        width: stairWidth,
        height: stairHeight,
        alignedAcrossFloors: true
      }] : [],
      source: "BUILDING_PROGRAM"
    });
  }

  static _seedHash(value) {
    let hash = 2166136261;
    for (const character of String(value || "")) {
      hash ^= character.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  static _purpose(sector = {}) {
    return String(sector.purpose || sector.sectorPurpose || sector.roomType || sector.name || "ROOM")
      .trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_");
  }
}
