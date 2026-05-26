import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

function enforceHttpGateway(): Plugin {
  return {
    name: 'enforce-http-gateway',
    apply: 'build',
    enforce: 'pre',
    config(config, { mode }) {
      const gatewayMode = process.env.VITE_AI_GATEWAY_MODE

      // Production and staging must use HTTP gateway
      if (mode === 'production' || mode === 'staging') {
        if (gatewayMode && gatewayMode !== 'http') {
          throw new Error(
            `[Build Error] ${mode} builds must use VITE_AI_GATEWAY_MODE=http.\n` +
            `Got: ${gatewayMode}\n` +
            `This enforces M-02 rule: TS backend freeze during migration.`
          )
        }
      }

      console.log(`[Gateway] Mode: ${mode}, Gateway: ${gatewayMode || 'http (default)'}`)
    }
  }
}

export default defineConfig({
  plugins: [react(), enforceHttpGateway()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Redirect all backend imports to the bridge file
      '../../../backend/src/contracts/shared': path.resolve(__dirname, './src/backend-bridge.ts'),
      '../../../backend/src/domain/approval-state-machine': path.resolve(__dirname, './src/backend-bridge.ts'),
      '../../../backend/src/domain/task-state-machine': path.resolve(__dirname, './src/backend-bridge.ts'),
      '../../../backend/src/domain/authz': path.resolve(__dirname, './src/backend-bridge.ts'),
      '../../../backend/src/domain/types': path.resolve(__dirname, './src/backend-bridge.ts'),
      '../../../backend/src': path.resolve(__dirname, './src/backend-bridge.ts'),
    },
  },
  server: {
    port: 3000,
    open: true,
    fs: {
      allow: [path.resolve(__dirname, '..')],
    },
  },
})
