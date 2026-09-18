// cartographer-engine.js
// AI Director Cartographer Alpha 0.1
// FILE: /modules/ai-director/scripts/cartographer/cartographer-engine.js
// Production orchestrator for native Foundry vector-map generation.

import { SpatialLayoutEngine }
  from "/modules/ai-director/scripts/engines/spatial-layout-engine.js";

import { CorridorRouterEngine }
  from "/modules/ai-director/scripts/cartographer/corridor-router-engine.js";

import { CirculationSpacePlanner }
  from "/modules/ai-director/scripts/cartographer/circulation-space-planner.js";

import { TopologyEngine }
  from "/modules/ai-director/scripts/cartographer/topology-engine.js";

import { TopologyNormalizer }
  from "/modules/ai-director/scripts/cartographer/topology-normalizer.js";

import { DoorwayPlacementEngine }
  from "/modules/ai-director/scripts/cartographer/doorway-placement-engine.js";

import { BoundaryFeaturePlanner }
  from "/modules/ai-director/scripts/cartographer/boundary-feature-planner.js";

import { CartographerMetadata }
  from "/modules/ai-director/scripts/cartographer/cartographer-metadata.js";

import { FloorStyleResolver }
  from "/modules/ai-director/scripts/cartographer/floor-style-resolver.js";

import { CartographerFloorLayer }
  from "/modules/ai-director/scripts/cartographer/cartographer-floor-layer.js";

import { CartographerRoomRenderer }
  from "/modules/ai-director/scripts/cartographer/room-renderer.js";

import { CorridorRenderer }
  from "/modules/ai-director/scripts/cartographer/corridor-renderer.js";

import { RoomLabelRenderer }
  from "/modules/ai-director/scripts/cartographer/room-label-renderer.js";

import { CartographerWallRenderer }
  from "/modules/ai-director/scripts/cartographer/wall-renderer.js";
import { LayoutProfileResolver }
  from "/modules/ai-director/scripts/cartographer/layout-profile-resolver.js";
import { VentilationNetworkPlanner }
  from "/modules/ai-director/scripts/cartographer/ventilation-network-planner.js";
import { VentilationRenderer }
  from "/modules/ai-director/scripts/cartographer/ventilation-renderer.js";
import { VentilationWallRenderer }
  from "/modules/ai-director/scripts/cartographer/architecture/ventilation-wall-renderer.js";
import { SkydockSecurityRenderer }
  from "/modules/ai-director/scripts/cartographer/architecture/skydock-security-renderer.js";
import { FortificationPerimeterRenderer }
  from "/modules/ai-director/scripts/cartographer/architecture/fortification-perimeter-renderer.js";

import { BuildingProgramPlanner }
  from "/modules/ai-director/scripts/cartographer/building-program-planner.js";

export class CartographerEngine {

  static CONFIG = {
    floor: 1,
    gridSize: 100,
    corridorWidth: 200,
    doorWidth: 200,
    doorSpacing: 200,
    sharedDoorType: "STANDARD",
    sharedConnectionType: "STANDARD_DOOR",
    boundaryFeatureWidth: 100,
    boundaryFeatureSpacing: 100,
    boundaryFeatures: [],
    sharedTrunkLength: 400,
    approachLength: 200,
    clearExisting: true,
    renderRooms: true,
    renderCorridors: true,
    renderLabels: true,
    renderWalls: true,
    renderFloorLayer: true,
    renderVentilation: true,
    renderVentilationWalls: true,
    renderSkydockSecurity: true,
    renderFortifications: true,
    applyRoomWallHeight: false,
    roomWallHeightBottom: 0,
    roomWallHeightTop: 10,
    ventElevationBottom: 10,
    ventElevationTop: 15,
    ventGrateWidth: 100,
    lockVentGrates: false,
    resizeScene: true,
    centerCanvas: true,
    sceneMargin: 1000,
    minimumSceneWidth: 2048,
    minimumSceneHeight: 2048,
    persistSceneMetadata: true,
    layoutProfile: null,
    layoutFamily: null,
    architecturalScale: null,
    buildingScale: null,
    architecture: null,
    preserveExplicitPositions: false,
    compactRowWidth: null,
    connectionPolicy: null,
    maximumRoomDegree: null,
    preferSharedWalls: null,
    allowCrossMapRoutes: null,
    towerShape: null,
    layoutSeed: null,
    entranceCount: null,
    emergencyExitCount: null,
    stairWidth: null,
    stairHeight: null,
    partitionBuildings: true,
    floorStyle: {
      assignmentMode: "AUTOMATIC"
    }
  };

