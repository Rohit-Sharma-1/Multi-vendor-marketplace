import app from './app';
import { connectDatabase, disconnectDatabase } from './config/database';
import { env } from './config/env';
import { logger } from './config/logger';

async function main(): Promise<void> {
  await connectDatabase();
  const server = app.listen(env.PORT, () => logger.info({ port: env.PORT }, 'MVM API listening'));
  const shutdown = (signal: string) => {
    logger.info({ signal }, 'Shutting down');
    server.close(() => { void disconnectDatabase().then(() => process.exit(0)); });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error: unknown) => { logger.fatal({ err: error }, 'Failed to start server'); process.exit(1); });
