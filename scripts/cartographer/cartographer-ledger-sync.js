// cartographer-ledger-sync.js
// AI Director Cartographer Alpha 0.1
// FILE: /modules/ai-director/scripts/cartographer/cartographer-ledger-sync.js
// Synchronizes meaningful Foundry scene edits back into the Dungeon Manifest.

import { CartographerMetadata }
  from "/modules/ai-director/scripts/cartographer/cartographer-metadata.js";

import { DungeonLedgerManager }
  from "/modules/ai-director/scripts/data/dungeon-ledger-manager.js";

import { syncDungeonManifestToMemory }
  from "/modules/ai-director/scripts/data/dungeon-sync.js";

export class CartographerLedgerSync {

  static CONFIG = {
    gridSize: 100,
    positionTolerance: 1,
    sizeTolerance: 1,
    persist: true,
    validateGraph: true,
    includeDoorState: true,
    includeBoundaryFeatures: true,
    includeVentilation: true,
    detectAddedDoors: true,
    detectDeletedDoors: true,
    detectAddedRooms: true,
    detectDeletedRooms: true,
    includeFloorStyles: true
  };

  static readScene(scene = canvas.scene, customConfig = {}) {
    if (!scene) {
      throw new Error(
        "Cartographer Ledger Sync requires an active scene."
      );
    }

    const config = {
      ...this.CONFIG,
      ...customConfig
    };

    config.gridSize = Math.max(
      1,
      Number(config.gridSize) ||
      Number(scene.grid?.size) ||
      100
    );

    const sceneMetadata =
      scene.flags?.[CartographerMetadata.NAMESPACE]
        ?.cartographer || null;

    return {
      sceneId: scene.id,
      sceneName: scene.name,
      sceneMetadata:
        sceneMetadata
          ? structuredClone(sceneMetadata)
          : null,
      generationId:
        sceneMetadata?.generationId || null,
      manifestId:
        sceneMetadata?.manifestId || null,
      gridSize: config.gridSize,
      rooms: this._readRooms(scene),
      doors: this._readDoors(scene, config),
      boundaryFeatures:
        config.includeBoundaryFeatures
          ? this._readBoundaryFeatures(scene)
          : [],
      ventilation:
        config.includeVentilation
          ? this._readVentilation(scene)
          : null,
      capturedAt: Date.now()
    };
  }