  static async generate(
    manifest = {},
    options = {}
  ) {
    if (!game.user?.isGM) {
      ui.notifications.warn(
        "Cartographer generation requires an active GM."
      );
      return null;
    }

    const scene =
      options.scene ||
      canvas.scene;

    if (!scene) {
      ui.notifications.error(
        "Cartographer requires an active scene."
      );
      return null;
    }

    if (
      !manifest ||
      !Array.isArray(manifest.sectors)
    ) {
      throw new Error(
        "Cartographer requires a manifest with a sectors array."
      );
    }

    const config =
      this._normalizeConfig(options);

    const requestedLayoutProfile = LayoutProfileResolver.resolve(
      manifest,
      {
        layoutProfile: config.layoutProfile,
        layoutFamily: config.layoutFamily,
        architecturalScale: config.architecturalScale,
        buildingScale: config.buildingScale,
        architecture: config.architecture
      }
    );
    const floorStyle =
      FloorStyleResolver.resolve({
        scene,
        gridSize: config.gridSize,
        layoutProfile: requestedLayoutProfile.profileId,
        ...(config.floorStyle || {})
      });

    const floorStyleValidation =
      FloorStyleResolver.validateResolvedStyle(
        floorStyle
      );

    if (!floorStyleValidation.valid) {
      throw new Error(
        `Cartographer floor style is invalid: ${floorStyleValidation.problems.join(" ")}`
      );
    }

    const generationId =
      options.generationId ||
      CartographerMetadata.createGenerationId();

    const manifestId =
      CartographerMetadata.getManifestId(manifest);

    if (config.clearExisting) {
      await this.clear(scene);
    }

    const result =
      SpatialLayoutEngine.processLayout(
        manifest,
        {
          gridSize: config.gridSize,
          layoutProfile: config.layoutProfile,
          layoutFamily: config.layoutFamily,
          architecturalScale: config.architecturalScale,
          buildingScale: config.buildingScale,
          architecture: config.architecture,
          preserveExplicitPositions:
            config.preserveExplicitPositions,
          compactRowWidth: config.compactRowWidth,
          layoutSeed: config.layoutSeed || manifest.layoutSeed || manifest.manifestId || null,
          corridorWidth: config.corridorWidth,
          partitionBuildings: config.partitionBuildings
        }
      );

    const layoutProfile = result.layoutProfile || null;

    const floorNumber =
      this._resolveFloor(
        result,
        config.floor
      );

    const finalizedSectors = Array.isArray(result.sectors)
      ? result.sectors.filter(sector =>
          Number(sector.floor || 1) === Number(floorNumber)
        )
      : [];
    const sectors = finalizedSectors.length
      ? finalizedSectors
      : result.floors?.[floorNumber]?.sectors || [];

    // Keep every downstream consumer on the same finalized geometry array.
    if (result.floors?.[floorNumber]) {
      result.floors[floorNumber].sectors = sectors;
    }

    if (!sectors.length) {
      throw new Error(
        `Cartographer found no sectors on floor ${floorNumber}.`
      );
    }

    const sceneLayout = this._calculateSceneLayout(sectors, config);
    if (config.resizeScene) {
      await this._resizeScene(scene, sceneLayout, config);
    }

    const roomFloorStyles = Object.fromEntries(
      sectors.map(sector => {
        const resolved =
          FloorStyleResolver.resolveRoomStyle(
            sector,
            floorStyle,
            {
              scene,
              gridSize: config.gridSize,
              assignmentMode:
                floorStyle.assignmentMode,
              layoutProfile:
                layoutProfile?.profileId ||
                requestedLayoutProfile.profileId
            }
          );
        sector.floorStyle = {
          ...FloorStyleResolver.toMetadata(resolved),
          source: resolved.source,
          locked: resolved.locked
        };
        return [sector.sectorId, sector.floorStyle];
      })
    );

    const buildingProgram = BuildingProgramPlanner.plan(
      manifest,
      layoutProfile || requestedLayoutProfile,
      result.sectors || manifest.sectors,
      config
    );
    const routingPolicy = {
      connectionPolicy: config.connectionPolicy || layoutProfile?.connectionPolicy || "PRESERVE_GRAPH",
      maximumRoomDegree: config.maximumRoomDegree || layoutProfile?.maximumRoomDegree || 3,
      preferSharedWalls: config.preferSharedWalls ?? layoutProfile?.preferSharedWalls ?? false,
      allowCrossMapRoutes: config.allowCrossMapRoutes ?? layoutProfile?.allowCrossMapRoutes ?? true
    };

    const grammarDriven = Boolean(
      result.architecturalGrammar &&
      result.openingPlan &&
      result.normalizedTopology
    );
    let circulationPlan;
    let connections;
    let connectionPlan;
    let routes;
    let topology;
    let normalizedTopology;
    let openingPlan;

    if (grammarDriven) {
      const declaredOpenings = structuredClone(
        result.openingPlan.openings || []
      );
      const internalOpenings = declaredOpenings.filter(
        opening =>
          opening.targetId &&
          !String(opening.targetId).startsWith("__")
      );
      connectionPlan = {
        shared: internalOpenings.map(opening => ({
          sourceId: opening.sourceId,
          targetId: opening.targetId,
          connectionType: opening.connectionType || "STANDARD_DOOR",
          doorType: opening.doorType || "STANDARD",
          source: "ARCHITECTURAL_GRAMMAR"
        })),
        routed: []
      };
      connections = [...connectionPlan.shared];
      routes = [];
      topology = { segments: [], junctions: [] };
      normalizedTopology = structuredClone(result.normalizedTopology);
      openingPlan = {
        ...structuredClone(result.openingPlan),
        openings: declaredOpenings
      };
      circulationPlan = {
        mode: "ARCHITECTURAL_GRAMMAR",
        grammar: structuredClone(result.architecturalGrammar),
        networkConnections: connections,
        connectionPlan,
        routes,
        skeleton: [],
        connectedSectorIds: [
          ...new Set(
            internalOpenings.flatMap(opening => [
              opening.sourceId,
              opening.targetId
            ])
          )
        ]
      };
    } else {
      circulationPlan = CirculationSpacePlanner.plan(
        sectors,
        layoutProfile || requestedLayoutProfile,
        {
          gridSize: config.gridSize,
          corridorWidth: config.corridorWidth,
          doorWidth: config.doorWidth,
          sharedTrunkLength: config.sharedTrunkLength,
          approachLength: config.approachLength,
          connectionPolicy: routingPolicy.connectionPolicy,
          maximumRoomDegree: routingPolicy.maximumRoomDegree,
          preferSharedWalls: routingPolicy.preferSharedWalls,
          allowCrossMapRoutes: routingPolicy.allowCrossMapRoutes
        }
      );
      connections = circulationPlan.networkConnections;
      connectionPlan = circulationPlan.connectionPlan;
      routes = circulationPlan.routes;
      topology = TopologyEngine.build(routes);
      normalizedTopology = TopologyNormalizer.normalize(
        topology,
        {
          gridSize: config.gridSize,
          corridorWidth: config.corridorWidth
        }
      );
      openingPlan = DoorwayPlacementEngine.plan(
        routes,
        normalizedTopology,
        sectors,
        {
          gridSize: config.gridSize,
          doorWidth: config.doorWidth,
          doorSpacing: config.doorSpacing,
          sharedDoorType: config.sharedDoorType,
          sharedConnectionType: config.sharedConnectionType,
          directConnections: connectionPlan.shared
        }
      );
      openingPlan.openings =
        DoorwayPlacementEngine.realignDeclaredHallwayOpenings(
          openingPlan.openings,
          sectors,
          {
            gridSize: config.gridSize,
            doorWidth: config.doorWidth
          }
        );
    }

    openingPlan.roomOpenings = openingPlan.openings.filter(
      opening => opening.hostType === "ROOM"
    );
    openingPlan.corridorOpenings = openingPlan.openings.filter(
      opening => opening.hostType === "CORRIDOR"
    );
    openingPlan.junctionOpenings = openingPlan.openings.filter(
      opening => opening.hostType === "JUNCTION"
    );
    DoorwayPlacementEngine.attachToSectors(
      sectors,
      openingPlan.openings
    );
    const ventilationPlan =
      VentilationNetworkPlanner.plan(
        manifest,
        sectors,
        layoutProfile || requestedLayoutProfile,
        {
          gridSize: config.gridSize,
          elevationBottom: Number(
            manifest.ventilation?.elevationBottom ??
            config.ventElevationBottom ??
            10
          ),
          elevationTop: Number(
            manifest.ventilation?.elevationTop ??
            config.ventElevationTop ??
            15
          )
        }
      );

    const boundaryFeaturePlan =
      BoundaryFeaturePlanner.plan(
        sectors,
        normalizedTopology,
        config.boundaryFeatures,
        {
          gridSize: config.gridSize,
          defaultWidth:
            config.boundaryFeatureWidth,
          featureSpacing:
            config.boundaryFeatureSpacing
        }
      );

    const metadataConfig = {
      generationId,
      manifestId
    };

    const created = {
      rooms: [],
      corridors: [],
      labels: [],
      walls: [],
      ventilation: [],
      ventilationWalls: [],
      skydockSecurity: [],
      fortification: null,
      floorLayer: null
    };

    if (config.renderRooms) {
      created.rooms =
        await CartographerRoomRenderer.render(
          result,
          scene,
          {
            gridSize: config.gridSize,
            ...metadataConfig
          }
        );

      await this._stampDocuments(
        created.rooms,
        metadataConfig
      );
    }

    if (config.renderCorridors) {
      created.corridors =
        await CorridorRenderer.render(
          normalizedTopology,
          scene,
          metadataConfig
        );
    }

    if (config.renderVentilation && ventilationPlan.enabled) {
      created.ventilation =
        await VentilationRenderer.render(
          ventilationPlan,
          scene,
          metadataConfig
        );
    }

    if (config.renderVentilationWalls && ventilationPlan.enabled) {
      created.ventilationWalls =
        await VentilationWallRenderer.render(
          ventilationPlan,
          scene,
          {
            ...metadataConfig,
            grateWidth: config.ventGrateWidth,
            lockGrates: config.lockVentGrates,
            clearExisting: false
          }
        );
    }

    if (
      config.renderSkydockSecurity &&
      ventilationPlan.enabled &&
      result.securityPlan?.enabled
    ) {
      created.skydockSecurity =
        await SkydockSecurityRenderer.render(
          result.securityPlan,
          ventilationPlan,
          scene,
          {
            ...metadataConfig,
            clearExisting: false
          }
        );
    }

    if (config.renderLabels) {
      created.labels =
        await RoomLabelRenderer.render(
          result,
          scene,
          metadataConfig
        );
    }

    if (config.renderWalls) {
      created.walls =
        await CartographerWallRenderer.render(
          result,
          normalizedTopology,
          openingPlan,
          boundaryFeaturePlan,
          scene,
          {
            ...metadataConfig,
            replaceExisting: false,
            applyWallHeight: config.applyRoomWallHeight,
            wallHeightBottom: config.roomWallHeightBottom,
            wallHeightTop: config.roomWallHeightTop
          }
        );
    }

    if (config.renderFortifications && result.fortificationPlan) {
      created.fortification =
        await FortificationPerimeterRenderer.render(
          result,
          scene,
          {
            ...metadataConfig,
            floor: floorNumber
          }
        );
    }

    if (config.renderFloorLayer) {
      try {
        created.floorLayer =
          await CartographerFloorLayer.render(
          scene,
          {
            gridSize: config.gridSize,
            floorStyle,
            sectors,
            roomFloorStyles,
            assignmentMode:
              floorStyle.assignmentMode ||
              config.floorStyle?.assignmentMode ||
              "AUTOMATIC",
            layoutProfile:
              layoutProfile?.profileId ||
              requestedLayoutProfile.profileId
          }
        );
      } catch (error) {
        console.warn("Cartographer floor layer failed after persistent geometry completed.", error);
        created.floorLayer = null;
      }
    }

    const doors =
      created.walls.filter(wall =>
        CartographerMetadata
          .isCartographerDocument(
            wall,
            CartographerMetadata
              .DOCUMENT_TYPES
              .DOOR
          )
      );

    const renderIntegrity = this._validateRenderIntegrity({
      config,
      sectors,
      routes,
      openingPlan,
      created,
      doors
    });

    const sceneMetadata =
      CartographerMetadata.createSceneMetadata({
        manifest,
        floorNumber,
        config,
        generationId,
        floorStyle:
          {
            ...FloorStyleResolver.toMetadata(
              floorStyle
            ),
            roomStyles: structuredClone(
              roomFloorStyles
            )
          },
        layoutProfile,
        buildingProgram
      });

    sceneMetadata.summary = {
      sectors: sectors.length,
      connections: connections.length,
      circulationMode: circulationPlan.mode,
      directConnections: connectionPlan.shared.length,
      routedConnections: connectionPlan.routed.length,
      routes: routes.length,
      openings: openingPlan.openings.length,
      ventilationConnections:
        ventilationPlan.connectionCount,
      ventilationDrawings:
        created.ventilation.length,
      ventilationWalls:
        created.ventilationWalls.length,
      skydockSecurityDevices:
        created.skydockSecurity.length,
      fortificationRendered:
        Boolean(created.fortification?.rendered),
      fortificationDrawings:
        created.fortification?.drawings?.length || 0,
      fortificationWalls:
        created.fortification?.walls?.length || 0,
      fortificationGates:
        created.fortification?.gates || 0,
      roomWallHeightApplied:
        config.applyRoomWallHeight === true,
      boundaryFeatures:
        boundaryFeaturePlan.features.length,
      windows:
        boundaryFeaturePlan.windows.length,
      roomDrawings: created.rooms.length,
      corridorDrawings:
        created.corridors.length,
      labelDrawings: created.labels.length,
      walls: created.walls.length,
      doors: doors.length,
      floorLayerRendered:
        Boolean(created.floorLayer?.rendered),
      floorPreset: floorStyle.preset,
      floorGenre: floorStyle.genre,
      floorAssignmentMode:
        floorStyle.assignmentMode,
      roomFloorStyles:
        Object.keys(roomFloorStyles).length,
      layoutProfile:
        layoutProfile?.profileId || null,
      layoutFamily:
        layoutProfile?.layoutFamily || null,
      architecturalScale:
        layoutProfile?.architecturalScale || null,
      layoutSource:
        layoutProfile?.source || null,
      architecturalGrammar:
        result.architecturalGrammar || null,
      footprintWidth:
        result.floors?.[floorNumber]?.bounds?.width || 0,
      footprintHeight:
        result.floors?.[floorNumber]?.bounds?.height || 0,
      sceneWidth: sceneLayout.width,
      sceneHeight: sceneLayout.height,
      sceneCenterX: sceneLayout.centerX,
      sceneCenterY: sceneLayout.centerY,
      renderIntegrity
    };

    if (config.persistSceneMetadata) {
      await CartographerMetadata
        .setSceneMetadata(
          scene,
          sceneMetadata
        );
    }

    if (config.centerCanvas) {
      await this._centerCanvas(scene, sceneLayout);
    }

    const output = {
      manifest,
      manifestId,
      generationId,
      sceneMetadata,
      config,
      floorStyle,
      layoutProfile,
      buildingProgram,
      scene,
      sceneLayout,
      floorNumber,
      result,
      sectors,
      connections,
      circulationPlan,
      connectionPlan,
      routes,
      topology,
      normalizedTopology,
      openingPlan,
      ventilationPlan,
      boundaryFeaturePlan,
      renderIntegrity,
      created,
      summary:
        sceneMetadata.summary
    };

    console.log(
      "Cartographer Generation Complete",
      output
    );

    ui.notifications.info(
      `Cartographer generated ${output.summary.sectors} spaces, ` +
      `${output.summary.routes} routes, and ${output.summary.doors} doors.`
    );

    return output;
  }

