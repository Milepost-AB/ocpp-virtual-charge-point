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
import { startTransaction } from "../api";
import {
  SUPPORTED_OCPP_VERSION_LABELS,
  SUPPORTED_OCPP_VERSION_TEXT,
  SUPPORTED_OCPP_VERSIONS,
  normalizeOcppVersion,
  type VcpSnapshot,
} from "../types";

interface StartTransactionDialogProps {
  vcp: VcpSnapshot;
  onSuccess: () => void;
}

const formSchema = z.object({
  connectorId: z.coerce.number().int().positive(),
  idTag: z.string().min(1, "Token (idTag) is required"),
  meterStart: z.coerce.number().int(),
  reservationId: z.coerce.number().int().optional(),
  timestamp: z
    .string()
    .datetime({ message: "Timestamp must be ISO 8601" })
    .optional(),
});

type FormState = z.infer<typeof formSchema>;

const defaultState = (): FormState => ({
  connectorId: 1,
  idTag: "",
  meterStart: 0,
  reservationId: undefined,
  timestamp: new Date().toISOString(),
});

export const StartTransactionDialog = ({
  vcp,
  onSuccess,
}: StartTransactionDialogProps) => {
  const [open, setOpen] = useState(false);
  const [formState, setFormState] = useState<FormState>(defaultState);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setFormState(defaultState());
      setError(null);
      setSuccess(null);
    }
  }, [open]);

  const reservationValue =
    formState.reservationId !== undefined
      ? String(formState.reservationId)
      : "";

  const normalizedVersion = normalizeOcppVersion(vcp.ocppVersion);
  const versionLabel = normalizedVersion
    ? SUPPORTED_OCPP_VERSION_LABELS[normalizedVersion]
    : vcp.ocppVersion;

  const disabledReason = useMemo(() => {
    if (
      !normalizedVersion ||
      !SUPPORTED_OCPP_VERSIONS.includes(normalizedVersion)
    ) {
      return `StartTransaction UI currently supports ${SUPPORTED_OCPP_VERSION_TEXT} (this VCP is ${versionLabel}).`;
    }
    return null;
  }, [normalizedVersion, versionLabel]);

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

    const result = formSchema.safeParse(formState);
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Invalid form input");
      return;
    }

    setSubmitting(true);
    try {
      await startTransaction({
        vcp,
        form: {
          connectorId: result.data.connectorId,
          idTag: result.data.idTag,
          meterStart: result.data.meterStart,
          reservationId: result.data.reservationId ?? undefined,
          timestamp: result.data.timestamp ?? new Date().toISOString(),
        },
      });
      setSuccess("StartTransaction request queued");
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
        <Button variant="secondary" /*disabled={Boolean(disabledReason)}*/>
          Start Transaction
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start Transaction</DialogTitle>
          <DialogDescription>
            Send a StartTransaction request to "{vcp.id}".
          </DialogDescription>
        </DialogHeader>
        {disabledReason ? (
          <Alert variant="warning">
            {disabledReason} Please initiate via the Admin API for other versions.
          </Alert>
        ) : null}
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="connectorId">Connector ID</Label>
              <Input
                id="connectorId"
                type="number"
                min={1}
                value={formState.connectorId}
                onChange={(event) =>
                  handleChange("connectorId", Number(event.target.value))
                }
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="meterStart">Meter Start (Wh)</Label>
              <Input
                id="meterStart"
                type="number"
                value={formState.meterStart}
                onChange={(event) =>
                  handleChange("meterStart", Number(event.target.value))
                }
                required
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="idTag">Token / idTag</Label>
            <Input
              id="idTag"
              value={formState.idTag}
              onChange={(event) => handleChange("idTag", event.target.value)}
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="timestamp">Timestamp</Label>
              <Input
                id="timestamp"
                type="text"
                value={formState.timestamp}
                onChange={(event) => handleChange("timestamp", event.target.value)}
                placeholder="ISO 8601"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reservationId">Reservation ID (optional)</Label>
              <Input
                id="reservationId"
                type="number"
                value={reservationValue}
                onChange={(event) => {
                  const value = event.target.value;
                  handleChange("reservationId", value === "" ? undefined : Number(value));
                }}
                placeholder="e.g. 42"
              />
            </div>
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
            <Button type="submit" disabled={Boolean(disabledReason) || submitting}>
              {submitting ? "Sending..." : "Queue Request"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

