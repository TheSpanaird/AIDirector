// separate-scenes-renderer.js
// Creates, renders, and pairs one Foundry Scene per floor.
import { CartographerMetadata } from "../cartographer-metadata.js";
import { SpaceshipHullRenderer } from "./spaceship-hull-renderer.js";

export class SeparateScenesRenderer {
  static async render(presentation, options = {}) {
    if (!presentation?.scenes?.length) {
      throw new Error("SeparateScenesRenderer requires planned scenes.");
    }

    const manifestId = options.manifestId || presentation.structureId;
    const generationId = options.generationId || `separate-scenes-${Date.now()}`;
    const created = [];

    for (const plan of presentation.scenes) {
      const existing = game.scenes.contents.find(scene =>
        scene.flags?.[CartographerMetadata.NAMESPACE]?.cartographer?.structureId ===
          presentation.structureId &&
        Number(scene.flags?.[CartographerMetadata.NAMESPACE]?.cartographer?.floorNumber) ===
          Number(plan.floor)
      );
      if (existing && options.replaceExisting !== false) await existing.delete();

      const scene = await Scene.create({
        name: plan.sceneName,
        navigation: options.navigation !== false,
        width: plan.scene.width,
        height: plan.scene.height,
        padding: plan.scene.padding,
        grid: { type: CONST.GRID_TYPES.SQUARE, size: plan.scene.gridSize },
        tokenVision: options.tokenVision !== false,
        globalLight: options.globalLight !== false
      });

      const layoutResult = {
        sectors: plan.result.sectors,
        floors: plan.result.floors
      };

      await CartographerRoomRenderer.render(layoutResult, scene, {
        gridSize: plan.scene.gridSize,
        generationId: `${generationId}-floor-${plan.floor}-rooms`,
        manifestId
      });
      await RoomLabelRenderer.render(layoutResult, scene, {
        gridSize: plan.scene.gridSize,
        generationId: `${generationId}-floor-${plan.floor}-labels`,
        manifestId
      });
      await CartographerWallRenderer.render(
        layoutResult,
        plan.result.normalizedTopology || {},
        plan.result.openingPlan || { openings: [] },
        options.boundaryFeaturePlans?.[plan.floor] || { features: [] },
        scene,
        {
          generationId: `${generationId}-floor-${plan.floor}-walls`,
          manifestId,
          replaceExisting: true
        }
      );

      const hullReport = options.renderHulls === false
        ? null
        : await SpaceshipHullRenderer.renderFloor(plan.result, scene, {
            structureId: presentation.structureId,
            manifestId,
            generationId: `${generationId}-floor-${plan.floor}-hull`,
            floor: plan.floor,
            translation: plan.translation,
            floorPresentation: "SEPARATE_SCENES",
            fillAlpha: options.hullFillAlpha ?? 0.25,
            strokeAlpha: options.hullStrokeAlpha ?? 0.8,
            sort: options.hullSort ?? -100000
          });

      const connectorData = (plan.verticalAnchors || []).map(anchor => ({
        x: anchor.location.x - 50,
        y: anchor.location.y - 50,
        shape: { type: "e", width: 100, height: 100 },
        fillType: 1,
        fillColor: "#00b7ff",
        fillAlpha: 0.65,
        strokeColor: "#ffffff",
        strokeAlpha: 1,
        strokeWidth: 4,
        text: `${anchor.connectionType}\n${anchor.anchorId}`,
        fontSize: 16,
        textColor: "#ffffff",
        flags: CartographerMetadata.createVerticalConnectorFlags({
          structureId: presentation.structureId,
          connectionId: anchor.connectionId,
          connectionType: anchor.connectionType,
          anchorId: anchor.anchorId,
          floor: plan.floor,
          sectorId: anchor.sectorId,
          location: anchor.location,
          generationId,
          manifestId
        })
      }));
      const connectors = connectorData.length
        ? await scene.createEmbeddedDocuments("Drawing", connectorData)
        : [];

      const sceneMetadata = CartographerMetadata.createSceneMetadata({
        manifest: { manifestId, dungeonTitle: presentation.structureName },
        floorNumber: plan.floor,
        config: {
          gridSize: plan.scene.gridSize,
          floorPresentation: "SEPARATE_SCENES"
        },
        generationId
      });
      await CartographerMetadata.setSceneMetadata(scene, {
        ...sceneMetadata,
        structureId: presentation.structureId,
        structureName: presentation.structureName,
        floorPresentation: "SEPARATE_SCENES",
        floorNumber: plan.floor,
        floorName: plan.floorName,
        floorRole: plan.floorRole,
        connectedSceneIds: []
      });

      created.push({ plan, scene, connectors, hullReport });
    }

    await this._pairConnectors(created, presentation);
    return {
      structureId: presentation.structureId,
      scenes: created,
      sceneIds: created.map(item => item.scene.id),
      connectorCount: created.reduce((sum, item) => sum + item.connectors.length, 0),
      hullCount: created.filter(item => item.hullReport?.rendered).length
    };
  }

  static async _pairConnectors(created) {
    const markers = created.flatMap(item =>
      item.connectors.map(marker => ({
        marker,
        scene: item.scene,
        plan: item.plan,
        metadata: CartographerMetadata.get(marker)
      }))
    );

    for (const source of markers) {
      const sourceConnectionId =
        source.metadata?.properties?.connectionId || source.metadata?.connectionId;
      const target = markers.find(candidate => {
        const candidateConnectionId =
          candidate.metadata?.properties?.connectionId || candidate.metadata?.connectionId;
        return candidateConnectionId === sourceConnectionId &&
          candidate.scene.id !== source.scene.id;
      });
      if (!target) {
        throw new Error(`No paired connector found for ${sourceConnectionId}.`);
      }
      await CartographerMetadata.setVerticalConnectorDestination(source.marker, {
        targetFloor: target.plan.floor,
        targetSceneId: target.scene.id,
        targetX: target.metadata.geometry.location.x,
        targetY: target.metadata.geometry.location.y
      });
      const sceneMetadata = structuredClone(
        CartographerMetadata.getSceneMetadata(source.scene) || {}
      );
      sceneMetadata.connectedSceneIds = [
        ...new Set([...(sceneMetadata.connectedSceneIds || []), target.scene.id])
      ];
      sceneMetadata.updatedAt = Date.now();
      await CartographerMetadata.setSceneMetadata(source.scene, sceneMetadata);
    }
  }
}
