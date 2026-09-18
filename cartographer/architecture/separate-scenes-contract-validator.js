// separate-scenes-contract-validator.js
// Validates persisted SEPARATE_SCENES structures and cross-scene connectors.

export class SeparateScenesContractValidator {
  static validate({ scenes = [], declaredFloors = [], structureId = null } = {}) {
    const problems = [];
    const reports = [];
    const floorNumbers = declaredFloors.map(floor => Number(floor.floor));
    const sceneById = new Map(scenes.map(scene => [scene.id, scene]));
    const metadataOf = document =>
      document.flags?.["ai-director"]?.cartographer || null;

    const connectorProperties = metadata => ({
      connectionId:
        metadata?.properties?.connectionId ??
        metadata?.connectionId ??
        metadata?.legacy?.connectionId ??
        null,
      connectionType:
        metadata?.properties?.connectionType ??
        metadata?.connectionType ??
        metadata?.legacy?.connectionType ??
        null,
      anchorId:
        metadata?.properties?.anchorId ??
        metadata?.anchorId ??
        metadata?.legacy?.anchorId ??
        null,
      targetFloor:
        metadata?.properties?.targetFloor ??
        metadata?.targetFloor ??
        null,
      targetSceneId:
        metadata?.properties?.targetSceneId ??
        metadata?.targetSceneId ??
        null,
      targetX:
        metadata?.properties?.targetX ??
        metadata?.targetX ??
        null,
      targetY:
        metadata?.properties?.targetY ??
        metadata?.targetY ??
        null
    });

    if (!scenes.length) {
      problems.push({ check: "scenes", problem: "no-scenes-found" });
    }

    const seenFloors = new Set();
    const sceneStructureIds = new Set();
    const graph = new Map();

    for (const scene of scenes) {
      const metadata = metadataOf(scene);
      const floor = Number(metadata?.floorNumber);
      const roomDrawings = scene.drawings.contents.filter(drawing =>
        metadataOf(drawing)?.documentType === "room-floor"
      );
      const architecturalWalls = scene.walls.contents.filter(wall =>
        metadataOf(wall)?.documentType !== "FLOOR_ISOLATION_WALL"
      );
      const doors = scene.walls.contents.filter(wall => Number(wall.door) > 0);
      const windows = scene.walls.contents.filter(wall =>
        metadataOf(wall)?.properties?.featureType === "WINDOW_WALL"
      );
      const connectors = scene.drawings.contents.filter(drawing =>
        metadataOf(drawing)?.documentType === "vertical-connector"
      );

      if (!Number.isInteger(floor)) {
        problems.push({
          sceneId: scene.id,
          check: "floor",
          problem: "invalid-floor-number"
        });
      } else if (seenFloors.has(floor)) {
        problems.push({
          sceneId: scene.id,
          floor,
          check: "floor",
          problem: "duplicate-scene-for-floor"
        });
      } else {
        seenFloors.add(floor);
      }

      if (metadata?.floorPresentation !== "SEPARATE_SCENES") {
        problems.push({
          sceneId: scene.id,
          check: "presentation",
          problem: "wrong-floor-presentation"
        });
      }
      if (!metadata?.structureId) {
        problems.push({
          sceneId: scene.id,
          check: "structureId",
          problem: "missing-structure-id"
        });
      } else {
        sceneStructureIds.add(metadata.structureId);
      }
      if (structureId && metadata?.structureId !== structureId) {
        problems.push({
          sceneId: scene.id,
          check: "structureId",
          problem: "structure-id-mismatch"
        });
      }
      if (!roomDrawings.length) {
        problems.push({ sceneId: scene.id, check: "rooms", problem: "no-room-drawings" });
      }
      if (!architecturalWalls.length) {
        problems.push({ sceneId: scene.id, check: "walls", problem: "no-architectural-walls" });
      }
      if (!doors.length) {
        problems.push({ sceneId: scene.id, check: "doors", problem: "no-doors" });
      }
      if (!windows.length) {
        problems.push({ sceneId: scene.id, check: "windows", problem: "no-windows" });
      }
      if (!connectors.length) {
        problems.push({ sceneId: scene.id, check: "connectors", problem: "no-vertical-connectors" });
      }

      graph.set(scene.id, new Set());
      for (const connector of connectors) {
        const connectorMetadata = metadataOf(connector);
        const properties = connectorProperties(connectorMetadata);
        const target = sceneById.get(properties.targetSceneId);

        if (!properties.connectionId) {
          problems.push({
            sceneId: scene.id,
            check: "connector",
            problem: "missing-connection-id"
          });
        }
        if (!target) {
          problems.push({
            sceneId: scene.id,
            connectionId: properties.connectionId,
            check: "connector",
            problem: "invalid-target-scene-id"
          });
          continue;
        }

        const inside =
          Number(properties.targetX) >= 0 &&
          Number(properties.targetY) >= 0 &&
          Number(properties.targetX) <= Number(target.width) &&
          Number(properties.targetY) <= Number(target.height);
        if (!inside) {
          problems.push({
            sceneId: scene.id,
            connectionId: properties.connectionId,
            check: "connector",
            problem: "target-coordinates-outside-scene"
          });
        }

        const reverse = target.drawings.contents.find(drawing => {
          const candidate = metadataOf(drawing);
          const candidateProperties = connectorProperties(candidate);
          return (
            candidate?.documentType === "vertical-connector" &&
            candidateProperties.connectionId === properties.connectionId &&
            candidateProperties.targetSceneId === scene.id
          );
        });
        if (!reverse) {
          problems.push({
            sceneId: scene.id,
            connectionId: properties.connectionId,
            check: "connector",
            problem: "unpaired-connector-metadata"
          });
        }

        graph.get(scene.id).add(target.id);
      }

      const connectedSceneIds = new Set(metadata?.connectedSceneIds || []);
      for (const connector of connectors) {
        const targetId = connectorProperties(metadataOf(connector)).targetSceneId;
        if (targetId && !connectedSceneIds.has(targetId)) {
          problems.push({
            sceneId: scene.id,
            check: "scene-metadata",
            problem: "connected-scene-id-not-persisted"
          });
        }
      }

      reports.push({
        sceneId: scene.id,
        sceneName: scene.name,
        floor,
        structureId: metadata?.structureId || null,
        rooms: roomDrawings.length,
        walls: architecturalWalls.length,
        doors: doors.length,
        windows: windows.length,
        connectors: connectors.length
      });
    }

    if (sceneStructureIds.size > 1) {
      problems.push({
        check: "structureId",
        problem: "scenes-do-not-share-structure-id"
      });
    }
    for (const floor of floorNumbers) {
      if (!seenFloors.has(floor)) {
        problems.push({
          floor,
          check: "floor",
          problem: "declared-floor-missing-scene"
        });
      }
    }
    if (floorNumbers.length && scenes.length !== floorNumbers.length) {
      problems.push({
        check: "scene-count",
        problem: "scene-count-does-not-match-declared-floors"
      });
    }

    if (scenes.length) {
      const visited = new Set();
      const queue = [scenes[0].id];
      while (queue.length) {
        const current = queue.shift();
        if (visited.has(current)) continue;
        visited.add(current);
        for (const neighbor of graph.get(current) || []) {
          if (!visited.has(neighbor)) queue.push(neighbor);
        }
      }
      if (visited.size !== scenes.length) {
        problems.push({
          check: "reachability",
          problem: "cross-scene-graph-not-fully-reachable"
        });
      }
    }

    return {
      valid: problems.length === 0,
      problems,
      reports,
      metrics: {
        scenes: scenes.length,
        floors: seenFloors.size,
        structureIds: sceneStructureIds.size,
        connectors: reports.reduce(
          (sum, report) => sum + report.connectors,
          0
        )
      }
    };
  }

  static findScenes(structureId) {
    return game.scenes.contents.filter(scene =>
      scene.flags?.["ai-director"]?.cartographer?.structureId === structureId
    );
  }
}
