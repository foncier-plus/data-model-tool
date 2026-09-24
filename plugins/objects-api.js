import { ObjectsError, createObjectsRepository, resolveObjectsDir } from '../server/objects.js'

const PREFIX = '/api/objects'
const BODY_LIMIT = 5 * 1024 * 1024

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > BODY_LIMIT) {
        reject(new ObjectsError(413, 'Request body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(raw))
      } catch {
        reject(new ObjectsError(400, 'Invalid JSON body'))
      }
    })
    req.on('error', reject)
  })
}

function send(res, status, payload) {
  const body = JSON.stringify(payload)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(body)
}

export function createObjectsMiddleware({ root, objectsDir }) {
  const repository = createObjectsRepository(objectsDir ?? resolveObjectsDir(root))

  return async function objectsMiddleware(req, res, next) {
    const url = new URL(req.url, 'http://localhost')
    if (url.pathname !== PREFIX && !url.pathname.startsWith(`${PREFIX}/`)) {
      next()
      return
    }

    const rawName = url.pathname.slice(PREFIX.length).replace(/^\//, '')
    let name = rawName ? decodeURIComponent(rawName) : null
    let action = null
    if (name && name.endsWith('/rename')) {
      action = 'rename'
      name = name.slice(0, -'/rename'.length)
    }
    const method = req.method ?? 'GET'

    try {
      if (name && action === 'rename') {
        if (method !== 'POST') {
          throw new ObjectsError(405, `Method not allowed: ${method}`)
        }
        const body = await readJsonBody(req)
        send(res, 200, await repository.rename(name, body.to, body.content ?? ''))
        return
      }

      if (name === 'namespaces') {
        if (method !== 'POST') {
          throw new ObjectsError(405, `Method not allowed: ${method}`)
        }
        const body = await readJsonBody(req)
        send(res, 201, await repository.createNamespace(body.name))
        return
      }

      if (!name) {
        if (method === 'GET') {
          send(res, 200, await repository.list())
          return
        }
        if (method === 'POST') {
          const body = await readJsonBody(req)
          const created = await repository.create(body.name, body.content ?? '')
          send(res, 201, created)
          return
        }
        throw new ObjectsError(405, `Method not allowed: ${method}`)
      }

      if (method === 'GET') {
        send(res, 200, await repository.read(name))
        return
      }
      if (method === 'PUT') {
        const body = await readJsonBody(req)
        send(res, 200, await repository.write(name, body.content ?? '', body.baseHash))
        return
      }
      if (method === 'DELETE') {
        await repository.remove(name, url.searchParams.get('baseHash') ?? undefined)
        send(res, 200, { deleted: name })
        return
      }
      throw new ObjectsError(405, `Method not allowed: ${method}`)
    } catch (error) {
      if (error instanceof ObjectsError) {
        send(res, error.status, { error: error.message, ...error.details })
        return
      }
      send(res, 500, { error: error.message })
    }
  }
}

export function objectsApiPlugin(options = {}) {
  return {
    name: 'data-flow:objects-api',
    configureServer(server) {
      const middleware = createObjectsMiddleware({ root: server.config.root, ...options })
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      const middleware = createObjectsMiddleware({ root: server.config.root, ...options })
      server.middlewares.use(middleware)
    },
  }
}
