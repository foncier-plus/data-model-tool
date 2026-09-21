import {
  GAP,
  GROUP_HEADER_HEIGHT,
  HEADER_HEIGHT,
  NODE_WIDTH,
  PADDING,
  ROW_HEIGHT,
} from './constants.js'

export function objectHeight(model) {
  const rootAttributes = model.attributes?.length ?? 0
  const groups = model.groups ?? []
  const items = rootAttributes + groups.length

  let height = HEADER_HEIGHT + PADDING
  height += rootAttributes * ROW_HEIGHT
  height += Math.max(items - 1, 0) * GAP
  for (const group of groups) {
    height += GROUP_HEADER_HEIGHT + PADDING
    height += (group.attributes?.length ?? 0) * ROW_HEIGHT
  }
  height += PADDING
  return height
}

export function objectSize(model) {
  return { width: NODE_WIDTH, height: objectHeight(model) }
}