  static async clear(
    scene = canvas.scene
  ) {
    if (!scene) {
      return;
    }

    await CartographerFloorLayer.clear();
    await VentilationRenderer.clear(scene);
    await VentilationWallRenderer.clear(scene);
    await SkydockSecurityRenderer.clear(scene);
    await FortificationPerimeterRenderer.clear(scene);

    await CartographerRoomRenderer.clear(
      scene
    );

    await CorridorRenderer.clear(
      scene
    );

    await RoomLabelRenderer.clear(
      scene
    );

    await CartographerWallRenderer.clear(
      scene
    );
  }

  static async _stampDocuments(
    documents = [],
    metadata = {}
  ) {
    const updates = documents
      .map(document => {
        const current =
          CartographerMetadata.get(document);

        if (!current) {
          return null;
        }

        return {
          _id: document.id,
          [`flags.${CartographerMetadata.NAMESPACE}.cartographer.generationId`]:
            metadata.generationId || null,
          [`flags.${CartographerMetadata.NAMESPACE}.cartographer.manifestId`]:
            metadata.manifestId || null,
          [`flags.${CartographerMetadata.NAMESPACE}.cartographer.updatedAt`]:
            Date.now()
        };
      })
      .filter(Boolean);

    if (!updates.length) {
      return [];
    }

    const parent = documents[0]?.parent;
    const documentName =
      documents[0]?.documentName;

    if (
      !parent ||
      !documentName ||
      typeof parent.updateEmbeddedDocuments !==
        "function"
    ) {
      return [];
    }

    return parent.updateEmbeddedDocuments(
      documentName,
      updates
    );
  }

