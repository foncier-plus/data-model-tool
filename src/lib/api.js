const BASE = '/api/objects'

async function request(path, options = {}) {
  const response = await fetch(path, options)
  const text = await response.text()
  const data = text ? JSON.parse(text) : {}
  if (!response.ok) {
    const error = new Error(data.error ?? response.statusText)
    error.status = response.status
    error.data = data
    throw error
  }
  return data
}

const jsonOptions = (method, body) => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

export const api = {
  list: () => request(BASE),
  read: (name) => request(`${BASE}/${encodeURIComponent(name)}`),
  create: (name, content) => request(BASE, jsonOptions('POST', { name, content })),
  createNamespace: (name) => request(`${BASE}/namespaces`, jsonOptions('POST', { name })),
  write: (name, content, baseHash) =>
    request(`${BASE}/${encodeURIComponent(name)}`, jsonOptions('PUT', { content, baseHash })),
  remove: (name, baseHash) =>
    request(`${BASE}/${encodeURIComponent(name)}?baseHash=${encodeURIComponent(baseHash ?? '')}`, {
      method: 'DELETE',
    }),
  rename: (name, to, content) =>
    request(
      `${BASE}/${encodeURIComponent(name)}/rename`,
      jsonOptions('POST', { to, content }),
    ),
}
