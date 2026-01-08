export type VcpLifecycleStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "bootstrapping"
  | "ready"
  | "error"
  | "stopped";
export type SupportedOcppVersion = "OCPP_1_6" | "OCPP_2_0_1" | "OCPP_2_1";
export declare const SUPPORTED_OCPP_VERSIONS: SupportedOcppVersion[];
export declare const SUPPORTED_OCPP_VERSION_LABELS: Record<
  SupportedOcppVersion,
  string
>;
export declare const SUPPORTED_OCPP_VERSION_NAMES: string[];
export declare const SUPPORTED_OCPP_VERSION_TEXT: string;
export declare const normalizeOcppVersion: (
  version?: string
) => SupportedOcppVersion | undefined;
export declare const OCPP16_STATUS_VALUES: readonly [
  "Available",
  "Preparing",
  "Charging",
  "SuspendedEVSE",
  "SuspendedEV",
  "Finishing",
  "Reserved",
  "Unavailable",
  "Faulted"
];
export type Ocpp16Status = (typeof OCPP16_STATUS_VALUES)[number];
export declare const OCPP16_ERROR_CODES: readonly [
  "ConnectorLockFailure",
  "EVCommunicationError",
  "GroundFailure",
  "HighTemperature",
  "InternalError",
  "LocalListConflict",
  "NoError",
  "OtherError",
  "OverCurrentFailure",
  "OverVoltage",
  "PowerMeterFailure",
  "PowerSwitchFailure",
  "ReaderFailure",
  "ResetFailure",
  "UnderVoltage",
  "WeakSignal"
];
export type Ocpp16ErrorCode = (typeof OCPP16_ERROR_CODES)[number];
export interface VcpSnapshot {
  id: string;
  ocppVersion: SupportedOcppVersion | string;
  endpoint: string;
  metadata: Record<string, unknown>;
  status: VcpLifecycleStatus;
  autoBoot?: {
    enabled?: boolean;
    chargePointVendor?: string;
    chargePointModel?: string;
    firmwareVersion?: string;
    connectorsPerChargePoint?: number;
    connectors?: number[];
  };
  createdAt: string;
  lastConnectedAt?: string;
  lastBootAcceptedAt?: string;
  error?: string;
  chargePointSerialNumber?: string;
}
export interface StartTransactionFormInput {
  connectorId: number;
  idTag: string;
  meterStart: number;
  timestamp?: string;
  reservationId?: number | null;
}
export interface StatusNotificationFormInput {
  connectorId: number;
  status: Ocpp16Status;
  errorCode: Ocpp16ErrorCode;
  timestamp?: string;
  info?: string;
  vendorId?: string;
  vendorErrorCode?: string;
}
