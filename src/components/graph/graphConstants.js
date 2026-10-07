import { DependencyNode } from './DependencyNode'
import { EntityNode } from './EntityNode'
import { FlatEdge } from './FlatEdge'
import { NamespaceNode } from './NamespaceNode'

export const nodeTypes = {
  entity: EntityNode,
  namespace: NamespaceNode,
  dependency: DependencyNode,
}
export const edgeTypes = { flat: FlatEdge }

export const DEPENDENCY_WIDTH = 180
export const DEPENDENCY_HEIGHT = 36

export const GRAPH_BACKGROUND = {
  gap: 10,
  color: 'var(--graph-dot)',
  bgColor: 'var(--graph-background)',
}

// Files living in a root-level directory whose name starts with "_" are hidden
// from the data model (e.g. "_draft", "_archive").
export function isHiddenRootFile(fileName) {
  const slash = fileName.indexOf('/')
  if (slash === -1) return false
  return fileName.slice(0, slash).startsWith('_')
}
