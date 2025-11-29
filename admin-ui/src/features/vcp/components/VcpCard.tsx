import { useMemo, useState, type ReactNode } from "react";
import { Activity, AlertTriangle, Link2, Power, RefreshCcw } from "lucide-react";

import { Alert } from "../../../components/ui/alert";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "../../../components/ui/card";
import { formatDateTime } from "../../../lib/utils";
import { connectVcp, stopVcp } from "../api";
import type { VcpLifecycleStatus, VcpSnapshot } from "../types";
import { StartTransactionDialog } from "./StartTransactionDialog";

interface VcpCardProps {
  vcp: VcpSnapshot;
  onRefresh: () => void;
}

type ActionState = "idle" | "connecting" | "stopping";

const statusStyles: Record<
  VcpLifecycleStatus,
  { backgroundColor: string; color: string }
> = {
  idle: { backgroundColor: "#E0E7FF", color: "#111" },
  connecting: { backgroundColor: "#FDE68A", color: "#111" },
  connected: { backgroundColor: "#BBF7D0", color: "#111" },
  bootstrapping: { backgroundColor: "#DDD6FE", color: "#111" },
  ready: { backgroundColor: "#A7F3D0", color: "#111" },
  error: { backgroundColor: "#FCA5A5", color: "#111" },
  stopped: { backgroundColor: "#E5E7EB", color: "#111" },
};

const StatusBadge = ({ status }: { status: VcpLifecycleStatus }) => (
  <Badge
    className="capitalize"
    style={statusStyles[status]}
    variant="neutral"
  >
    {status}
  </Badge>
);

export const VcpCard = ({ vcp, onRefresh }: VcpCardProps) => {
  const [actionState, setActionState] = useState<ActionState>("idle");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string }>();

  const metadataList = useMemo(
    () =>
      Object.entries(vcp.metadata ?? {}).map(([key, value]) => ({
        key,
        value: typeof value === "object" ? JSON.stringify(value) : String(value),
      })),
    [vcp.metadata],
  );

  const triggerAction = async (type: ActionState) => {
    try {
      setActionState(type);
      setFeedback(undefined);
      if (type === "connecting") {
        await connectVcp(vcp.id);
        setFeedback({ type: "success", message: "Connect requested" });
      } else if (type === "stopping") {
        await stopVcp(vcp.id);
        setFeedback({ type: "success", message: "Stop requested" });
      }
      onRefresh();
    } catch (error) {
      setFeedback({
        type: "error",
        message: (error as Error).message ?? "Request failed",
      });
    } finally {
      setActionState("idle");
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-lg font-semibold">{vcp.id}</p>
            <p className="text-sm text-foreground/70">{vcp.ocppVersion}</p>
          </div>
          <StatusBadge status={vcp.status} />
        </div>
        {vcp.error ? (
          <Alert variant="danger" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            <span>{vcp.error}</span>
          </Alert>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <InfoRow label="Endpoint" icon={<Link2 className="h-4 w-4" />}>
            {vcp.endpoint}
          </InfoRow>
          <InfoRow label="Serial">
            {vcp.chargePointSerialNumber ?? "—"}
          </InfoRow>
          <InfoRow label="Created">{formatDateTime(vcp.createdAt)}</InfoRow>
          <InfoRow label="Last connected">
            {formatDateTime(vcp.lastConnectedAt)}
          </InfoRow>
          <InfoRow label="Boot accepted">
            {formatDateTime(vcp.lastBootAcceptedAt)}
          </InfoRow>
        </div>

        {metadataList.length ? (
          <div>
            <p className="mb-1 text-sm font-semibold text-foreground/80">
              Metadata
            </p>
            <dl className="grid gap-1 text-sm text-foreground/80">
              {metadataList.map(({ key, value }) => (
                <div key={key} className="flex justify-between gap-2">
                  <dt className="font-medium">{key}</dt>
                  <dd className="text-right">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}

        {feedback ? (
          <Alert variant={feedback.type === "error" ? "danger" : "success"}>
            {feedback.message}
          </Alert>
        ) : null}
      </CardContent>
      <CardFooter className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={actionState !== "idle"}
            onClick={() => triggerAction("connecting")}
            icon={<Power className="h-4 w-4" />}
          >
            Connect
          </Button>
          <Button
            variant="outline"
            disabled={actionState !== "idle"}
            onClick={() => triggerAction("stopping")}
            icon={<Activity className="h-4 w-4" />}
          >
            Stop
          </Button>
          <StartTransactionDialog vcp={vcp} onSuccess={onRefresh} />
        </div>
        <Button
          variant="ghost"
          size="sm"
          icon={<RefreshCcw className="h-4 w-4" />}
          onClick={onRefresh}
        >
          Refresh
        </Button>
      </CardFooter>
    </Card>
  );
};

const InfoRow = ({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: ReactNode;
  children: ReactNode;
}) => (
  <div className="rounded-md border border-border/80 bg-muted/30 p-3">
    <p className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wide text-foreground/60">
      {icon}
      {label}
    </p>
    <p className="break-words text-sm text-foreground">{children}</p>
  </div>
);

