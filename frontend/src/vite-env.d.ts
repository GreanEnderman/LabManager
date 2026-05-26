/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * AI Gateway mode - controls which backend implementation to use
   *
   * - 'http': HTTP gateway to Python backend via /api/ai (PRODUCTION ONLY)
   * - Omitting this variable defaults to 'http'
   *
   * Note: 'direct' mode exists in code but is rejected at runtime.
   * See: frontend/src/runtime/getAiGateway.ts
   */
  readonly VITE_AI_GATEWAY_MODE?: 'http'
  readonly VITE_AI_API_BASE_URL?: string
  readonly VITE_AI_HTTP_USERNAME?: string
  readonly VITE_AI_HTTP_PASSWORD?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
