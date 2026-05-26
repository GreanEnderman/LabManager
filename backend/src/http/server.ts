import { createServer } from 'node:http'
import { createAIHttpApplicationServices } from '../services/http-runtime'
import { createAIHttpHandler } from './adapter'

function readJsonBody(request: { on(event: 'data', listener: (chunk: string) => void): void; on(event: 'end', listener: () => void): void }) {
  return new Promise<unknown>((resolve) => {
    let raw = ''

    request.on('data', (chunk) => {
      raw += chunk ?? ''
    })

    request.on('end', () => {
      if (!raw.trim()) {
        resolve(undefined)
        return
      }

      try {
        resolve(JSON.parse(raw))
      } catch {
        resolve(undefined)
      }
    })
  })
}

export function startAIHttpServer(port = 8787) {
  const boot = createAIHttpApplicationServices()
  const server = createServer(async (request, response) => {
    const services = await boot
    const handler = createAIHttpHandler(services)
    response.setHeader('Content-Type', 'application/json; charset=utf-8')
    response.setHeader('Access-Control-Allow-Origin', '*')
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    response.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS')

    if ((request.method ?? 'GET') === 'OPTIONS') {
      response.statusCode = 204
      response.end()
      return
    }

    const result = await handler.handle({
      method: request.method ?? 'GET',
      url: request.url ?? '/api/ai/health',
      body: await readJsonBody(request),
      headers: {
        authorization: typeof request.headers.authorization === 'string' ? request.headers.authorization : undefined,
      },
    })

    response.statusCode = result.status
    response.end(JSON.stringify(result.body))
  })

  boot
    .then(async (services) => {
      await services.initialize()
      server.listen(port, () => {
        console.log(`[labmanager-backend] AI HTTP server listening on http://localhost:${port}`)
      })
    })
    .catch((error) => {
      console.error('[labmanager-backend] Failed to start AI HTTP server.', error)
    })

  return server
}
