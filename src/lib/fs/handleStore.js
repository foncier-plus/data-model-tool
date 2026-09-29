const DB_NAME = 'data-flow'
const STORE = 'handles'
const KEY = 'notebook'

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null)
      return
    }
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function transact(db, mode, run) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, mode)
    const store = transaction.objectStore(STORE)
    const request = run(store)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function saveHandle(handle) {
  const db = await openDb()
  if (!db) return
  await transact(db, 'readwrite', (store) => store.put(handle, KEY))
}

export async function loadHandle() {
  const db = await openDb()
  if (!db) return null
  try {
    return (await transact(db, 'readonly', (store) => store.get(KEY))) ?? null
  } catch {
    return null
  }
}

export async function clearHandle() {
  const db = await openDb()
  if (!db) return
  await transact(db, 'readwrite', (store) => store.delete(KEY))
}
