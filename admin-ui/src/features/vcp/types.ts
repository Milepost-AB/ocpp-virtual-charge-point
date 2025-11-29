export type VcpLifecycleStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "bootstrapping"
  | "ready"
  | "error"
  | "stopped";

export type SupportedOcppVersion = "OCPP_1_6" | "OCPP_2_0_1" | "OCPP_2_1";

export const SUPPORTED_OCPP_VERSIONS: SupportedOcppVersion[] = [
  "OCPP_1_6",
  "OCPP_2_0_1",
  "OCPP_2_1",
];

export const SUPPORTED_OCPP_VERSION_LABELS: Record<
  SupportedOcppVersion,
  string
> = {
  OCPP_1_6: "OCPP_1.6",
  OCPP_2_0_1: "OCPP_2.0.1",
  OCPP_2_1: "OCPP_2.1",
};

const supportedVersionSet = new Set(SUPPORTED_OCPP_VERSIONS);
export const SUPPORTED_OCPP_VERSION_NAMES = SUPPORTED_OCPP_VERSIONS.map(
  (version) => SUPPORTED_OCPP_VERSION_LABELS[version],
);
export const SUPPORTED_OCPP_VERSION_TEXT =
  SUPPORTED_OCPP_VERSION_NAMES.join(", ");

export const normalizeOcppVersion = (
  version?: string,
): SupportedOcppVersion | undefined => {
  if (!version) return undefined;
  const canonical = version.replace(/\./g, "_");
  if (
    supportedVersionSet.has(canonical as SupportedOcppVersion)
  ) {
    return canonical as SupportedOcppVersion;
  }
  return undefined;
};

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

