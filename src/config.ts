import { promises as fs } from "node:fs";
import { resolve } from "node:path";

import { z } from "zod";

import { logger } from "./logger";
import { OcppVersion } from "./ocppVersion";

export const CONFIG_FILE_ENV = "VCP_CONFIG_FILE";
const DEFAULT_CONFIG_PATH = resolve(process.cwd(), "config/vcps.json");

const BOOT_CONFIG_DEFAULTS = {
  enabled: true,
  chargePointVendor: "Solidstudio",
  chargePointModel: "VirtualChargePoint",
  firmwareVersion: "1.0.0",
  connectors: [1] as number[],
} as const;

const BootConfigSchema = z.object({
  enabled: z.boolean().default(BOOT_CONFIG_DEFAULTS.enabled),
  chargePointVendor: z.string().default(BOOT_CONFIG_DEFAULTS.chargePointVendor),
  chargePointModel: z.string().default(BOOT_CONFIG_DEFAULTS.chargePointModel),
  firmwareVersion: z.string().default(BOOT_CONFIG_DEFAULTS.firmwareVersion),
  connectors: z
    .array(z.number().int().positive())
    .min(1)
    .default(BOOT_CONFIG_DEFAULTS.connectors),
});

const AdminConfigSchema = z.object({
  port: z.number().int().positive().default(9999),
});

const RawVcpConfigSchema = z.object({
  id: z.string().min(1),
  ocppVersion: z.nativeEnum(OcppVersion),
  endpoint: z.string().min(1).optional(),
  chargePointSerialNumber: z.string().min(1).optional(),
  basicAuthPassword: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  autoBoot: BootConfigSchema.optional(),
});

const RuntimeConfigSchema = z.object({
  admin: AdminConfigSchema.default({ port: 9999 }),
    defaults: z
    .object({
      endpoint: z.string().default("ws://localhost:8092"),
      basicAuthPassword: z.string().optional(),
      autoBoot: BootConfigSchema.optional(),
    })
    .default({ endpoint: "ws://localhost:8092" }),
  vcps: z.array(RawVcpConfigSchema).min(1),
});

export type BootConfig = z.infer<typeof BootConfigSchema>;
export const DEFAULT_BOOT_CONFIG: BootConfig = { ...BOOT_CONFIG_DEFAULTS };
export type AdminConfig = z.infer<typeof AdminConfigSchema>;
export type RawVcpConfig = z.infer<typeof RawVcpConfigSchema>;
export type RuntimeConfig = z.infer<typeof RuntimeConfigSchema>;

export interface ResolvedVcpConfig extends RawVcpConfig {
  endpoint: string;
  basicAuthPassword?: string;
  metadata: Record<string, unknown>;
  autoBoot?: BootConfig;
  chargePointSerialNumber?: string;
}

export interface ResolvedConfig {
  admin: AdminConfig;
  vcps: ResolvedVcpConfig[];
}

const DEFAULT_CP_IDS = ["CP-001", "CP-002", "CP-003"];

const parseIntEnv = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const parseOcppVersion = (raw?: string): OcppVersion => {
  if (!raw) {
    return OcppVersion.OCPP_1_6;
  }
  const normalized = raw.toUpperCase();
  if (normalized.includes("2.1")) {
    return OcppVersion.OCPP_2_1;
  }
  if (normalized.includes("2.0.1")) {
    return OcppVersion.OCPP_2_0_1;
  }
  return OcppVersion.OCPP_1_6;
};