  static _validateRenderIntegrity({
    config,
    sectors = [],
    routes = [],
    openingPlan = {},
    created = {},
    doors = []
  } = {}) {
    const dimensionValidation = this._validatePurposeDimensions(sectors);
    const hallwayValidation = this._validateDeclaredHallwayOpenings(
      sectors,
      openingPlan.openings || []
    );
    const accessValidation = this._validateRoomAccess(
      sectors,
      openingPlan.openings || []
    );
    const grammarOpenCompound = Boolean(
      created.fortification?.rendered &&
      routes.length === 0 &&
      sectors.some(sector =>
        sector.renderAsOpenArea === true ||
        sector.suppressWalls === true ||
        sector.suppressExteriorDoor === true ||
        ["bailey", "well", "market", "market-shops", "motte-approach"].includes(String(sector.sectorId || ""))
      )
    );

    const checks = {
      rooms: !config.renderRooms || created.rooms?.length === sectors.length,
      corridors: !config.renderCorridors || routes.length === 0 || created.corridors?.length > 0,
      labels: !config.renderLabels || created.labels?.length === sectors.length,
      walls: !config.renderWalls || created.walls?.length > 0,
      doors: !config.renderWalls || (openingPlan.openings?.length || 0) === 0 || doors.length > 0,
      purposeDimensions: dimensionValidation.valid,
      hallwayDoorFaces: hallwayValidation.valid,
      roomAccess: grammarOpenCompound || accessValidation.valid
    };
    const problems = Object.entries(checks)
      .filter(([, passed]) => !passed)
      .map(([name]) => name);
    const result = {
      valid: problems.length === 0,
      checks,
      problems,
      validation: {
        purposeDimensions: dimensionValidation,
        hallwayDoorFaces: hallwayValidation,
        roomAccess: accessValidation,
        grammarOpenCompound: {
          applied: grammarOpenCompound,
          reason: grammarOpenCompound
            ? "Room-access validation is relaxed for grammar-driven fortified open compounds with detached buildings and open areas."
            : null
        }
      },
      counts: {
        sectors: sectors.length,
        routes: routes.length,
        openings: openingPlan.openings?.length || 0,
        rooms: created.rooms?.length || 0,
        corridors: created.corridors?.length || 0,
        labels: created.labels?.length || 0,
        walls: created.walls?.length || 0,
        doors: doors.length
      }
    };
    if (!result.valid) {
      console.error("Cartographer render integrity failed", result);
      ui.notifications.error(
        `Cartographer generation incomplete: ${problems.join(", ")}.`
      );
    }
    return result;
  }