  static diff(manifest, sceneState, customConfig = {}) {
    if (!manifest || !Array.isArray(manifest.sectors)) {
      throw new Error(
        "Cartographer Ledger Sync requires a valid manifest."
      );
    }

    const config = {
      ...this.CONFIG,
      ...customConfig
    };

    const gridSize = Math.max(
      1,
      Number(sceneState.gridSize) ||
      Number(config.gridSize) ||
      100
    );

    const sectorIndex = new Map(
      manifest.sectors.map(sector => [
        sector.sectorId,
        sector
      ])
    );

    const changes = {
      rooms: [],
      roomsAdded: [],
      roomsDeleted: [],
      doors: [],
      doorsAdded: [],
      doorsDeleted: [],
      boundaryFeatures: [],
      ventilation: null,
      roomFloorStyles: [],
      missingSectors: [],
      changed: false
    };

    const sceneRoomIds = new Set(
      (sceneState.rooms || [])
        .map(room => room.sectorId)
        .filter(Boolean)
    );

    for (const room of sceneState.rooms || []) {
      const sector = sectorIndex.get(room.sectorId);

      if (!sector) {
        if (
          config.detectAddedRooms &&
          room.registeredNewRoom === true &&
          room.sectorId
        ) {
          changes.roomsAdded.push(
            this._createAddedRoomChange(
              room,
              gridSize
            )
          );
        } else {
          changes.missingSectors.push({
            sectorId: room.sectorId,
            stableId: room.stableId
          });
        }
        continue;
      }

      const originalBounds =
        room.originalBounds ||
        sector.bounds ||
        sector.pixelBounds || null;

      const moved = originalBounds
        ? (
            Math.abs(room.bounds.x - originalBounds.x) >
              config.positionTolerance ||
            Math.abs(room.bounds.y - originalBounds.y) >
              config.positionTolerance
          )
        : true;

      const resized = originalBounds
        ? (
            Math.abs(room.bounds.width - originalBounds.width) >
              config.sizeTolerance ||
            Math.abs(room.bounds.height - originalBounds.height) >
              config.sizeTolerance
          )
        : true;

      if (config.includeFloorStyles) {
        const beforeFloorStyle = sector.floorStyle && typeof sector.floorStyle === "object"
          ? structuredClone(sector.floorStyle) : null;
        const afterFloorStyle = room.floorStyle && typeof room.floorStyle === "object"
          ? structuredClone(room.floorStyle) : null;
        if (this._stableJson(beforeFloorStyle) !== this._stableJson(afterFloorStyle)) {
          changes.roomFloorStyles.push({
            sectorId: room.sectorId,
            stableId: room.stableId,
            before: beforeFloorStyle,
            after: afterFloorStyle
          });
        }
      }
      if (!moved && !resized) continue;

      changes.rooms.push({
        sectorId: room.sectorId,
        stableId: room.stableId,
        moved,
        resized,
        before:
          originalBounds
            ? structuredClone(originalBounds)
            : null,
        after: structuredClone(room.bounds),
        gridPosition: {
          col: Math.round(room.bounds.x / gridSize),
          row: Math.round(room.bounds.y / gridSize)
        },
        gridDimensions: {
          width: Math.max(
            1,
            Math.round(room.bounds.width / gridSize)
          ),
          height: Math.max(
            1,
            Math.round(room.bounds.height / gridSize)
          )
        }
      });
    }

    if (config.detectDeletedRooms) {
      const activeFloor =
        Number(
          sceneState.sceneMetadata?.floorNumber
        ) || null;

      for (const sector of manifest.sectors) {
        const sectorFloor =
          Number(sector.floor ?? 1) || 1;

        if (
          activeFloor !== null &&
          sectorFloor !== activeFloor
        ) {
          continue;
        }

        if (sceneRoomIds.has(sector.sectorId)) {
          continue;
        }

        changes.roomsDeleted.push({
          sectorId: sector.sectorId,
          sector: structuredClone(sector)
        });
      }
    }

    const connectionIndex =
      this._indexConnections(manifest);

    const sceneConnectionKeys = new Set();

    for (const door of sceneState.doors || []) {
      const keys = this._doorConnectionKeys(door);

      for (const key of keys) {
        sceneConnectionKeys.add(key);
      }

      const matches = keys
        .map(key => connectionIndex.get(key))
        .filter(Boolean);

      if (!matches.length) {
        if (
          config.detectAddedDoors &&
          door.registeredNewDoor === true &&
          door.sourceId &&
          door.targetId
        ) {
          changes.doorsAdded.push(
            this._createAddedDoorChange(door)
          );
        }
        continue;
      }

      for (const match of matches) {
        const desiredDoorType =
          this._canonicalDoorType(
            door.doorType ||
            door.connectionType
          );

        const currentDoorType =
          this._canonicalDoorType(
            match.connection.doorType ||
            match.connection.connectionType
          );

        const hasManifestWallSide =
          typeof match.connection.wallSide ===
            "string" &&
          match.connection.wallSide.trim().length > 0;

        const desiredWallSide =
          hasManifestWallSide
            ? this._manifestWallSide(door.face)
            : null;

        const currentWallSide =
          hasManifestWallSide
            ? this._manifestWallSide(
                match.connection.wallSide
              )
            : null;

        const doorTypeChanged =
          Boolean(desiredDoorType) &&
          Boolean(currentDoorType) &&
          desiredDoorType !== currentDoorType;

        const wallSideChanged =
          hasManifestWallSide &&
          Boolean(desiredWallSide) &&
          desiredWallSide !== currentWallSide;

        if (!doorTypeChanged && !wallSideChanged) {
          continue;
        }

        changes.doors.push({
          sectorId: match.sector.sectorId,
          targetId: match.connection.to,
          stableId: door.stableId,
          before: {
            doorType:
              match.connection.doorType || null,
            connectionType:
              match.connection.connectionType || null,
            wallSide:
              match.connection.wallSide || null
          },
          after: {
            doorType:
              doorTypeChanged
                ? this._formatDoorTypeLikeManifest(
                    desiredDoorType,
                    match.connection.doorType
                  )
                : match.connection.doorType || null,
            connectionType:
              doorTypeChanged
                ? this._connectionTypeForDoor(
                    desiredDoorType
                  )
                : match.connection.connectionType || null,
            wallSide:
              hasManifestWallSide
                ? desiredWallSide ||
                  match.connection.wallSide ||
                  null
                : null,
            doorState:
              config.includeDoorState
                ? door.doorState
                : undefined
          }
        });
      }
    }

    if (config.detectDeletedDoors) {
      for (const [key, match] of connectionIndex.entries()) {
        if (!this._connectionRequiresDoor(match.connection)) {
          continue;
        }

        if (sceneConnectionKeys.has(key)) {
          continue;
        }

        changes.doorsDeleted.push({
          sectorId: match.sector.sectorId,
          targetId: match.connection.to,
          stableId:
            `${match.sector.sectorId}:${match.connection.to}:start`,
          connection:
            structuredClone(match.connection)
        });
      }
    }

    if (config.includeBoundaryFeatures) {
      changes.boundaryFeatures =
        this._diffBoundaryFeatures(
          manifest,
          sceneState.boundaryFeatures || []
        );
    }

    if (config.includeVentilation) {
      const beforeVentilation = manifest.ventilation && typeof manifest.ventilation === "object"
        ? structuredClone(manifest.ventilation)
        : null;
      const afterVentilation = sceneState.ventilation && typeof sceneState.ventilation === "object"
        ? structuredClone(sceneState.ventilation)
        : null;
      if (this._stableJson(beforeVentilation) !== this._stableJson(afterVentilation)) {
        changes.ventilation = { before: beforeVentilation, after: afterVentilation };
      }
    }

    changes.changed = Boolean(
      changes.rooms.length ||
      changes.roomsAdded.length ||
      changes.roomsDeleted.length ||
      changes.doors.length ||
      changes.doorsAdded.length ||
      changes.doorsDeleted.length ||
      changes.boundaryFeatures.length ||
      Boolean(changes.ventilation) ||
      changes.roomFloorStyles.length
    );

    return changes;
  }

