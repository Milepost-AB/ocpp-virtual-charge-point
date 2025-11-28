import { once } from "node:events";

import { bootNotificationOcppMessage as bootNotification16 } from "./v16/messages/bootNotification";
import { statusNotificationOcppMessage as statusNotification16 } from "./v16/messages/statusNotification";
import { bootNotificationOcppOutgoing as bootNotification201 } from "./v201/messages/bootNotification";
import { statusNotificationOcppOutgoing as statusNotification201 } from "./v201/messages/statusNotification";
import { bootNotificationOcppOutgoing as bootNotification21 } from "./v21/messages/bootNotification";
import { statusNotificationOcppOutgoing as statusNotification21 } from "./v21/messages/statusNotification";
import type { BootConfig, ResolvedConfig, ResolvedVcpConfig } from "./config";
import { logger } from "./logger";
import type { OcppCall } from "./ocppMessage";
import { OcppVersion } from "./ocppVersion";
import { VCP } from "./vcp";

export type VcpLifecycleStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "bootstrapping"
  | "ready"
  | "error"
  | "stopped";

export interface VcpSnapshot {
  id: string;
  ocppVersion: OcppVersion;
  endpoint: string;
  metadata: Record<string, unknown>;
  status: VcpLifecycleStatus;
  autoBoot?: BootConfig;
  createdAt: string;
  lastConnectedAt?: string;
  lastBootAcceptedAt?: string;
  error?: string;
  chargePointSerialNumber?: string;
}

interface ManagedVcpRecord {
  config: ResolvedVcpConfig;
  instance: VCP;
  status: VcpLifecycleStatus;
  createdAt: Date;
  lastConnectedAt?: Date;
  lastBootAcceptedAt?: Date;
  lastError?: string;
  listeners: Array<{
    event: string;
    handler: (...args: unknown[]) => void;
  }>;
}

export interface CreateVcpOptions {
  autoConnect?: boolean;
  autoBoot?: boolean;
}

export type VcpUpdateInput = Partial<
  Omit<ResolvedVcpConfig, "id" | "ocppVersion" | "metadata" | "autoBoot">
> & {
  metadata?: Record<string, unknown>;
  autoBoot?: Partial<BootConfig>;
};

export class VcpManager {
  private readonly vcps = new Map<string, ManagedVcpRecord>();

  constructor(private resolvedConfig: ResolvedConfig) {}

  list(): VcpSnapshot[] {
    return Array.from(this.vcps.values()).map((record) =>
      this.toSnapshot(record),
    );
  }

  getSnapshot(id: string): VcpSnapshot | undefined {
    const record = this.vcps.get(id);
    return record ? this.toSnapshot(record) : undefined;
  }

  getConfig(id: string): ResolvedVcpConfig | undefined {
    return this.vcps.get(id)?.config;
  }

  async seed(options: CreateVcpOptions = {}): Promise<void> {
    await Promise.all(
      this.resolvedConfig.vcps.map((config) =>
        this.create(config, options),
      ),
    );
  }

  async create(
    config: ResolvedVcpConfig,
    options: CreateVcpOptions = {},
  ): Promise<VcpSnapshot> {
    if (this.vcps.has(config.id)) {
      throw new Error(`VCP with id=${config.id} already exists`);
    }
    const instance = new VCP({
      endpoint: config.endpoint,
      chargePointId: config.id,
      ocppVersion: config.ocppVersion,
      basicAuthPassword: config.basicAuthPassword,
    });

    const record: ManagedVcpRecord = {
      config,
      instance,
      status: "idle",
      createdAt: new Date(),
      listeners: [],
    };

    this.attachListeners(record);
    this.vcps.set(config.id, record);
    if (!this.resolvedConfig.vcps.some((existing) => existing.id === config.id)) {
      this.resolvedConfig.vcps.push(config);
    }
    logger.info(`Registered VCP ${config.id}`);

    if (options.autoConnect ?? true) {
      await this.connect(record, options.autoBoot);
    }

    return this.toSnapshot(record);
  }

