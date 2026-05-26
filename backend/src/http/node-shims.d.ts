declare module 'node:http' {
  export interface IncomingMessage {
    method?: string
    url?: string
    headers: Record<string, string | string[] | undefined>
    on(event: 'data', listener: (chunk: string) => void): void
    on(event: 'end', listener: () => void): void
  }

  export interface ServerResponse {
    statusCode: number
    setHeader(name: string, value: string): void
    end(chunk?: string): void
  }

  export function createServer(
    handler: (request: IncomingMessage, response: ServerResponse) => void,
  ): {
    listen(port: number, callback?: () => void): void
  }
}

declare const process: {
  env: Record<string, string | undefined>
}