  static apply(manifest, changes) {
    const updated = structuredClone(manifest);

    const sectors = new Map(
      updated.sectors.map(sector => [
        sector.sectorId,
        sector
      ])
    );

    for (const change of changes.rooms || []) {
      const sector = sectors.get(change.sectorId);
      if (!sector) continue;

      sector.gridPosition = {
        ...change.gridPosition
      };
      sector.gridDimensions = {
        ...change.gridDimensions
      };
      sector.bounds = {
        ...change.after
      };
      sector.pixelBounds = {
        ...change.after
      };
    }

    for (const change of changes.roomFloorStyles || []) {
      const sector = sectors.get(change.sectorId);
      if (!sector) continue;
      if (change.after) sector.floorStyle = structuredClone(change.after);
      else delete sector.floorStyle;
    }
    for (const change of changes.roomsDeleted || []) {
      updated.sectors = updated.sectors.filter(
        sector => sector.sectorId !== change.sectorId
      );

      sectors.delete(change.sectorId);

      for (const sector of updated.sectors) {
        if (!Array.isArray(sector.connections)) {
          continue;
        }

        sector.connections = sector.connections.filter(
          connection => connection.to !== change.sectorId
        );
      }
    }

    for (const change of changes.roomsAdded || []) {
      if (sectors.has(change.sector.sectorId)) {
        continue;
      }

      const sector = structuredClone(change.sector);
      updated.sectors.push(sector);
      sectors.set(sector.sectorId, sector);
    }

    for (const change of changes.doors || []) {
      const sector = sectors.get(change.sectorId);
      if (!sector) continue;

      const connection =
        (sector.connections || [])
          .find(candidate =>
            candidate.to === change.targetId
          );

      if (!connection) continue;

      if (change.after.doorType) {
        connection.doorType =
          change.after.doorType;
      }

      if (change.after.connectionType) {
        connection.connectionType =
          change.after.connectionType;
      }

      if (change.after.wallSide) {
        connection.wallSide =
          change.after.wallSide;
      }

      if (change.after.doorState !== undefined) {
        connection.doorState =
          change.after.doorState;
      }
    }

    for (const change of changes.doorsDeleted || []) {
      const sector = sectors.get(change.sectorId);
      if (!sector || !Array.isArray(sector.connections)) {
        continue;
      }

      sector.connections =
        sector.connections.filter(connection =>
          connection.to !== change.targetId
        );
    }

    for (const change of changes.doorsAdded || []) {
      const sector = sectors.get(change.sourceId);
      const target = sectors.get(change.targetId);

      if (!sector || !target) continue;

      if (!Array.isArray(sector.connections)) {
        sector.connections = [];
      }

      const existing = sector.connections.find(
        connection =>
          connection.to === change.targetId
      );

      if (existing) {
        existing.connectionType =
          change.connectionType;
        existing.doorType =
          change.doorType;
      } else {
        sector.connections.push({
          to: change.targetId,
          connectionType:
            change.connectionType,
          doorType:
            change.doorType,
          ...(change.wallSide
            ? { wallSide: change.wallSide }
            : {})
        });
      }
    }

    for (const change of changes.boundaryFeatures || []) {
      const sector = sectors.get(change.sectorId);
      if (!sector) continue;

      sector.boundaryFeatures =
        structuredClone(change.features);
    }

    if (changes.ventilation) {
      if (changes.ventilation.after) updated.ventilation = structuredClone(changes.ventilation.after);
      else delete updated.ventilation;
    }

    updated.totalSectors = updated.sectors.length;
    updated.cartographer = {
      ...(updated.cartographer || {}),
      lastSceneSyncAt: Date.now(),
      lastSceneSyncChanges: {
        rooms: changes.rooms?.length || 0,
        roomsAdded:
          changes.roomsAdded?.length || 0,
        roomsDeleted:
          changes.roomsDeleted?.length || 0,
        doors: changes.doors?.length || 0,
        doorsAdded:
          changes.doorsAdded?.length || 0,
        doorsDeleted:
          changes.doorsDeleted?.length || 0,
        boundaryFeatures:
          changes.boundaryFeatures?.length || 0,
        ventilation:
          changes.ventilation ? 1 : 0
      }
    };

    return updated;
  }

