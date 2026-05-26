import type { AIGateway } from './aiGateway'
import { httpAiGateway } from './httpAiGateway'

export function getAiGateway(): AIGateway {
  const mode = import.meta.env.VITE_AI_GATEWAY_MODE

  // Test, staging, and production environments must use HTTP gateway only.
  // Omitting VITE_AI_GATEWAY_MODE defaults to 'http'.
  // Any other value is rejected to prevent silent fallback to mock/direct paths.
  if (mode && mode !== 'http') {
    throw new Error(
      `Live frontend AI runtime only supports VITE_AI_GATEWAY_MODE=http. Got: ${mode}. ` +
      'Test and pre-release integration must validate the HTTP backend through /api/ai.'
    )
  }

  return httpAiGateway
}
