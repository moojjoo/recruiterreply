type TelemetrySeverity = "Warning" | "Error";

interface TelemetryEvent {
  eventName: string;
  severity: TelemetrySeverity;
  traceId?: string;
  route?: string;
  metadata?: Record<string, string>;
}

const MAX_QUEUE = 20;
const MAX_BATCH = 10;
const MAX_ATTEMPTS = 2;
const DEDUPE_WINDOW_MS = 5000;
const queue: TelemetryEvent[] = [];
const recentEvents = new Map<string, number>();
let flushTimer: number | undefined;
let reporting = false;

function apiUrl(): string {
  const configured = typeof window !== "undefined" ? window.__APP_CONFIG__?.API_BASE_URL : undefined;
  const base = configured && !configured.startsWith("__RUNTIME_")
    ? configured
    : import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || "/api";
  return `${base.replace(/\/$/, "")}/telemetry`;
}

function safeRoute(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return window.location.pathname.slice(0, 120);
}

function scheduleFlush(): void {
  if (flushTimer !== undefined || typeof window === "undefined") return;
  flushTimer = window.setTimeout(() => {
    flushTimer = undefined;
    void flush();
  }, 1000);
}

async function flush(): Promise<void> {
  if (reporting || queue.length === 0 || typeof fetch === "undefined") return;
  reporting = true;
  const events = queue.splice(0, MAX_BATCH);
  try {
    await Promise.all(events.map(async event => {
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
        try {
          const response = await fetch(apiUrl(), {
            method: "POST", credentials: "omit",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(event), keepalive: true,
          });
          if (response.ok || response.status < 500 || attempt === MAX_ATTEMPTS) return;
        } catch {
          if (attempt === MAX_ATTEMPTS) return;
        }
      }
    }));
  } catch {
    // Diagnostics are best-effort and must never affect the user workflow.
  } finally {
    reporting = false;
    if (queue.length > 0) scheduleFlush();
  }
}

export function reportTelemetry(event: Omit<TelemetryEvent, "route"> & { route?: string }): void {
  if (typeof window === "undefined" || queue.length >= MAX_QUEUE) return;
  if (!/^[a-zA-Z0-9_.:-]{1,80}$/.test(event.eventName)) return;
  const metadata = Object.fromEntries(Object.entries(event.metadata ?? {})
    .filter(([key, value]) => /^[a-zA-Z0-9_.:-]{1,40}$/.test(key) && /^[a-zA-Z0-9_.:-]{1,160}$/.test(value))
    .slice(0, 12));
  const normalized = { ...event, route: event.route ?? safeRoute(), metadata };
  const dedupeKey = JSON.stringify([normalized.eventName, normalized.severity, normalized.route, metadata]);
  const now = Date.now();
  for (const [key, timestamp] of recentEvents) {
    if (now - timestamp > DEDUPE_WINDOW_MS) recentEvents.delete(key);
  }
  if (recentEvents.has(dedupeKey)) return;
  recentEvents.set(dedupeKey, now);
  queue.push(normalized);
  while (queue.length > MAX_QUEUE) queue.shift();
  scheduleFlush();
}

export function createTraceparent(): string {
  if (typeof crypto === "undefined" || !crypto.getRandomValues) return "00-00000000000000000000000000000001-0000000000000001-01";
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
  return `00-${hex.slice(0, 32)}-${hex.slice(32)}-01`;
}

export function installGlobalTelemetryHandlers(): () => void {
  const onError = (event: ErrorEvent) => reportTelemetry({
    eventName: "FrontendRuntimeError", severity: "Error",
    metadata: { component: "window", errorType: event.error?.name ?? "Error" },
  });
  const onRejection = (event: PromiseRejectionEvent) => reportTelemetry({
    eventName: "UnhandledPromiseRejection", severity: "Error",
    metadata: { component: "window", errorType: event.reason?.name ?? "PromiseRejection" },
  });
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
  };
}