  static async sync(
    scene = canvas.scene,
    manifestOverride = null,
    customConfig = {}
  ) {
    if (!game.user?.isGM) {
      ui.notifications.warn(
        "Cartographer Ledger Sync requires an active GM."
      );
      return null;
    }

    const config = {
      ...this.CONFIG,
      ...customConfig
    };

    const manifest =
      manifestOverride ||
      DungeonLedgerManager.getActiveManifest();

    if (!manifest || !Array.isArray(manifest.sectors)) {
      throw new Error(
        "Cartographer Ledger Sync could not resolve an active manifest."
      );
    }

    const sceneState =
      this.readScene(scene, config);

    const changes =
      this.diff(manifest, sceneState, config);

    if (!changes.changed) {
      ui.notifications.info(
        "Cartographer found no scene edits to synchronize."
      );

      return {
        manifest,
        sceneState,
        changes,
        persisted: false
      };
    }

    let updatedManifest =
      this.apply(manifest, changes);

    updatedManifest =
      this._removeReciprocalConnections(
        updatedManifest
      );

    if (
      config.validateGraph &&
      typeof DungeonLedgerManager
        .validateAndRepairGraph === "function"
    ) {
      updatedManifest =
        DungeonLedgerManager
          .validateAndRepairGraph(updatedManifest);

      updatedManifest =
        this._removeReciprocalConnections(
          updatedManifest
        );
    }

    let persistedPage = null;

    if (config.persist) {
      persistedPage =
        await syncDungeonManifestToMemory(
          updatedManifest
        );
    }

    await scene?.setFlag(
      CartographerMetadata.NAMESPACE,
      "cartographer.lastLedgerSync",
      {
        syncedAt: Date.now(),
        manifestId:
          CartographerMetadata
            .getManifestId(updatedManifest),
        changeCounts: {
          rooms: changes.rooms.length,
          roomsAdded:
            changes.roomsAdded.length,
          roomsDeleted:
            changes.roomsDeleted.length,
          doors: changes.doors.length,
          doorsAdded:
            changes.doorsAdded.length,
          doorsDeleted:
            changes.doorsDeleted.length,
          boundaryFeatures:
            changes.boundaryFeatures.length,
          ventilation:
            changes.ventilation ? 1 : 0
        }
      }
    );

    ui.notifications.info(
      `Cartographer synchronized ${changes.rooms.length} room edits, ` +
      `${changes.roomsAdded.length} added rooms, ` +
      `${changes.roomsDeleted.length} deleted rooms, ` +
      `${changes.doors.length} door edits, ` +
      `${changes.doorsAdded.length} added doors, and ` +
      `${changes.doorsDeleted.length} deleted doors.`
    );

    return {
      manifest: updatedManifest,
      sceneState,
      changes,
      persisted: Boolean(persistedPage),
      persistedPage
    };
  }

  static async registerNewRoom(
    drawing,
    {
      sectorId,
      name = null,
      graphRole = "OPTIONAL",
      shapeType = null,
      floor = 1,
      importance = 1,
      connections = []
    } = {}
  ) {
    if (!drawing) {
      throw new Error(
        "registerNewRoom requires a Foundry Drawing document."
      );
    }

    if (!sectorId) {
      throw new Error(
        "registerNewRoom requires sectorId."
      );
    }

    const bounds = this._drawingBounds(drawing);
    const resolvedShapeType =
      String(
        shapeType ||
        this._shapeTypeForRole(graphRole)
      ).toUpperCase();

    const sector = {
      sectorId,
      name: name || sectorId,
      graphRole:
        String(graphRole || "OPTIONAL")
          .toUpperCase(),
      shapeType: resolvedShapeType,
      floor: Number(floor) || 1,
      importance:
        Number(importance) || 1,
      connections:
        structuredClone(connections || [])
    };

    const flags =
      CartographerMetadata.createRoomFloorFlags({
        sector,
        floor: sector.floor,
        shapeType: resolvedShapeType,
        bounds,
        polygon: null,
        generationId:
          drawing.parent?.flags
            ?.[CartographerMetadata.NAMESPACE]
            ?.cartographer?.generationId || null,
        manifestId:
          drawing.parent?.flags
            ?.[CartographerMetadata.NAMESPACE]
            ?.cartographer?.manifestId || null
      });

    flags[CartographerMetadata.NAMESPACE]
      .cartographer.properties.registeredNewRoom =
        true;
    flags[CartographerMetadata.NAMESPACE]
      .cartographer.properties.importance =
        sector.importance;
    flags[CartographerMetadata.NAMESPACE]
      .cartographer.properties.connections =
        structuredClone(sector.connections);

    await drawing.update({
      flags: {
        ...(drawing.flags || {}),
        ...flags
      }
    });

    return drawing;
  }