  static _validatePurposeDimensions(sectors = []) {
    const problems = [];
    for (const sector of sectors) {
      const rule = sector.purposeDimensionRule;
      if (!rule?.min || !rule?.max) continue;
      const width = Number(sector.gridDimensions?.w) || 0;
      const height = Number(sector.gridDimensions?.h) || 0;
      if (
        width < Number(rule.min.w) || width > Number(rule.max.w) ||
        height < Number(rule.min.h) || height > Number(rule.max.h)
      ) {
        problems.push({
          sectorId: sector.sectorId,
          actual: { w: width, h: height },
          min: structuredClone(rule.min),
          max: structuredClone(rule.max)
        });
      }
    }
    return { valid: problems.length === 0, problems };
  }

  static _validateDeclaredHallwayOpenings(sectors = [], openings = []) {
    const epsilon = 0.01;
    const problems = [];
    for (const sector of sectors.filter(item => item.hallwayAccessCandidate === true)) {
      const access = sector.hallwayAccess;
      const bounds = sector.pixelBounds || sector.bounds;
      if (!access?.face || !bounds) {
        problems.push({ sectorId: sector.sectorId, problem: "missing-declaration" });
        continue;
      }
      const opening = openings.find(item =>
        item.hostType === "ROOM" &&
        item.hostId === sector.sectorId &&
        item.targetId === "__circulation__"
      );
      if (!opening) {
        problems.push({ sectorId: sector.sectorId, problem: "missing-opening" });
        continue;
      }
      const face = String(access.face).toUpperCase();
      const expected = {
        EAST: bounds.x + bounds.width,
        WEST: bounds.x,
        NORTH: bounds.y,
        SOUTH: bounds.y + bounds.height
      }[face];
      const actual = face === "EAST" || face === "WEST"
        ? opening.location?.x
        : opening.location?.y;
      if (opening.face !== face || Math.abs(Number(actual) - Number(expected)) > epsilon) {
        problems.push({
          sectorId: sector.sectorId,
          problem: "wrong-face",
          expectedFace: face,
          actualFace: opening.face,
          expectedCoordinate: expected,
          actualCoordinate: actual
        });
      }
    }
    return { valid: problems.length === 0, problems };
  }

