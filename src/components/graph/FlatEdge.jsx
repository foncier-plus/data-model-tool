import { BaseEdge, getBezierPath } from '@xyflow/react'

export function FlatEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  markerEnd,
  style,
}) {
  const [path] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: 0.6,
  })

  return (
    <BaseEdge
      id={id}
      path={path}
      interactionWidth={0}
      markerEnd={markerEnd}
      style={selected ? { ...style, strokeWidth: 3.5 } : style}
    />
  )
}
