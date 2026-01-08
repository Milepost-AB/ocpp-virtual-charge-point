import { useEffect, useMemo, useState } from "react";
import { z } from "zod";

import { Alert } from "../../../components/ui/alert";
import { Button } from "../../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { sendStatusNotification } from "../api";
import {
  OCPP16_ERROR_CODES,
  OCPP16_STATUS_VALUES,
  SUPPORTED_OCPP_VERSION_LABELS,
  normalizeOcppVersion,
  type VcpSnapshot,
} from "../types";

interface StatusNotificationDialogProps {
  vcp: VcpSnapshot;
  onSuccess: () => void;
}

type FormState = {
  connectorId: number;
  status: (typeof OCPP16_STATUS_VALUES)[number];
  errorCode: (typeof OCPP16_ERROR_CODES)[number];
  timestamp?: string;
  info: string;
  vendorId: string;
  vendorErrorCode: string;
};

const formSchema = z.object({
  connectorId: z.coerce.number().int().nonnegative(),
  status: z.enum(OCPP16_STATUS_VALUES),
  errorCode: z.enum(OCPP16_ERROR_CODES),
  timestamp: z
    .string()
    .datetime({ message: "Timestamp must be ISO 8601" })
    .optional(),
  info: z.string().max(50, "Info must be 50 characters or fewer").optional(),
  vendorId: z
    .string()
    .max(255, "Vendor ID must be 255 characters or fewer")
    .optional(),
  vendorErrorCode: z
    .string()
    .max(50, "Vendor error code must be 50 characters or fewer")
    .optional(),
});

const defaultState = (): FormState => ({
  connectorId: 0,
  status: "Available",
  errorCode: "NoError",
  timestamp: new Date().toISOString(),
  info: "",
  vendorId: "",
  vendorErrorCode: "",
});

const selectClassName =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

export const StatusNotificationDialog = ({
  vcp,
  onSuccess,
}: StatusNotificationDialogProps) => {
  const [open, setOpen] = useState(false);
  const [formState, setFormState] = useState<FormState>(defaultState);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const connectorOptions = useMemo(() => {
    const explicitConnectors =
      Array.isArray(vcp.autoBoot?.connectors) && vcp.autoBoot?.connectors.length
        ? vcp.autoBoot.connectors
        : null;

    if (explicitConnectors) {
      const unique = Array.from(new Set(explicitConnectors)).filter(
        (id) => Number.isInteger(id) && id > 0
      );
      unique.sort((a, b) => a - b);
      return [0, ...unique];
    }

    const max =
      Number.isInteger(vcp.autoBoot?.connectorsPerChargePoint) &&
      (vcp.autoBoot?.connectorsPerChargePoint ?? 0) > 0
        ? (vcp.autoBoot?.connectorsPerChargePoint as number)
        : 1;
    // include connector 0 + each physical connector
    return Array.from({ length: max + 1 }, (_v, idx) => idx);
  }, [vcp.autoBoot?.connectors, vcp.autoBoot?.connectorsPerChargePoint]);

  useEffect(() => {
    if (open) {
      setFormState(defaultState());
      setError(null);
      setSuccess(null);
    }
  }, [open]);

  const normalizedVersion = normalizeOcppVersion(vcp.ocppVersion);
  const disabledReason = useMemo(() => {
    if (normalizedVersion !== "OCPP_1_6") {
      const label = normalizedVersion
        ? SUPPORTED_OCPP_VERSION_LABELS[normalizedVersion]
        : vcp.ocppVersion;
      return `StatusNotification UI supports OCPP 1.6 (this VCP is ${label}).`;
    }
    return null;
  }, [normalizedVersion, vcp.ocppVersion]);

  const handleChange = (key: keyof FormState, value: FormState[typeof key]) => {
    setFormState((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const result = formSchema.safeParse({
      connectorId: formState.connectorId,
      status: formState.status,
      errorCode: formState.errorCode,
      timestamp: formState.timestamp,
      info: formState.info.trim() ? formState.info.trim() : undefined,
      vendorId: formState.vendorId.trim()
        ? formState.vendorId.trim()
        : undefined,
      vendorErrorCode: formState.vendorErrorCode.trim()
        ? formState.vendorErrorCode.trim()
        : undefined,
    });

    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Invalid form input");
      return;
    }

    setSubmitting(true);
    try {
      await sendStatusNotification({
        vcp,
        form: result.data,
      });
      setSuccess("StatusNotification request queued");
      onSuccess();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Status Notification</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Status Notification</DialogTitle>
          <DialogDescription>
            Send a StatusNotification from "{vcp.id}" (OCPP 1.6 only).
          </DialogDescription>
        </DialogHeader>
        {disabledReason ? (
          <Alert variant="warning">{disabledReason}</Alert>
        ) : null}
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="connectorId">Connector</Label>
              <select
                id="connectorId"
                className={selectClassName}
                value={formState.connectorId}
                onChange={(event) =>
                  handleChange("connectorId", Number(event.target.value))
                }
              >
                {connectorOptions.map((id) => (
                  <option key={id} value={id}>
                    {id === 0 ? "Central (0)" : `Connector ${id}`}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="timestamp">Timestamp</Label>
              <Input
                id="timestamp"
                type="text"
                value={formState.timestamp ?? ""}
                onChange={(event) =>
                  handleChange(
                    "timestamp",
                    event.target.value === "" ? undefined : event.target.value
                  )
                }
                placeholder="ISO 8601"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                className={selectClassName}
                value={formState.status}
                onChange={(event) =>
                  handleChange(
                    "status",
                    event.target.value as FormState["status"]
                  )
                }
              >
                {OCPP16_STATUS_VALUES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="errorCode">Error Code</Label>
              <select
                id="errorCode"
                className={selectClassName}
                value={formState.errorCode}
                onChange={(event) =>
                  handleChange(
                    "errorCode",
                    event.target.value as FormState["errorCode"]
                  )
                }
              >
                {OCPP16_ERROR_CODES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="info">Info (optional)</Label>
              <Input
                id="info"
                value={formState.info}
                onChange={(event) => handleChange("info", event.target.value)}
                placeholder="Short description"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vendorId">Vendor ID (optional)</Label>
              <Input
                id="vendorId"
                value={formState.vendorId}
                onChange={(event) =>
                  handleChange("vendorId", event.target.value)
                }
                placeholder="e.g. MyVendor"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vendorErrorCode">
              Vendor Error Code (optional)
            </Label>
            <Input
              id="vendorErrorCode"
              value={formState.vendorErrorCode}
              onChange={(event) =>
                handleChange("vendorErrorCode", event.target.value)
              }
              placeholder="e.g. E123"
            />
          </div>
          {error ? <Alert variant="danger">{error}</Alert> : null}
          {success ? <Alert variant="success">{success}</Alert> : null}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              Close
            </Button>
            <Button
              type="submit"
              disabled={Boolean(disabledReason) || submitting}
            >
              {submitting ? "Sending..." : "Send"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