  static _validateRoomAccess(sectors = [], openings = []) {
    const accessible = new Set();
    for (const opening of openings) {
      if (opening.hostId) accessible.add(opening.hostId);
      if (opening.sourceId) accessible.add(opening.sourceId);
      if (opening.targetId && opening.targetId !== "__circulation__") {
        accessible.add(opening.targetId);
      }
      for (const id of opening.connectedSources || []) accessible.add(id);
      for (const id of opening.connectedTargets || []) accessible.add(id);
    }
    const problems = sectors
      .filter(sector => !accessible.has(sector.sectorId))
      .map(sector => ({ sectorId: sector.sectorId, problem: "no-opening" }));
    return { valid: problems.length === 0, problems };
  }

  static _calculateSceneLayout(sectors = [], config = {}) {
    const gridSize = Math.max(1, Number(config.gridSize) || 100);
    const margin = this._snapSize(config.sceneMargin, gridSize);
    const bounds = sectors.reduce((output, sector) => {
      const room = sector.pixelBounds || sector.bounds || {};
      const left = Number(room.x) || 0;
      const top = Number(room.y) || 0;
      const right = left + Math.max(0, Number(room.width) || 0);
      const bottom = top + Math.max(0, Number(room.height) || 0);
      output.left = Math.min(output.left, left);
      output.top = Math.min(output.top, top);
      output.right = Math.max(output.right, right);
      output.bottom = Math.max(output.bottom, bottom);
      return output;
    }, { left: Infinity, top: Infinity, right: 0, bottom: 0 });

    if (!Number.isFinite(bounds.left)) bounds.left = 0;
    if (!Number.isFinite(bounds.top)) bounds.top = 0;
    const width = Math.ceil(Math.max(
      bounds.right + margin,
      Number(config.minimumSceneWidth) || 2048
    ) / gridSize) * gridSize;
    const height = Math.ceil(Math.max(
      bounds.bottom + margin,
      Number(config.minimumSceneHeight) || 2048
    ) / gridSize) * gridSize;

    return {
      ...bounds,
      geometryWidth: Math.max(0, bounds.right - bounds.left),
      geometryHeight: Math.max(0, bounds.bottom - bounds.top),
      width,
      height,
      margin,
      centerX: (bounds.left + bounds.right) / 2,
      centerY: (bounds.top + bounds.bottom) / 2
    };
  }

