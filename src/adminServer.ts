import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { existsSync } from "node:fs";
import path from "node:path";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Context } from "hono";
import type { StatusCode } from "hono/utils/http-status";
import { z } from "zod";

import {
  DEFAULT_BOOT_CONFIG,
  type BootConfig,
  type ResolvedVcpConfig,
} from "./config";
import { logger } from "./logger";
import { call } from "./messageFactory";
import { OcppVersion } from "./ocppVersion";
import { resolveOcppOutgoingMessage } from "./schemaValidator";
import { type VcpManager, type VcpUpdateInput } from "./vcpManager";

const bootPartialSchema = z.object({
  enabled: z.boolean().optional(),
  chargePointVendor: z.string().optional(),
  chargePointModel: z.string().optional(),
  firmwareVersion: z.string().optional(),
  connectorsPerChargePoint: z.number().int().positive().optional(),
});

const createVcpSchema = z.object({
  id: z.string().min(1),
  ocppVersion: z.nativeEnum(OcppVersion),
  endpoint: z.string().min(1),
  basicAuthPassword: z.string().optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
  chargePointSerialNumber: z.string().optional(),
  autoBoot: bootPartialSchema.optional(),
  autoConnect: z.boolean().optional(),
});

const updateVcpSchema = z.object({
  endpoint: z.string().optional(),
  basicAuthPassword: z.string().optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
  chargePointSerialNumber: z.string().optional(),
  autoBoot: bootPartialSchema.optional(),
});

const actionSchema = z.object({
  action: z.string().min(1),
  payload: z.record(z.unknown()).optional().default({}),
});

type CreateVcpRequest = z.infer<typeof createVcpSchema>;
type UpdateVcpRequest = z.infer<typeof updateVcpSchema>;

const toBootConfig = (
  overrides?: Partial<BootConfig>,
  fallback: BootConfig = DEFAULT_BOOT_CONFIG,
): BootConfig => ({
  enabled: overrides?.enabled ?? fallback.enabled,
  chargePointVendor:
    overrides?.chargePointVendor ?? fallback.chargePointVendor,
  chargePointModel: overrides?.chargePointModel ?? fallback.chargePointModel,
  firmwareVersion: overrides?.firmwareVersion ?? fallback.firmwareVersion,
  connectorsPerChargePoint:
    overrides?.connectorsPerChargePoint ??
    fallback.connectorsPerChargePoint,
});

const sanitizePassword = (value?: string | null): string | undefined =>
  value ?? undefined;

const respondNotFound = (id: string) => ({
  error: `VCP with id=${id} not found`,
});

const toStatusCode = (code: number): StatusCode => code as StatusCode;

const mapErrorStatus = (error: Error): StatusCode =>
  toStatusCode(error.message.includes("not found") ? 404 : 400);

const createVcpConfig = (body: CreateVcpRequest): ResolvedVcpConfig => ({
  id: body.id,
  ocppVersion: body.ocppVersion,
  endpoint: body.endpoint,
  basicAuthPassword: sanitizePassword(body.basicAuthPassword),
  metadata: (body.metadata ?? {}) as Record<string, unknown>,
  autoBoot: toBootConfig(body.autoBoot),
  chargePointSerialNumber: body.chargePointSerialNumber,
});

const createUpdatePayload = (
  body: UpdateVcpRequest,
): VcpUpdateInput => ({
  endpoint: body.endpoint,
  basicAuthPassword: sanitizePassword(body.basicAuthPassword),
  metadata: body.metadata as Record<string, unknown> | undefined,
  chargePointSerialNumber: body.chargePointSerialNumber,
  autoBoot: body.autoBoot,
});