  static async registerNewDoor(
    wall,
    {
      sourceId,
      targetId,
      face = null,
      width = null
    } = {}
  ) {
    if (!wall) {
      throw new Error(
        "registerNewDoor requires a Foundry Wall document."
      );
    }

    if (!sourceId || !targetId) {
      throw new Error(
        "registerNewDoor requires sourceId and targetId."
      );
    }

    const doorType =
      this._doorTypeFromFoundryWall(
        wall,
        "STANDARD"
      );

    const segment = this._wallSegment(wall);
    const orientation =
      Math.abs(segment.x2 - segment.x1) >=
      Math.abs(segment.y2 - segment.y1)
        ? "HORIZONTAL"
        : "VERTICAL";

    const location = {
      x: (segment.x1 + segment.x2) / 2,
      y: (segment.y1 + segment.y2) / 2
    };

    const resolvedFace =
      face ||
      (orientation === "HORIZONTAL"
        ? "NORTH"
        : "WEST");

    const opening = {
      id:
        `manual:${sourceId}:${targetId}:${wall.id}`,
      sourceId,
      targetId,
      hostType: "ROOM",
      hostId: sourceId,
      location,
      face: resolvedFace,
      orientation,
      width:
        width ||
        Math.hypot(
          segment.x2 - segment.x1,
          segment.y2 - segment.y1
        ),
      doorType,
      connectionType:
        this._connectionTypeForDoor(doorType),
      sharedDoor: false
    };

    const flags =
      CartographerMetadata.createDoorFlags({
        opening,
        segment,
        generationId:
          wall.parent?.flags
            ?.[CartographerMetadata.NAMESPACE]
            ?.cartographer?.generationId || null,
        manifestId:
          wall.parent?.flags
            ?.[CartographerMetadata.NAMESPACE]
            ?.cartographer?.manifestId || null
      });

    flags[CartographerMetadata.NAMESPACE]
      .cartographer.properties.registeredNewDoor =
        true;

    await wall.update({
      flags: {
        ...(wall.flags || {}),
        ...flags
      }
    });

    return wall;
  }

  static _readRooms(scene) {
    return scene.drawings.contents
      .filter(drawing =>
        CartographerMetadata
          .isCartographerDocument(
            drawing,
            CartographerMetadata
              .DOCUMENT_TYPES.ROOM_FLOOR
          )
      )
      .map(drawing => {
        const metadata =
          CartographerMetadata.get(drawing);

        const width =
          Number(metadata?.geometry
            ?.bounds?.width) ||
          Number(drawing.shape?.width) ||
          this._polygonWidth(
            drawing.shape?.points
          );

        const height =
          Number(metadata?.geometry
            ?.bounds?.height) ||
          Number(drawing.shape?.height) ||
          this._polygonHeight(
            drawing.shape?.points
          );

        return {
          stableId: metadata.stableId,
          sectorId: metadata.sectorId,
          floor: metadata.floor,
          bounds: {
            x: Number(drawing.x) || 0,
            y: Number(drawing.y) || 0,
            width,
            height
          },
          originalBounds:
            metadata.geometry?.bounds
              ? structuredClone(
                  metadata.geometry.bounds
                )
              : null,
          name:
            metadata.properties?.name ||
            metadata.sectorId,
          graphRole:
            metadata.properties?.graphRole ||
            "OPTIONAL",
          shapeType:
            metadata.properties?.shapeType ||
            "RECTANGLE",
          importance:
            Number(
              metadata.properties?.importance
            ) || 1,
          connections:
            structuredClone(
              metadata.properties?.connections || []
            ),
          floorStyle: metadata.properties?.floorStyle
            ? structuredClone(metadata.properties.floorStyle)
            : null,
          registeredNewRoom:
            metadata.properties
              ?.registeredNewRoom === true,
          documentId: drawing.id
        };
      });
  }