  async connectById(id: string, autoBoot?: boolean): Promise<void> {
    const record = this.requireRecord(id);
    await this.connect(record, autoBoot);
  }

  async remove(id: string): Promise<void> {
    const record = this.requireRecord(id);
    try {
      await this.stop(id);
    } catch (error) {
      logger.warn(`Failed to stop VCP ${id} before removal`, error);
    }
    this.detachListeners(record);
    this.vcps.delete(id);
    this.resolvedConfig = {
      ...this.resolvedConfig,
      vcps: this.resolvedConfig.vcps.filter((vcp) => vcp.id !== id),
    };
    logger.info(`Removed VCP ${id}`);
  }

  async stop(id: string): Promise<void> {
    const record = this.requireRecord(id);
    try {
      record.instance.close();
    } catch (error) {
      logger.warn(`Error while closing VCP ${id}`, error);
    } finally {
      this.setStatus(record, "stopped");
    }
  }

  async sendAction(id: string, ocppCall: OcppCall<unknown>): Promise<void> {
    const record = this.requireRecord(id);
    record.instance.send(ocppCall);
  }

  update(id: string, patch: VcpUpdateInput): VcpSnapshot {
    const record = this.requireRecord(id);
    if (patch.autoBoot) {
      record.config.autoBoot = {
        ...record.config.autoBoot,
        ...patch.autoBoot,
      } as BootConfig;
    }
    if (patch.metadata) {
      record.config.metadata = {
        ...record.config.metadata,
        ...patch.metadata,
      };
    }
    if (patch.endpoint) {
      record.config.endpoint = patch.endpoint;
    }
    if (patch.basicAuthPassword !== undefined) {
      record.config.basicAuthPassword = patch.basicAuthPassword;
    }
    if (patch.chargePointSerialNumber) {
      record.config.chargePointSerialNumber = patch.chargePointSerialNumber;
    }
    return this.toSnapshot(record);
  }

  private async connect(
    record: ManagedVcpRecord,
    autoBoot?: boolean,
  ): Promise<void> {
    if (record.status === "connecting" || record.status === "bootstrapping") {
      return;
    }
    try {
      this.setStatus(record, "connecting");
      await record.instance.connect();
      record.lastConnectedAt = new Date();
      this.setStatus(record, "connected");

      if (autoBoot ?? record.config.autoBoot?.enabled ?? true) {
        await this.runAutoBoot(record);
      }
    } catch (error) {
      record.lastError = (error as Error).message;
      this.setStatus(record, "error");
      throw error;
    }
  }

  private async runAutoBoot(record: ManagedVcpRecord): Promise<void> {
    const autoBoot = record.config.autoBoot;
    if (!autoBoot?.enabled) {
      this.setStatus(record, "ready");
      return;
    }

    this.setStatus(record, "bootstrapping");

    if (record.config.ocppVersion === OcppVersion.OCPP_1_6) {
      await this.autoBoot16(record, autoBoot);
      return;
    }
    if (record.config.ocppVersion === OcppVersion.OCPP_2_0_1) {
      await this.autoBoot20x(record, autoBoot);
      return;
    }
    if (record.config.ocppVersion === OcppVersion.OCPP_2_1) {
      await this.autoBoot21(record, autoBoot);
      return;
    }

    throw new Error(
      `Unsupported OCPP version ${record.config.ocppVersion} for auto-boot`,
    );
  }

  private async autoBoot16(
    record: ManagedVcpRecord,
    autoBoot: BootConfig,
  ): Promise<void> {
    const serial =
      record.config.chargePointSerialNumber ??
      `${record.config.id}-S001`;

    record.instance.send(
      bootNotification16.request({
        chargePointVendor: autoBoot.chargePointVendor,
        chargePointModel: autoBoot.chargePointModel,
        chargePointSerialNumber: serial,
        firmwareVersion: autoBoot.firmwareVersion,
      }),
    );

    await once(record.instance, "BootNotificationAccepted");
    record.lastBootAcceptedAt = new Date();

    const sendStatus = (connectorId: number) =>
      record.instance.send(
        statusNotification16.request({
          connectorId,
          errorCode: "NoError",
          status: "Available",
        }),
      );

    sendStatus(0);
    for (
      let connectorId = 1;
      connectorId <= autoBoot.connectorsPerChargePoint;
      connectorId += 1
    ) {
      sendStatus(connectorId);
    }

    this.setStatus(record, "ready");
  }