const buildConfigFromEnv = (): RuntimeConfig => {
  const endpoint = process.env.WS_URL ?? "ws://localhost:8092";
  const basicAuthPassword = process.env.PASSWORD ?? undefined;
  const adminPort = parseIntEnv(
    process.env.ADMIN_PORT ?? process.env.ADMIN_WS_PORT,
    9999,
  );

  const cpIds =
    process.env.CP_IDS?.split(",")
      .map((id) => id.trim())
      .filter(Boolean) ??
    (process.env.CP_ID ? [process.env.CP_ID] : DEFAULT_CP_IDS);

  const ocppVersion = parseOcppVersion(process.env.OCPP_VERSION);
  const firmwareVersion = process.env.FIRMWARE_VERSION ?? "1.0.0";
  const chargePointVendor = process.env.CHARGE_POINT_VENDOR ?? "Solidstudio";
  const chargePointModel =
    process.env.CHARGE_POINT_MODEL ?? "VirtualChargePoint";
  const connectorsPerChargePoint = parseIntEnv(
    process.env.CONNECTORS_PER_CP,
    1,
  );
  const connectors = Array.from(
    { length: connectorsPerChargePoint },
    (_, i) => i + 1,
  );
  const autoBootDisabled =
    process.env.AUTO_BOOT_DISABLED?.toLowerCase() === "true";

  return RuntimeConfigSchema.parse({
    admin: {
      port: adminPort,
    },
    defaults: {
      endpoint,
      basicAuthPassword,
      autoBoot: {
        enabled: !autoBootDisabled,
        chargePointVendor,
        chargePointModel,
        firmwareVersion,
        connectors,
      },
    },
    vcps: cpIds.map((id, index) => ({
      id,
      ocppVersion,
      endpoint,
      basicAuthPassword,
      chargePointSerialNumber:
        process.env.CHARGE_POINT_SERIAL_NUMBER ??
        `${id}-S${String(index + 1).padStart(3, "0")}`,
      metadata: {},
    })),
  });
};

const ensureFileConfig = async (
  configPath: string,
): Promise<RuntimeConfig | null> => {
  try {
    const raw = await fs.readFile(configPath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return RuntimeConfigSchema.parse(parsed);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      logger.warn(
        `Config file not found at ${configPath}. Falling back to environment defaults.`,
      );
      return null;
    }
    logger.error(`Failed to load config at ${configPath}`, error);
    throw error;
  }
};

export const mergeBootConfig = (
  specific: BootConfig | undefined,
  defaults: BootConfig | undefined,
): BootConfig | undefined => {
  if (!specific && !defaults) {
    return undefined;
  }
  return {
    enabled: specific?.enabled ?? defaults?.enabled ?? true,
    chargePointVendor:
      specific?.chargePointVendor ??
      defaults?.chargePointVendor ??
      "Solidstudio",
    chargePointModel:
      specific?.chargePointModel ??
      defaults?.chargePointModel ??
      "VirtualChargePoint",
    firmwareVersion:
      specific?.firmwareVersion ?? defaults?.firmwareVersion ?? "1.0.0",
    connectors: specific?.connectors ?? defaults?.connectors ?? [1],
  };
};

const resolveVcpConfig = (
  raw: RawVcpConfig,
  defaults: RuntimeConfig["defaults"],
  index: number,
): ResolvedVcpConfig => {
  const autoBoot = mergeBootConfig(raw.autoBoot, defaults.autoBoot);
  return {
    ...raw,
    endpoint: raw.endpoint ?? defaults.endpoint,
    basicAuthPassword: raw.basicAuthPassword ?? defaults.basicAuthPassword,
    metadata: raw.metadata ?? {},
    autoBoot,
    chargePointSerialNumber:
      raw.chargePointSerialNumber ??
      `${raw.id}-S${String(index + 1).padStart(3, "0")}`,
  };
};

export const resolveConfigPath = (): string =>
  resolve(process.cwd(), process.env[CONFIG_FILE_ENV] ?? DEFAULT_CONFIG_PATH);

export const loadConfig = async (): Promise<ResolvedConfig> => {
  const configPath = resolveConfigPath();
  const fromFile = await ensureFileConfig(configPath);
  const runtimeConfig = fromFile ?? buildConfigFromEnv();
  return {
    admin: runtimeConfig.admin,
    vcps: runtimeConfig.vcps.map((vcp, index) =>
      resolveVcpConfig(vcp, runtimeConfig.defaults, index),
    ),
  };
};