  static _readDoors(scene, config) {
    return scene.walls.contents
      .filter(wall =>
        CartographerMetadata
          .isCartographerDocument(
            wall,
            CartographerMetadata
              .DOCUMENT_TYPES.DOOR
          )
      )
      .map(wall => {
        const metadata =
          CartographerMetadata.get(wall);
        const properties =
          metadata.properties || {};
        const geometry =
          metadata.geometry || {};

        return {
          stableId: metadata.stableId,
          sourceId: metadata.sourceId,
          targetId: metadata.targetId,
          hostType: metadata.hostType,
          hostId: metadata.hostId,
          connectionType:
            properties.connectionType || null,
          originalDoorType:
            properties.doorType || null,
          doorType:
            this._doorTypeFromFoundryWall(
              wall,
              properties.doorType
            ),
          sharedDoor:
            properties.sharedDoor === true,
          registeredNewDoor:
            properties.registeredNewDoor === true,
          connectedTargets:
            structuredClone(
              properties.connectedTargets || []
            ),
          face: geometry.face || null,
          orientation:
            geometry.orientation || null,
          width: geometry.width || null,
          segment: this._wallSegment(wall),
          doorState:
            config.includeDoorState
              ? wall.ds
              : null,
          documentId: wall.id
        };
      });
  }

  static _readVentilation(scene) {
    const groups = new Map();
    for (const drawing of scene.drawings.contents) {
      const metadata = drawing.flags?.[CartographerMetadata.NAMESPACE]?.cartographer;
      if (metadata?.documentType !== "VENTILATION_DUCT") continue;
      const connectionId = String(metadata.stableId || "").replace(/:segment:\d+$/, "");
      if (!groups.has(connectionId)) {
        groups.set(connectionId, {
          from: metadata.sourceId,
          to: metadata.targetId,
          accessType: metadata.properties?.accessType || "VENT_GRATE",
          size: metadata.properties?.size || "SMALL",
          networkType: metadata.properties?.networkType || "AIR_DUCT",
          visibility: metadata.properties?.visibility || "HIDDEN"
        });
      }
    }
    const connections = [...groups.values()];
    if (!connections.length) return null;
    return {
      enabled: true,
      networkType: connections[0].networkType,
      visibility: connections[0].visibility,
      connections
    };
  }

  static _readBoundaryFeatures(scene) {
    const bySector = new Map();

    for (const wall of scene.walls.contents) {
      if (!CartographerMetadata.isCartographerDocument(
        wall,
        CartographerMetadata
          .DOCUMENT_TYPES.BOUNDARY_FEATURE
      )) {
        continue;
      }

      const metadata =
        CartographerMetadata.get(wall);
      const sectorId =
        metadata.sectorId || metadata.hostId;

      if (!sectorId) continue;
      if (!bySector.has(sectorId)) {
        bySector.set(sectorId, []);
      }

      bySector.get(sectorId).push({
        id:
          metadata.properties?.featureId ||
          metadata.stableId,
        featureType:
          metadata.properties?.featureType ||
          "STANDARD_WALL",
        hostType:
          metadata.hostType || "ROOM",
        hostId:
          metadata.hostId || sectorId,
        sourceId:
          metadata.sourceId || sectorId,
        face:
          metadata.geometry?.face || null,
        orientation:
          metadata.geometry?.orientation || null,
        width:
          metadata.geometry?.width || null,
        location:
          metadata.geometry?.location
            ? structuredClone(
                metadata.geometry.location
              )
            : null,
        direction:
          metadata.properties?.direction ||
          "BOTH",
        metadata:
          structuredClone(
            metadata.properties?.metadata || {}
          )
      });
    }

    return [...bySector.entries()]
      .map(([sectorId, features]) => ({
        sectorId,
        features
      }));
  }

  static _diffBoundaryFeatures(
    manifest,
    sceneFeatures
  ) {
    const sectors = new Map(
      manifest.sectors.map(sector => [
        sector.sectorId,
        sector
      ])
    );

    const changes = [];

    for (const group of sceneFeatures) {
      const sector = sectors.get(group.sectorId);
      if (!sector) continue;

      const before =
        Array.isArray(sector.boundaryFeatures)
          ? sector.boundaryFeatures
          : [];

      if (
        this._stableJson(before) ===
        this._stableJson(group.features)
      ) {
        continue;
      }

      changes.push({
        sectorId: group.sectorId,
        before: structuredClone(before),
        features:
          structuredClone(group.features)
      });
    }

    return changes;
  }

