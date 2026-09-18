// skydock-security-renderer.js
// Renders cameras and bend turrets only on the vent elevation.
export class SkydockSecurityRenderer {
  static NAMESPACE = "ai-director";
  static TYPES = Object.freeze({ CAMERA: "SECURITY_CAMERA", TURRET: "DUCT_TURRET" });

  static async render(securityPlan, ventilationPlan, scene = canvas.scene, options = {}) {
    if (!scene || !securityPlan?.enabled) return [];
    if (options.clearExisting !== false) await this.clear(scene);
    const size = Math.max(40, Number(options.markerSize) || 70);
    const bottom = Number(ventilationPlan.elevationBottom ?? 10);
    const top = Number(ventilationPlan.elevationTop ?? 15);
    const drawings = [];
    const seen = new Set();

    for (const device of securityPlan.devices || []) {
      drawings.push(this._drawing(device.id, this.TYPES.CAMERA, device.location, size, false, bottom, top));
    }
    if (securityPlan.ductCameraPolicy === "EACH_CONNECTION") {
      for (const connection of ventilationPlan.connections || []) {
        const path = connection.path || [];
        if (path.length < 2) continue;
        const point = path[Math.floor(path.length / 2)];
        const key = `camera:${point.x}:${point.y}`;
        if (seen.has(key)) continue;
        seen.add(key);
        drawings.push(this._drawing(key, this.TYPES.CAMERA, point, size, false, bottom, top));
      }
    }
    if (securityPlan.ductBendTurretPolicy === "EACH_BEND") {
      for (const point of ventilationPlan.physicalBends || []) {
        const key = `turret:${point.x}:${point.y}`;
        if (seen.has(key)) continue;
        seen.add(key);
        drawings.push(this._drawing(key, this.TYPES.TURRET, point, size, false, bottom, top));
      }
    }
    return drawings.length ? scene.createEmbeddedDocuments("Drawing", drawings) : [];
  }

  static _drawing(stableId, documentType, location, size, hidden, bottom, top) {
    const camera = documentType === this.TYPES.CAMERA;
    return {
      x: location.x - size / 2,
      y: location.y - size / 2,
      hidden,
      shape: { type: camera ? "e" : "r", width: size, height: size },
      fillType: 1,
      fillColor: camera ? "#FACC15" : "#EF4444",
      fillAlpha: 0.72,
      strokeColor: "#FFFFFF",
      strokeAlpha: 0.9,
      strokeWidth: 2,
      text: camera ? "CAM" : "T",
      fontSize: 16,
      textColor: "#111111",
      flags: {
        levels: { rangeBottom: bottom, rangeTop: top },
        [this.NAMESPACE]: {
          cartographer: {
            documentType,
            stableId,
            properties: { elevationBottom: bottom, elevationTop: top },
            geometry: { location: { ...location } }
          }
        }
      }
    };
  }

  static async clear(scene = canvas.scene) {
    if (!scene) return [];
    const types = new Set(Object.values(this.TYPES));
    const ids = scene.drawings.contents
      .filter(drawing => types.has(drawing.flags?.[this.NAMESPACE]?.cartographer?.documentType))
      .map(drawing => drawing.id);
    return ids.length ? scene.deleteEmbeddedDocuments("Drawing", ids) : [];
  }
}
