import { MODULE_ID } from "/modules/ai-director/scripts/settings.js";

/**
 * AI Director - Spatial Anchor Rule Engine (Task 4C.1)
 * Calculates precise relative canvas coordinates for token placement 
 * relative to detected vision objects (e.g., BEHIND, SEATED_AT, FLANKING).
 */
export class SpatialAnchorEngine {

  /**
   * Spatial Relationship Offsets & Rules
   */
  static RELATIONSHIP_RULES = {
    ON_TOP: (bounds) => ({
      x: bounds.x + Math.floor(bounds.width / 2),
      y: bounds.y + Math.floor(bounds.height / 2)
    }),
    BEHIND: (bounds, gridSize = 100) => ({
      // Default offset assumes 'behind' is towards the top/north of the object
      x: bounds.x + Math.floor(bounds.width / 2),
      y: Math.max(0, bounds.y - gridSize)
    }),
    IN_FRONT: (bounds, gridSize = 100) => ({
      x: bounds.x + Math.floor(bounds.width / 2),
      y: bounds.y + bounds.height + Math.floor(gridSize / 2)
    }),
    SEATED_AT: (bounds, gridSize = 100) => ({
      x: bounds.x + Math.floor(bounds.width / 2),
      y: bounds.y + bounds.height // Positioned right at the front edge of table/chair
    }),
    FLANKING: (bounds, index = 0, gridSize = 100) => {
      // Alternate left and right side placement for multiple flanking guards
      const isLeft = index % 2 === 0;
      const sideOffset = (Math.floor(index / 2) + 1) * gridSize;
      return {
        x: isLeft ? bounds.x - sideOffset : bounds.x + bounds.width + sideOffset - gridSize,
        y: bounds.y + Math.floor(bounds.height / 2)
      };
    }
  };

  /**
   * Calculates the exact canvas coordinates for a token given a spatial directive and detected object
   * 
   * @param {Object} detectedObject - Object output from VisionParser (contains bounds)
   * @param {string} relationship - Relation keyword ("BEHIND", "ON_TOP", "SEATED_AT", "FLANKING")
   * @param {number} entityIndex - Index count if multiple entities share the anchor
   * @param {Scene} scene - Active scene context
   * @returns {{x: number, y: number}} Grid-snapped coordinate pair
   */
  static calculateAnchorCoordinates(detectedObject, relationship = "IN_FRONT", entityIndex = 0, scene = canvas.scene) {
    if (!detectedObject || !detectedObject.bounds) {
      console.warn("AI Director | SpatialAnchorEngine - Invalid detected object passed to anchor calculation.");
      return { x: 0, y: 0 };
    }

    const gridSize = scene?.grid?.size || 100;
    const relKey = relationship.toUpperCase().replace(/\s+/g, "_");
    const ruleFunc = this.RELATIONSHIP_RULES[relKey] || this.RELATIONSHIP_RULES.IN_FRONT;

    const rawCoords = ruleFunc(detectedObject.bounds, entityIndex, gridSize);

    // Snap target coordinates to grid center
    return {
      x: Math.floor(rawCoords.x / gridSize) * gridSize,
      y: Math.floor(rawCoords.y / gridSize) * gridSize
    };
  }
}