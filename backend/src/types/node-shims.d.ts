declare module 'node:crypto' {
  export function createHash(algorithm: string): {
    update(data: string): { digest(encoding: string): string }
  }

  export function createHmac(algorithm: string, key: string): {
    update(data: string): { digest(encoding: string): string }
  }

  export function timingSafeEqual(left: Uint8Array, right: Uint8Array): boolean
}

declare const Buffer: {
  from(input: string, encoding?: string): Uint8Array & {
    toString(encoding?: string): string
    readonly length: number
  }
}
