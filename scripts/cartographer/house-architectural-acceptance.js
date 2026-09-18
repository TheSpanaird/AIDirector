// house-architectural-acceptance.js
export const HOUSE_ARCHITECTURAL_ACCEPTANCE = Object.freeze({
  profileId: "HOUSE",
  entryIds: ["entry"],
  requiredAdjacencies: [
    { source: "entry", target: "living", minimumSharedBoundary: 100 },
    { source: "living", target: "dining", minimumSharedBoundary: 100 },
    { source: "dining", target: "kitchen", minimumSharedBoundary: 100 },
    { source: "kitchen", target: "pantry", minimumSharedBoundary: 100 },
    { source: "private-hall", target: "study", minimumSharedBoundary: 100 },
    { source: "private-hall", target: "bedroom-a", minimumSharedBoundary: 100 },
    { source: "private-hall", target: "bathroom", minimumSharedBoundary: 100 },
    { source: "private-hall", target: "bedroom-b", minimumSharedBoundary: 100 }
  ],
  zones: {
    PUBLIC: ["entry", "living", "dining"],
    SERVICE: ["kitchen", "pantry"],
    PRIVATE: ["private-hall", "study", "bedroom-a", "bathroom", "bedroom-b"]
  },
  maxCorridorRatio: 0.08,
  maxCorridorRectangles: 0,
  minEnvelopeUtilization: 0.95,
  maxInternalVoidRatio: 0.01,
  forbiddenPatterns: ["CENTRAL_HALL"],
  exteriorEntry: { hostId: "entry", targetId: "__exterior__" },
  privacyRooms: ["bedroom-a", "bedroom-b", "bathroom"],
  privacyAccessHub: "private-hall",
  requiredWindowRooms: ["living", "dining", "kitchen", "study", "bedroom-a", "bedroom-b"]
});
