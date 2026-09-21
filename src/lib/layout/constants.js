export const NODE_WIDTH = 300
export const HEADER_HEIGHT = 34
export const ROW_HEIGHT = 20
export const GROUP_HEADER_HEIGHT = 20
export const PADDING = 12
export const GAP = 4

export const NAMESPACE_PADDING = 16
export const NS_HEADER_HEIGHT = 32
export const COLLAPSED_GROUP_WIDTH = 220
export const COLLAPSED_GROUP_HEIGHT = NS_HEADER_HEIGHT

export const COLUMN_GAP = 80
export const COLLISION_GAP = 16

export const STABILITY_STRENGTH = 0.25
export const EDGE_STRENGTH = 0.06
export const DAMPING = 0.5
export const MAX_STEP = 40

export const MIN_ITERATIONS = 20
export const MAX_ITERATIONS = 80

export const SEED = 1

export const DEFAULT_WEIGHTS = {
  overlap: 1000,
  crossings: 20,
  movement: 12,
  edgeLength: 2,
  alignment: 1,
}

export const DEFAULT_OPTIONS = {
  columnGap: COLUMN_GAP,
  collisionGap: COLLISION_GAP,
  stability: STABILITY_STRENGTH,
  edgeStrength: EDGE_STRENGTH,
  damping: DAMPING,
  maxStep: MAX_STEP,
  weights: DEFAULT_WEIGHTS,
}
