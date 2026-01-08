import { apiUrl } from "../../lib/utils";
import {
  SUPPORTED_OCPP_VERSIONS,
  normalizeOcppVersion,
  type StartTransactionFormInput,
  type StatusNotificationFormInput,
  type SupportedOcppVersion,
  type VcpSnapshot,
} from "./types";

interface ApiError {
  error?: string;
  details?: unknown;
}

const handleResponse = async <T>(response: Response): Promise<T> => {
  if (response.ok) {
    if (response.status === 204) {
      return undefined as T;
    }
    return (await response.json()) as T;
  }
  let message = `Request failed (${response.status})`;
  try {
    const body = (await response.json()) as ApiError;
    if (body.error) {
      message = body.error;
    }
  } catch {
    // ignore
  }
  throw new Error(message);
};

export const fetchVcps = async (): Promise<VcpSnapshot[]> => {
  const response = await fetch(apiUrl("/vcp"));
  return handleResponse<VcpSnapshot[]>(response);
};

export const connectVcp = async (id: string): Promise<void> => {
  const response = await fetch(apiUrl(`/vcp/${id}/connect`), {
    method: "POST",
  });
  await handleResponse(response);
};

export const stopVcp = async (id: string): Promise<void> => {
  const response = await fetch(apiUrl(`/vcp/${id}/stop`), {
    method: "POST",
  });
  await handleResponse(response);
};

const generateTransactionId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `tx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

type StartAction = { action: string; payload: Record<string, unknown> };

const toStartAction = (
  ocppVersion: SupportedOcppVersion,
  form: StartTransactionFormInput,
): StartAction => {
  const timestamp = form.timestamp ?? new Date().toISOString();

  if (ocppVersion === "OCPP_1_6") {
    return {
      action: "StartTransaction",
      payload: {
        connectorId: form.connectorId,
        idTag: form.idTag,
        meterStart: form.meterStart,
        reservationId: form.reservationId ?? undefined,
        timestamp,
      },
    };
  }

  if (ocppVersion === "OCPP_2_0_1" || ocppVersion === "OCPP_2_1") {
    const transactionId = generateTransactionId();
    return {
      action: "TransactionEvent",
      payload: {
        eventType: "Started",
        timestamp,
        triggerReason: "Authorized",
        seqNo: 0,
        transactionInfo: {
          transactionId,
          remoteStartId: form.reservationId ?? undefined,
        },
        idToken: {
          idToken: form.idTag,
          type: "ISO14443",
        },
        evse: {
          id: form.connectorId,
          connectorId: form.connectorId,
        },
        meterValue: [
          {
            timestamp,
            sampledValue: [
              {
                value: form.meterStart / 1000,
                context: "Transaction.Begin",
                measurand: "Energy.Active.Import.Register",
                unitOfMeasure: {
                  unit: "kWh",
                },
              },
            ],
          },
        ],
      },
    };
  }

  throw new Error(
    `StartTransaction is not implemented for ${ocppVersion ?? "unknown version"}`,
  );
};

export const startTransaction = async (params: {
  vcp: VcpSnapshot;
  form: StartTransactionFormInput;
}): Promise<void> => {
  const normalizedVersion = normalizeOcppVersion(params.vcp.ocppVersion);
  if (!normalizedVersion) {
    throw new Error(`StartTransaction unsupported for ${params.vcp.ocppVersion}`);
  }

  if (!SUPPORTED_OCPP_VERSIONS.includes(normalizedVersion)) {
    throw new Error(`StartTransaction unsupported for ${params.vcp.ocppVersion}`);
  }

  const { action, payload } = toStartAction(normalizedVersion, params.form);

  const response = await fetch(apiUrl(`/vcp/${params.vcp.id}/action`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action,
      payload,
    }),
  });
  await handleResponse(response);
};

export const sendStatusNotification = async (params: {
  vcp: VcpSnapshot;
  form: StatusNotificationFormInput;
}): Promise<void> => {
  const normalizedVersion = normalizeOcppVersion(params.vcp.ocppVersion);
  if (normalizedVersion !== "OCPP_1_6") {
    throw new Error(
      `StatusNotification is supported for OCPP_1.6 (this VCP is ${params.vcp.ocppVersion}).`,
    );
  }

  const response = await fetch(apiUrl(`/vcp/${params.vcp.id}/action`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "StatusNotification",
      payload: {
        connectorId: params.form.connectorId,
        status: params.form.status,
        errorCode: params.form.errorCode,
        timestamp: params.form.timestamp ?? new Date().toISOString(),
        info: params.form.info || undefined,
        vendorId: params.form.vendorId || undefined,
        vendorErrorCode: params.form.vendorErrorCode || undefined,
      },
    }),
  });
  await handleResponse(response);
};

