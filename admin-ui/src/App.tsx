import { RefreshCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Alert } from "./components/ui/alert";
import { Button } from "./components/ui/button";
import { Card } from "./components/ui/card";
import { fetchVcps } from "./features/vcp/api";
import { VcpCard } from "./features/vcp/components/VcpCard";
import type { VcpSnapshot } from "./features/vcp/types";

const POLL_INTERVAL = 5000;

const App = () => {
  const [vcps, setVcps] = useState<VcpSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      const data = await fetchVcps();
      setVcps(data);
      setLastUpdated(new Date());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!autoRefresh) return undefined;
    const interval = setInterval(() => {
      refresh();
    }, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [autoRefresh, refresh]);

  const statusSummary = useMemo(() => {
    const result = new Map<string, number>();
    vcps.forEach((vcp) => {
      result.set(vcp.status, (result.get(vcp.status) ?? 0) + 1);
    });
    return Array.from(result.entries());
  }, [vcps]);

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 p-6">
      <header className="rounded-xl border border-border bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-2xl font-bold">Virtual Charge Points</p>
            <p className="text-sm text-foreground/70">
              Monitor VCP snapshots and queue admin actions.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-foreground/70">
              <input
                id="auto-refresh"
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={autoRefresh}
                onChange={(event) => setAutoRefresh(event.target.checked)}
              />
              <label htmlFor="auto-refresh">Auto refresh</label>
            </div>
            <Button
              variant="secondary"
              icon={<RefreshCcw className="h-4 w-4" />}
              onClick={refresh}
              disabled={loading}
            >
              Refresh
            </Button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-foreground/70">
          <span>
            {loading
              ? "Loading latest data…"
              : `Loaded ${vcps.length} VCP${vcps.length === 1 ? "" : "s"}`}
          </span>
          {lastUpdated ? (
            <span>Last updated: {lastUpdated.toLocaleTimeString()}</span>
          ) : null}
          {statusSummary.map(([status, count]) => (
            <span key={status} className="rounded-full bg-muted px-3 py-1 text-xs">
              {status}: {count}
            </span>
          ))}
        </div>
      </header>

      {error ? <Alert variant="danger">{error}</Alert> : null}

      {!vcps.length && !loading ? (
        <Card className="p-6 text-center text-sm text-foreground/70">
          No VCPs registered yet. Use the admin API to create one, then refresh
          this page.
        </Card>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2">
        {vcps.map((vcp) => (
          <VcpCard key={vcp.id} vcp={vcp} onRefresh={refresh} />
        ))}
      </section>
    </main>
  );
};

export default App;

