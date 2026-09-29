export function isSupported() {
  return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function'
}

export async function pickNotebook() {
  if (!isSupported()) throw new Error('File System Access API non supportée par ce navigateur.')
  return window.showDirectoryPicker({ id: 'data-flow-notebook', mode: 'readwrite' })
}

export async function hasPermission(handle, mode = 'readwrite') {
  if (!handle?.queryPermission) return true
  return (await handle.queryPermission({ mode })) === 'granted'
}

export async function ensurePermission(handle, mode = 'readwrite', { request = false } = {}) {
  if (!handle?.queryPermission) return true
  if (await hasPermission(handle, mode)) return true
  if (!request) return false
  return (await handle.requestPermission({ mode })) === 'granted'
}

export async function handlesFromDataTransfer(dataTransfer) {
  const handles = []
  for (const item of dataTransfer?.items ?? []) {
    if (typeof item.getAsFileSystemHandle !== 'function') continue
    const handle = await item.getAsFileSystemHandle()
    if (handle) handles.push(handle)
  }
  return handles
}