  static async _resizeScene(scene, layout, config) {
    if (!scene || !layout) return null;
    const update = {};
    if (Number(scene.width) !== layout.width) update.width = layout.width;
    if (Number(scene.height) !== layout.height) update.height = layout.height;
    if (Number(scene.grid?.size) !== Number(config.gridSize)) {
      update["grid.size"] = config.gridSize;
    }
    if (!Object.keys(update).length) return scene;
    console.log("AI Director | Resizing Cartographer scene", {
      sceneId: scene.id,
      previousWidth: scene.width,
      previousHeight: scene.height,
      width: layout.width,
      height: layout.height,
      geometryBounds: {
        left: layout.left,
        top: layout.top,
        right: layout.right,
        bottom: layout.bottom
      }
    });
    await scene.update(update);
    return scene;
  }

  static async _centerCanvas(scene, layout) {
    if (
      !scene ||
      !layout ||
      globalThis.canvas?.scene?.id !== scene.id ||
      typeof globalThis.canvas?.animatePan !== "function"
    ) return null;

    const viewportWidth = Math.max(1, globalThis.innerWidth || 1920);
    const viewportHeight = Math.max(1, globalThis.innerHeight || 1080);
    const contentWidth = Math.max(1, layout.geometryWidth + layout.margin);
    const contentHeight = Math.max(1, layout.geometryHeight + layout.margin);
    const scale = Math.max(0.1, Math.min(
      1,
      viewportWidth / contentWidth,
      viewportHeight / contentHeight
    ) * 0.85);
    return globalThis.canvas.animatePan({
      x: layout.centerX,
      y: layout.centerY,
      scale,
      duration: 500
    });
  }

