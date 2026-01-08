import { env } from './lib/env';
import { buildServer } from './server';
import { shutdownPosthog } from './lib/posthog';

const app = buildServer();

const port = Number(env.PORT || 4000);
app.listen({ port, host: '0.0.0.0' }).then(() => {
  app.log.info({ port }, 'API listening');
});

process.on('SIGINT', async () => {
  await shutdownPosthog();
  process.exit(0);
});
process.on('SIGTERM', async () => {
  await shutdownPosthog();
  process.exit(0);
});
