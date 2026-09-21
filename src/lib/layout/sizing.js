import {
  EXAMPLE_HEIGHT,
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
  const examples = [...(model.attributes ?? []), ...groups.flatMap((group) => group.attributes ?? [])]
    .filter((attribute) => attribute.example).length

  let height = HEADER_HEIGHT + PADDING
  height += rootAttributes * ROW_HEIGHT
  height += Math.max(items - 1, 0) * GAP
  for (const group of groups) {
    height += GROUP_HEADER_HEIGHT + PADDING
    height += (group.attributes?.length ?? 0) * ROW_HEIGHT
  }
  height += examples * EXAMPLE_HEIGHT
  height += PADDING
  return height
}

export function objectSize(model) {
  return { width: NODE_WIDTH, height: objectHeight(model) }
}