  static _normalizeConfig(
    options = {}
  ) {
    const config = {
      ...this.CONFIG,
      ...options
    };

    config.floor =
      Number(config.floor) || 1;

    config.gridSize = Math.max(
      1,
      Number(config.gridSize) || 100
    );

    config.corridorWidth =
      this._snapSize(
        config.corridorWidth,
        config.gridSize
      );

    config.doorWidth =
      this._snapSize(
        config.doorWidth,
        config.gridSize
      );

    config.doorSpacing =
      this._snapSize(
        config.doorSpacing,
        config.gridSize
      );

    config.sharedTrunkLength =
      this._snapSize(
        config.sharedTrunkLength,
        config.gridSize
      );

    config.approachLength =
      this._snapSize(
        config.approachLength,
        config.gridSize
      );

    config.boundaryFeatureWidth =
      this._snapSize(
        config.boundaryFeatureWidth,
        config.gridSize
      );

    config.boundaryFeatureSpacing =
      this._snapSize(
        config.boundaryFeatureSpacing,
        config.gridSize
      );

    config.boundaryFeatures =
      Array.isArray(
        config.boundaryFeatures
      )
        ? config.boundaryFeatures
        : [];

    config.sharedDoorType = String(
      config.sharedDoorType ||
      "STANDARD"
    ).toUpperCase();

    config.sharedConnectionType = String(
      config.sharedConnectionType ||
      "STANDARD_DOOR"
    ).toUpperCase();

    config.clearExisting =
      config.clearExisting !== false;

    config.renderRooms =
      config.renderRooms !== false;

    config.renderCorridors =
      config.renderCorridors !== false;

    config.renderLabels =
      config.renderLabels !== false;

    config.renderWalls =
      config.renderWalls !== false;

    config.renderFloorLayer =
      config.renderFloorLayer !== false;
    config.renderVentilation =
      config.renderVentilation !== false;
    config.renderVentilationWalls =
      config.renderVentilationWalls !== false;
    config.renderSkydockSecurity =
      config.renderSkydockSecurity !== false;
    config.renderFortifications =
      config.renderFortifications !== false;
    config.applyRoomWallHeight =
      config.applyRoomWallHeight === true;
    config.roomWallHeightBottom =
      Number(config.roomWallHeightBottom ?? 0);
    config.roomWallHeightTop =
      Number(config.roomWallHeightTop ?? 10);
    config.ventElevationBottom =
      Number(config.ventElevationBottom ?? 10);
    config.ventElevationTop =
      Number(config.ventElevationTop ?? 15);
    config.ventGrateWidth =
      this._snapSize(config.ventGrateWidth, config.gridSize);
    config.lockVentGrates =
      config.lockVentGrates === true;
    config.resizeScene = config.resizeScene !== false;
    config.centerCanvas = config.centerCanvas !== false;
    config.sceneMargin = this._snapSize(config.sceneMargin, config.gridSize);
    config.minimumSceneWidth = this._snapSize(config.minimumSceneWidth, config.gridSize);
    config.minimumSceneHeight = this._snapSize(config.minimumSceneHeight, config.gridSize);

    config.layoutProfile = config.layoutProfile
      ? String(config.layoutProfile).trim().toUpperCase()
      : null;
    config.layoutFamily = config.layoutFamily
      ? String(config.layoutFamily).trim().toUpperCase()
      : null;
    config.architecturalScale = config.architecturalScale
      ? String(config.architecturalScale).trim().toUpperCase()
      : null;
    config.buildingScale = config.buildingScale
      ? String(config.buildingScale).trim().toUpperCase()
      : null;
    config.architecture =
      config.architecture && typeof config.architecture === "object"
        ? structuredClone(config.architecture)
        : null;
    config.preserveExplicitPositions =
      config.preserveExplicitPositions === true;
    config.partitionBuildings = config.partitionBuildings !== false;
    config.layoutSeed = config.layoutSeed || null;
    config.compactRowWidth =
      Number.isFinite(Number(config.compactRowWidth))
        ? Math.max(1, Number(config.compactRowWidth))
        : null;

    config.floorStyle =
      config.floorStyle &&
      typeof config.floorStyle === "object"
        ? structuredClone(config.floorStyle)
        : null;

    config.persistSceneMetadata =
      config.persistSceneMetadata !== false;

    return config;
  }

  static _resolveFloor(
    result,
    requestedFloor
  ) {
    if (result.floors?.[requestedFloor]) {
      return requestedFloor;
    }

    const floors = Object.keys(
      result.floors || {}
    )
      .map(Number)
      .filter(Number.isFinite)
      .sort((first, second) =>
        first - second
      );

    return floors[0] || 1;
  }

  static _snapSize(
    value,
    gridSize
  ) {
    return Math.max(
      gridSize,
      Math.round(
        (Number(value) || gridSize) /
        gridSize
      ) * gridSize
    );
  }
}

export const Cartographer =
  CartographerEngine;
