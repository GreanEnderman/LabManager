import { loadAppConfig } from './app-config'
import { createAIApplicationServices } from './api-factory'
import { StubEmailSender } from './email-sender'
import { InMemoryAIRepository } from './repositories'
import { PostgresSnapshotStore } from './postgres-snapshot-store'
import { SMTPEmailSender } from './smtp-email-sender'
import { createInMemoryAIDataStore } from './store'

export async function createAIHttpApplicationServices() {
  const config = loadAppConfig()
  const store = createInMemoryAIDataStore()
  const repository = new InMemoryAIRepository(store)
  const emailSender = config.smtp.enabled ? new SMTPEmailSender(config.smtp) : new StubEmailSender()
  const services = createAIApplicationServices({
    config,
    repository,
    emailSender,
  })

  if (config.storageDriver !== 'postgres') {
    return services
  }

  const snapshotStore = new PostgresSnapshotStore(config.databaseUrl)

  return {
    ...services,
    initialize: async () => {
      await snapshotStore.initialize()
      await snapshotStore.hydrate(store)
    },
    flushPersistence: async () => {
      await snapshotStore.persist(store)
    },
  }
}
