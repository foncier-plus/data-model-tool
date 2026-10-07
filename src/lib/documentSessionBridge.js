// Decouples the project store from the document session store (which imports
// the store). The session module registers a reload handler here so the store
// can resolve conflicts for non-object files (project/markdown) without a
// circular import.
export const documentSessionBridge = {
  reload: null,
}