  static _removeReciprocalConnections(
    manifest
  ) {
    if (!manifest || !Array.isArray(manifest.sectors)) {
      return manifest;
    }

    const retainedByPair = new Map();

    for (const sector of manifest.sectors) {
      if (!Array.isArray(sector.connections)) {
        sector.connections = [];
      }

      for (const connection of sector.connections) {
        if (!connection?.to) continue;

        const pairKey = [sector.sectorId, connection.to]
          .sort()
          .join("<->");

        const existing = retainedByPair.get(pairKey);

        if (
          !existing ||
          this._connectionMetadataScore(connection) >
            this._connectionMetadataScore(existing.connection)
        ) {
          retainedByPair.set(pairKey, {
            sectorId: sector.sectorId,
            connection
          });
        }
      }
    }

    for (const sector of manifest.sectors) {
      sector.connections = [];
    }

    for (const retained of retainedByPair.values()) {
      const sector = manifest.sectors.find(
        candidate => candidate.sectorId === retained.sectorId
      );

      if (sector) {
        sector.connections.push(retained.connection);
      }
    }

    return manifest;
  }

  static _connectionMetadataScore(connection) {
    if (!connection) return 0;

    let score = 0;
    if (connection.connectionType) score += 4;
    if (connection.doorType) score += 4;
    if (connection.wallSide) score += 1;
    if (connection.doorState !== undefined) score += 1;
    return score;
  }

  static _createAddedRoomChange(
    room,
    gridSize
  ) {
    return {
      sectorId: room.sectorId,
      stableId: room.stableId,
      sector: {
        sectorId: room.sectorId,
        name: room.name || room.sectorId,
        graphRole:
          String(room.graphRole || "OPTIONAL")
            .toUpperCase(),
        shapeType:
          String(room.shapeType || "RECTANGLE")
            .toUpperCase(),
        importance:
          Number(room.importance) || 1,
        floor: Number(room.floor) || 1,
        gridPosition: {
          col: Math.round(
            room.bounds.x / gridSize
          ),
          row: Math.round(
            room.bounds.y / gridSize
          )
        },
        gridDimensions: {
          width: Math.max(
            1,
            Math.round(
              room.bounds.width / gridSize
            )
          ),
          height: Math.max(
            1,
            Math.round(
              room.bounds.height / gridSize
            )
          )
        },
        bounds: structuredClone(room.bounds),
        pixelBounds:
          structuredClone(room.bounds),
        connections:
          structuredClone(
            room.connections || []
          )
      }
    };
  }

  static _drawingBounds(drawing) {
    const points = drawing.shape?.points || [];

    return {
      x: Number(drawing.x) || 0,
      y: Number(drawing.y) || 0,
      width:
        Number(drawing.shape?.width) ||
        this._polygonWidth(points),
      height:
        Number(drawing.shape?.height) ||
        this._polygonHeight(points)
    };
  }

  static _shapeTypeForRole(graphRole) {
    switch (
      String(graphRole || "")
        .toUpperCase()
    ) {
      case "OBJECTIVE":
        return "OCTAGON";
      case "HUB":
        return "CROSS";
      case "OPTIONAL":
        return "L_SHAPE";
      case "SECRET":
        return "T_SHAPE";
      default:
        return "RECTANGLE";
    }
  }

  static _indexConnections(manifest) {
    const index = new Map();

    for (const sector of manifest.sectors) {
      for (const connection of sector.connections || []) {
        if (!connection?.to) continue;

        index.set(
          `${sector.sectorId}->${connection.to}`,
          { sector, connection }
        );
      }
    }

    return index;
  }

  static _doorConnectionKeys(door) {
    if (door.sharedDoor) return [];

    const keys = [];

    if (door.sourceId && door.targetId) {
      keys.push(
        `${door.sourceId}->${door.targetId}`
      );
    }

    for (const targetId of door.connectedTargets || []) {
      if (door.sourceId && targetId) {
        keys.push(
          `${door.sourceId}->${targetId}`
        );
      }
    }

    return [...new Set(keys)];
  }

  static _createAddedDoorChange(door) {
    const canonical =
      this._canonicalDoorType(door.doorType);

    return {
      sourceId: door.sourceId,
      targetId: door.targetId,
      stableId: door.stableId,
      doorType:
        this._formatDoorTypeLikeManifest(
          canonical,
          door.originalDoorType
        ),
      connectionType:
        this._connectionTypeForDoor(canonical),
      wallSide:
        this._manifestWallSide(door.face),
      segment:
        structuredClone(door.segment)
    };
  }

  static _connectionRequiresDoor(connection) {
    const canonical =
      this._canonicalDoorType(
        connection.doorType ||
        connection.connectionType
      );

    return [
      "STANDARD",
      "LOCKED",
      "SECRET"
    ].includes(canonical);
  }

