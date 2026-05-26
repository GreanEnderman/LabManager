import { createAIApplicationServices, type AIApplicationServices } from '../services/api-factory'
import { createAIHttpRouter, type HttpRequestLike } from './router'

function parseQuery(url: string) {
  const parsed = new URL(url, 'http://localhost')
  const query: Record<string, string | undefined> = {}

  parsed.searchParams.forEach((value, key) => {
    query[key] = value
  })

  return {
    path: parsed.pathname,
    query,
  }
}

export function createAIHttpHandler(services: AIApplicationServices = createAIApplicationServices()) {
  const router = createAIHttpRouter(services)

  return {
    async handle(request: Omit<HttpRequestLike, 'path' | 'query'> & { url: string }) {
      const parsed = parseQuery(request.url)
      return await router.handle({
        method: request.method,
        path: parsed.path,
        query: parsed.query,
        body: request.body,
        headers: request.headers,
      })
    },
  }
}