  private async autoBoot20x(
    record: ManagedVcpRecord,
    autoBoot: BootConfig,
  ): Promise<void> {
    const serial = record.config.chargePointSerialNumber ?? record.config.id;
    record.instance.send(
      bootNotification201.request({
        reason: "PowerUp",
        chargingStation: {
          serialNumber: serial,
          model: autoBoot.chargePointModel,
          vendorName: autoBoot.chargePointVendor,
          firmwareVersion: autoBoot.firmwareVersion,
        },
      }),
    );

    await once(record.instance, "BootNotificationAccepted");
    record.lastBootAcceptedAt = new Date();

    const timestamp = new Date().toISOString();
    for (
      let connector = 1;
      connector <= autoBoot.connectorsPerChargePoint;
      connector += 1
    ) {
      record.instance.send(
        statusNotification201.request({
          connectorStatus: "Available",
          evseId: connector,
          connectorId: connector,
          timestamp,
        }),
      );
    }

    this.setStatus(record, "ready");
  }

  private async autoBoot21(
    record: ManagedVcpRecord,
    autoBoot: BootConfig,
  ): Promise<void> {
    const serial = record.config.chargePointSerialNumber ?? record.config.id;
    record.instance.send(
      bootNotification21.request({
        reason: "PowerUp",
        chargingStation: {
          serialNumber: serial,
          model: autoBoot.chargePointModel,
          vendorName: autoBoot.chargePointVendor,
          firmwareVersion: autoBoot.firmwareVersion,
        },
      }),
    );

    await once(record.instance, "BootNotificationAccepted");
    record.lastBootAcceptedAt = new Date();

    const timestamp = new Date().toISOString();
    for (
      let connector = 1;
      connector <= autoBoot.connectorsPerChargePoint;
      connector += 1
    ) {
      record.instance.send(
        statusNotification21.request({
          connectorStatus: "Available",
          evseId: connector,
          connectorId: connector,
          timestamp,
        }),
      );
    }

    this.setStatus(record, "ready");
  }

  private attachListeners(record: ManagedVcpRecord) {
    const bootListener = () => {
      record.lastBootAcceptedAt = new Date();
      if (record.status !== "bootstrapping") {
        this.setStatus(record, "ready");
      }
    };
    record.instance.on("BootNotificationAccepted", bootListener);
    record.listeners.push({
      event: "BootNotificationAccepted",
      handler: bootListener,
    });
  }

  private detachListeners(record: ManagedVcpRecord) {
    for (const listener of record.listeners) {
      record.instance.off(listener.event, listener.handler);
    }
    record.listeners = [];
  }

  private requireRecord(id: string): ManagedVcpRecord {
    const record = this.vcps.get(id);
    if (!record) {
      throw new Error(`VCP with id=${id} not found`);
    }
    return record;
  }

  private toSnapshot(record: ManagedVcpRecord): VcpSnapshot {
    return {
      id: record.config.id,
      ocppVersion: record.config.ocppVersion,
      endpoint: record.config.endpoint,
      metadata: record.config.metadata,
      status: record.status,
      autoBoot: record.config.autoBoot,
      createdAt: record.createdAt.toISOString(),
      lastConnectedAt: record.lastConnectedAt?.toISOString(),
      lastBootAcceptedAt: record.lastBootAcceptedAt?.toISOString(),
      error: record.lastError,
      chargePointSerialNumber: record.config.chargePointSerialNumber,
    };
  }

  private setStatus(record: ManagedVcpRecord, status: VcpLifecycleStatus) {
    record.status = status;
    logger.info(
      `VCP ${record.config.id} status -> ${status}${
        record.lastError ? ` (${record.lastError})` : ""
      }`,
    );
  }
}

