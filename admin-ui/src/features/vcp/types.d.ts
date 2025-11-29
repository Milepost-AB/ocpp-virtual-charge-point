export type VcpLifecycleStatus = "idle" | "connecting" | "connected" | "bootstrapping" | "ready" | "error" | "stopped";
export type SupportedOcppVersion = "OCPP_1_6" | "OCPP_2_0_1" | "OCPP_2_1";
export declare const SUPPORTED_OCPP_VERSIONS: SupportedOcppVersion[];
export declare const SUPPORTED_OCPP_VERSION_LABELS: Record<SupportedOcppVersion, string>;
export declare const SUPPORTED_OCPP_VERSION_NAMES: string[];
export declare const SUPPORTED_OCPP_VERSION_TEXT: string;
export declare const normalizeOcppVersion: (version?: string) => SupportedOcppVersion | undefined;
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
