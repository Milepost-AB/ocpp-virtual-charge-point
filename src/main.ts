import "dotenv/config";

import { startAdminServer } from "./adminServer";
import { loadConfig } from "./config";
import { logger } from "./logger";
import { VcpManager } from "./vcpManager";

const shutdown = async (manager: VcpManager) => {
  const snapshots = manager.list();
  await Promise.all(
    snapshots.map(async (snapshot) => {
      try {
        await manager.stop(snapshot.id);
      } catch (error) {
        logger.warn(`Failed to stop VCP ${snapshot.id} during shutdown`, error);
      }
    }),
  );
};

const bootstrap = async () => {
  const config = await loadConfig();
  const manager = new VcpManager(config);
  await manager.seed();
  startAdminServer(manager, config.admin.port);

  process.on("SIGINT", async () => {
    logger.info("Received SIGINT. Shutting down gracefully...");
    await shutdown(manager);
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    logger.info("Received SIGTERM. Shutting down gracefully...");
    await shutdown(manager);
    process.exit(0);
  });
};

bootstrap().catch((error) => {
  logger.error("Virtual Charge Point failed to start", error);
  process.exit(1);
});

