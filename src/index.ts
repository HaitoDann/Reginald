import { loadConfig } from './config.js';
import { initFirestore } from './firebase.js';
import { start } from './bot.js';
import { log } from './logger.js';

async function main(): Promise<void> {
  const config = loadConfig();
  initFirestore(config);
  const client = await start(config);

  const shutdown = (signal: string) => {
    log.info('Arrêt demandé', { signal });
    client.destroy();
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Filet de sécurité : on log mais on ne crash pas sur une erreur réseau isolée.
  process.on('unhandledRejection', (reason) => {
    log.error('unhandledRejection', { reason: String(reason) });
  });
  process.on('uncaughtException', (err) => {
    log.error('uncaughtException', { err: String(err) });
  });
}

main().catch((e) => {
  log.error('Démarrage impossible', { err: String(e) });
  process.exit(1);
});
