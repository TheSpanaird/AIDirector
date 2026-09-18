(async () => {
  const NAME = "[Test] Cartographer Targeted Validation";
  const SEED = "office-validation-001";

  const requiredChecks = {
    purposeDimensionsLoaded:
      Boolean(LayoutProfileLibrary?.get?.("FACILITY")?.purposeDimensions),
    packerPreservesHallwayFace:
      ArchitecturalPacker?._partitionBuilding?.toString?.().includes("hallwayFace") === true,
    doorwayUsesDeclaredFace:
      DoorwayPlacementEngine?._declaredHallwayOpening instanceof Function,
    engineValidatesDimensions:
      CartographerEngine?._validatePurposeDimensions instanceof Function,
    engineValidatesDoorFaces:
      CartographerEngine?._validateDeclaredHallwayOpenings instanceof Function,
    engineValidatesAccess:
      CartographerEngine?._validateRoomAccess instanceof Function
  };

  console.log("=== LOADED PIPELINE CHECK ===");
  console.table(requiredChecks);

  if (Object.values(requiredChecks).some(value => value !== true)) {
    console.error("STOP: One or more updated files are not loaded. Fully restart Foundry before generating the map.");
    return { loaded: false, requiredChecks };
  }

  const existing = game.scenes.contents.find(scene => scene.name === NAME);
  if (existing) await existing.delete();

  const connect = (...targets) => targets.map(to => ({
    to,
    targetId: to,
    required: true,
    preferredMode: "AUTO",
    doorType: "STANDARD"
  }));

  const sectors = [
    ["reception", "Reception", "ENTRY", "ENTRY", ["conference", "office-a"]],
    ["conference", "Conference Room", "PUBLIC_ROOM", "HUB", ["records", "break-room"]],
    ["records", "Records", "STORAGE", "OPTIONAL", ["conference"]],
    ["break-room", "Break Room", "SERVICE", "OPTIONAL", ["restroom"]],
    ["office-a", "Office A", "OFFICE", "OPTIONAL", ["office-b"]],
    ["office-b", "Office B", "OFFICE", "OPTIONAL", ["office-c"]],
    ["office-c", "Office C", "OFFICE", "OBJECTIVE", ["stairs"]],
    ["stairs", "Stairwell", "STAIRWELL", "OPTIONAL", ["utility"]],
    ["utility", "Utility", "UTILITY", "OPTIONAL", ["stairs"]],
    ["restroom", "Restroom", "RESTROOM", "OPTIONAL", ["break-room"]]
  ].map(([sectorId, name, purpose, graphRole, targets]) => ({
    sectorId,
    name,
    purpose,
    graphRole,
    floor: 1,
    importance: graphRole === "OBJECTIVE" ? 5 : 3,
    trafficLevel: graphRole === "HUB" ? 5 : 2,
    connections: connect(...targets)
  }));

  const manifest = {
    manifestId: "cartographer-targeted-validation",
    dungeonTitle: "Cartographer Targeted Validation",
    layoutSeed: SEED,
    layoutProfile: "FACILITY",
    layoutFamily: "TECHNICAL",
    customFootprintType: "OFFICE",
    architecturalScale: "STANDARD",
    floorCount: 1,
    entranceCount: 2,
    emergencyExitCount: 1,
    architecture: {
      corridorPattern: "CENTRAL_HALL",
      footprintShape: "RECTANGULAR",
      sharedWallPreference: true,
      maximumRoomDegree: 3,
      stairWidth: 4,
      stairHeight: 5
    },
    genre: "modern",
    totalSectors: sectors.length,
    sectors
  };

  const scene = await Scene.create({
    name: NAME,
    navigation: true,
    width: 6000,
    height: 6000,
    padding: 0.05,
    grid: { type: CONST.GRID_TYPES.SQUARE, size: 100 },
    tokenVision: true,
    globalLight: true
  });

  await scene.activate();
  await scene.view();

  globalThis.cartographerTestResult = await CartographerEngine.generate(manifest, {
    scene,
    floor: 1,
    gridSize: 100,
    corridorWidth: 200,
    doorWidth: 200,
    doorSpacing: 200,
    clearExisting: true,
    resizeScene: true,
    centerCanvas: true,
    renderRooms: true,
    renderCorridors: true,
    renderLabels: true,
    renderWalls: true,
    renderFloorLayer: false,
    renderVentilation: false,
    layoutProfile: "FACILITY",
    layoutFamily: "TECHNICAL",
    customFootprintType: "OFFICE",
    connectionPolicy: "PRESERVE_GRAPH",
    maximumRoomDegree: 3,
    preferSharedWalls: true,
    allowCrossMapRoutes: false,
    layoutSeed: SEED,
    partitionBuildings: true,
    stairWidth: 4,
    stairHeight: 5,
    entranceCount: 2,
    emergencyExitCount: 1,
    architecture: manifest.architecture
  });

  const result = globalThis.cartographerTestResult;
  if (!result) throw new Error("Cartographer returned no result.");

  const openings = result.openingPlan?.openings || [];
  const integrity = result.renderIntegrity || {};
  globalThis.cartographerDoorDiagnostic = {
    result,
    sceneId: scene.id,
    hallwayFailures:
      integrity.validation?.hallwayDoorFaces?.problems || []
  };

  const roomReport = result.sectors.map(sector => {
    const rule = sector.purposeDimensionRule;
    const width = Number(sector.gridDimensions?.w) || 0;
    const height = Number(sector.gridDimensions?.h) || 0;
    const sizeValid = !rule?.min || !rule?.max || (
      width >= rule.min.w && width <= rule.max.w &&
      height >= rule.min.h && height <= rule.max.h
    );
    const hallOpening = openings.find(opening =>
      opening.hostType === "ROOM" &&
      opening.hostId === sector.sectorId &&
      opening.targetId === "__circulation__"
    );
    return {
      room: sector.name,
      purpose: sector.purpose,
      zone: sector.architecturalZone || "NONE",
      size: `${width}x${height}`,
      sizeValid,
      hallwayFace: sector.hallwayFace || "NONE",
      openingFace: hallOpening?.face || "NONE",
      exactFaceRequired: hallOpening?.exactFaceRequired === true,
      hallwayDoorValid:
        sector.hallwayAccessCandidate !== true ||
        Boolean(hallOpening && hallOpening.face === sector.hallwayFace),
      preferredAccessFrom: sector.preferredAccessFrom || "NONE"
    };
  });

  const report = {
    rooms: result.sectors.length,
    doors: scene.walls.contents.filter(wall => Number(wall.door) > 0).length,
    purposeDimensions: integrity.checks?.purposeDimensions === true,
    hallwayDoorFaces: integrity.checks?.hallwayDoorFaces === true,
    roomAccess: integrity.checks?.roomAccess === true,
    allRoomSizesValid: roomReport.every(room => room.sizeValid),
    allHallwayDoorsValid: roomReport.every(room => room.hallwayDoorValid),
    utilityPairedToStairs:
      result.sectors.find(sector => sector.sectorId === "utility")?.preferredAccessFrom === "stairs",
    integrity: integrity.valid === true
  };

  report.passed = Object.entries(report)
    .filter(([key]) => !["rooms", "doors"].includes(key))
    .every(([, value]) => value === true) && report.rooms === sectors.length && report.doors > 0;

  console.log("=== ROOM VALIDATION ===");
  console.table(roomReport);

  console.log("=== TARGETED VALIDATION REPORT ===");
  console.table(report);

  if (!report.passed) {
    console.error("FAIL: Review result.renderIntegrity.validation for exact failures.");
    console.log(result.renderIntegrity?.validation);
  } else {
    console.log("PASS: Purpose sizes, declared hallway faces, and room access all validated.");
  }

  const renderedDoors = scene.walls.contents.filter(
    wall => Number(wall.door) > 0
  );
  const sectorsById = new Map(
    result.sectors.map(sector => [sector.sectorId, sector])
  );
  const doorReport = openings
    .filter(opening => opening.hostType === "ROOM")
    .map(opening => {
      const sector = sectorsById.get(opening.hostId);
      const nearestDoor = renderedDoors
        .map(wall => {
          const [x1, y1, x2, y2] = wall.c;
          const center = { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
          return {
            center,
            distance: Math.hypot(
              center.x - opening.location.x,
              center.y - opening.location.y
            )
          };
        })
        .sort((a, b) => a.distance - b.distance)[0];
      return {
        room: sector?.name || opening.hostId,
        target: opening.targetId,
        declaredFace: sector?.hallwayFace || "NONE",
        openingFace: opening.face || "NONE",
        plannedX: opening.location?.x,
        plannedY: opening.location?.y,
        renderedX: nearestDoor?.center.x ?? null,
        renderedY: nearestDoor?.center.y ?? null,
        renderDistance: nearestDoor?.distance ?? null
      };
    });

  globalThis.cartographerDoorDiagnostic.doorReport = doorReport;
  console.log("=== PLANNED VS RENDERED DOORS ===");
  console.table(doorReport);

  return { scene, manifest, result, roomReport, report, doorReport };
})();