export const createAdminApp = (manager: VcpManager): Hono => {
  const app = new Hono();

  app.use(
    "*",
    cors({
      origin: (origin) => origin ?? "*",
      allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
      exposeHeaders: ["Content-Type"],
    }),
  );

  app.onError((err, c) => {
    logger.error("Admin API error", err);
    c.status(mapErrorStatus(err));
    return c.json(
      {
        error: err.message,
      },
    );
  });

  app.get("/health", (c) => c.json({ status: "ok" }));

  app.get("/vcp", (c) => c.json(manager.list()));

  app.get("/vcp/:id", (c) => {
    const id = c.req.param("id");
    const snapshot = manager.getSnapshot(id);
    if (!snapshot) {
      c.status(toStatusCode(404));
      return c.json(respondNotFound(id));
    }
    return c.json(snapshot);
  });

  app.post(
    "/vcp",
    zValidator("json", createVcpSchema),
    async (c) => {
      const body = c.req.valid("json");
      const snapshot = await manager.create(createVcpConfig(body), {
        autoConnect: body.autoConnect,
      });
      c.status(toStatusCode(201));
      return c.json(snapshot);
    },
  );

  app.post("/vcp/:id/connect", async (c) => {
    const id = c.req.param("id");
    try {
      await manager.connectById(id);
      return c.json({ id, status: "connecting" });
    } catch (error) {
      logger.error(`Failed to connect VCP ${id}`, error);
      c.status(mapErrorStatus(error as Error));
      return c.json({ error: (error as Error).message });
    }
  });

  app.post("/vcp/:id/stop", async (c) => {
    const id = c.req.param("id");
    try {
      await manager.stop(id);
      return c.json({ id, status: "stopped" });
    } catch (error) {
      logger.error(`Failed to stop VCP ${id}`, error);
      c.status(mapErrorStatus(error as Error));
      return c.json({ error: (error as Error).message });
    }
  });

  app.patch(
    "/vcp/:id",
    zValidator("json", updateVcpSchema),
    (c) => {
      const id = c.req.param("id");
      const body = c.req.valid("json");
      const snapshot = manager.update(id, createUpdatePayload(body));
      return c.json(snapshot);
    },
  );

  app.post(
    "/vcp/:id/action",
    zValidator("json", actionSchema),
    async (c) => {
      const id = c.req.param("id");
      const config = manager.getConfig(id);
      if (!config) {
        c.status(toStatusCode(404));
        return c.json(respondNotFound(id));
      }
      const body = c.req.valid("json");
      try {
        const ocppMessage = resolveOcppOutgoingMessage(
          config.ocppVersion,
          body.action,
        );

        let payload = body.payload ?? {};
        if (ocppMessage) {
          const validationResult = ocppMessage.reqSchema.safeParse(payload);
          if (!validationResult.success) {
            c.status(toStatusCode(400));
            return c.json({
              error: "Invalid payload",
              details: validationResult.error.issues,
            });
          }
          payload = validationResult.data;
        }

        await manager.sendAction(id, call(body.action, payload));
        return c.json({ id, status: "queued" });
      } catch (error) {
        logger.error(`Failed to send action to VCP ${id}`, error);
        c.status(mapErrorStatus(error as Error));
        return c.json({ error: (error as Error).message });
      }
    },
  );

  app.delete("/vcp/:id", async (c) => {
    const id = c.req.param("id");
    try {
      await manager.remove(id);
      c.status(toStatusCode(202));
      return c.json({ id, status: "removed" });
    } catch (error) {
      logger.error(`Failed to remove VCP ${id}`, error);
      c.status(mapErrorStatus(error as Error));
      return c.json({ error: (error as Error).message });
    }
  });

  const adminUiDistPath = path.join(process.cwd(), "admin-ui", "dist");
  if (existsSync(adminUiDistPath)) {
    const staticHandler = serveStatic({
      root: adminUiDistPath,
    });
    const spaHandler = serveStatic({
      root: adminUiDistPath,
      rewriteRequestPath: () => "/index.html",
    });

    app.get("/assets/*", staticHandler);
    app.get("/favicon.ico", staticHandler);
    app.get("/", spaHandler);
    app.get("*", async (c, next) => {
      if (
        c.req.path.startsWith("/vcp") ||
        c.req.path.startsWith("/health")
      ) {
        return next();
      }
      return spaHandler(c, next);
    });
  } else {
    logger.warn(
      `Admin UI bundle not found at ${adminUiDistPath}. Run "npm run admin-ui:build" to generate it.`,
    );
  }

  return app;
};

export const startAdminServer = (manager: VcpManager, port: number): void => {
  const app = createAdminApp(manager);
  serve({
    fetch: app.fetch,
    port,
  });
  logger.info(`Admin API listening on port ${port}`);
};

