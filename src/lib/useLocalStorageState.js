import { useEffect, useState } from 'react'

// Minimal persistent state backed by localStorage (JSON-encoded).
export function useLocalStorageState(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const raw = window.localStorage.getItem(key)
      return raw === null ? initialValue : JSON.parse(raw)
    } catch {
      return initialValue
    }
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // ignore (private mode / quota)
    }
  }, [key, value])

  return [value, setValue]
}
