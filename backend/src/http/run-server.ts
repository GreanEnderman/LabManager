import { loadEnvFile } from '../services/env-loader'
import { startAIHttpServer } from './server'

loadEnvFile()

const port = Number(process.env.PORT ?? '8787')

startAIHttpServer(port)