  static _doorTypeFromFoundryWall(
    wall,
    fallbackType = null
  ) {
    const doorTypes =
      globalThis.CONST?.WALL_DOOR_TYPES || {};
    const doorStates =
      globalThis.CONST?.WALL_DOOR_STATES || {};

    const nativeDoorType = Number(wall?.door);
    const nativeDoorState = Number(wall?.ds);
    const secretType = doorTypes.SECRET ?? 2;
    const normalType = doorTypes.DOOR ?? 1;
    const lockedState = doorStates.LOCKED ?? 2;

    if (nativeDoorType === secretType) {
      return "SECRET";
    }

    if (
      nativeDoorType === normalType &&
      nativeDoorState === lockedState
    ) {
      return "LOCKED";
    }

    if (nativeDoorType === normalType) {
      return "STANDARD";
    }

    return this._canonicalDoorType(fallbackType);
  }

  static _canonicalDoorType(value) {
    const normalized = String(value || "")
      .trim()
      .toUpperCase()
      .replace(/[\s-]+/g, "_");

    const aliases = {
      DOOR: "STANDARD",
      STANDARD: "STANDARD",
      STANDARD_DOOR: "STANDARD",
      NORMAL: "STANDARD",
      NORMAL_DOOR: "STANDARD",
      LOCKED: "LOCKED",
      LOCKED_DOOR: "LOCKED",
      SECRET: "SECRET",
      SECRET_DOOR: "SECRET",
      CONCEALED: "SECRET",
      CONCEALED_PASSAGE: "SECRET",
      ARCHWAY: "ARCHWAY",
      OPEN: "OPENING",
      OPENING: "OPENING",
      NONE: "OPENING",
      ROOM_TO_ROOM: "OPENING",
      COLLAPSED_OPENING: "OPENING"
    };

    return aliases[normalized] ||
      (normalized || null);
  }

  static _formatDoorTypeLikeManifest(
    canonicalType,
    existingValue
  ) {
    const existing = String(existingValue || "");
    const lowerSnakeCase =
      existing === existing.toLowerCase() &&
      existing.includes("_");

    const values = {
      STANDARD:
        lowerSnakeCase
          ? "standard_door"
          : "STANDARD",
      LOCKED:
        lowerSnakeCase
          ? "locked_door"
          : "LOCKED",
      SECRET:
        lowerSnakeCase
          ? "secret_door"
          : "SECRET",
      ARCHWAY:
        lowerSnakeCase
          ? "archway"
          : "ARCHWAY",
      OPENING:
        lowerSnakeCase
          ? "opening"
          : "OPENING"
    };

    return values[canonicalType] ||
      existingValue || canonicalType;
  }

  static _connectionTypeForDoor(
    canonicalDoorType
  ) {
    const mapping = {
      STANDARD: "STANDARD_DOOR",
      LOCKED: "LOCKED_DOOR",
      SECRET: "SECRET_DOOR",
      ARCHWAY: "ARCHWAY",
      OPENING: "OPENING"
    };

    return mapping[canonicalDoorType] ||
      "STANDARD_DOOR";
  }

  static _manifestWallSide(face) {
    const value = String(face || "")
      .toLowerCase();

    return [
      "north",
      "south",
      "east",
      "west"
    ].includes(value)
      ? value
      : null;
  }

  static _wallSegment(wall) {
    const coordinates =
      wall.c || wall.coords || [];

    return {
      x1: Number(coordinates[0]) || 0,
      y1: Number(coordinates[1]) || 0,
      x2: Number(coordinates[2]) || 0,
      y2: Number(coordinates[3]) || 0
    };
  }

  static _polygonWidth(points = []) {
    const values = [];
    for (let index = 0; index < points.length; index += 2) {
      values.push(Number(points[index]) || 0);
    }
    return values.length
      ? Math.max(...values) - Math.min(...values)
      : 0;
  }

  static _polygonHeight(points = []) {
    const values = [];
    for (let index = 1; index < points.length; index += 2) {
      values.push(Number(points[index]) || 0);
    }
    return values.length
      ? Math.max(...values) - Math.min(...values)
      : 0;
  }

  static _stableJson(value) {
    return JSON.stringify(
      this._sortObject(value)
    );
  }

  static _sortObject(value) {
    if (Array.isArray(value)) {
      return value.map(item =>
        this._sortObject(item)
      );
    }

    if (value && typeof value === "object") {
      return Object.keys(value)
        .sort()
        .reduce((output, key) => {
          output[key] =
            this._sortObject(value[key]);
          return output;
        }, {});
    }

    return value;
  }
}

export const LedgerSync =
  CartographerLedgerSync;
