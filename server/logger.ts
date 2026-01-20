import fs from 'fs';
import path from 'path';

const logDir = process.env.LOG_DIR || './logs';
const logFileName = process.env.LOG_FILE || 'server.jsonl';
const maxBytes = Number(process.env.LOG_MAX_BYTES || 5_000_000);
const metricsWindowSec = Number(process.env.METRICS_WINDOW_SEC || 60);

let initialized = false;
let metricsTimer: NodeJS.Timeout | null = null;
const metrics = new Map<string, { name: string; tags: Record<string, string | number | boolean>; count: number }>();

function ensureLogDir(): void {
  if (initialized) return;
  fs.mkdirSync(logDir, { recursive: true });
  initialized = true;
}

function getLogPath(): string {
  return path.join(logDir, logFileName);
}

function rotateIfNeeded(filePath: string): void {
  try {
    const stats = fs.statSync(filePath);
    if (stats.size < maxBytes) return;
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const rotated = `${filePath}.${ts}`;
    fs.renameSync(filePath, rotated);
  } catch (error) {
    // ignore missing file
  }
}

function ensureMetricsTimer(): void {
  if (metricsTimer) return;
  metricsTimer = setInterval(() => flushMetrics(), metricsWindowSec * 1000);
  metricsTimer.unref?.();
}

function buildMetricKey(name: string, tags: Record<string, string | number | boolean>): string {
  const keys = Object.keys(tags).sort();
  const parts = keys.map(key => `${key}:${tags[key]}`);
  return `${name}|${parts.join(',')}`;
}

export function incrementMetric(
  name: string,
  tags: Record<string, string | number | boolean> = {},
  value: number = 1
): void {
  ensureMetricsTimer();
  const key = buildMetricKey(name, tags);
  const entry = metrics.get(key) || { name, tags, count: 0 };
  entry.count += value;
  metrics.set(key, entry);
}

export function flushMetrics(): void {
  if (metrics.size === 0) return;
  const entries = Array.from(metrics.values());
  metrics.clear();
  for (const entry of entries) {
    logEvent('metric', {
      metric: entry.name,
      value: entry.count,
      tags: entry.tags,
      windowSec: metricsWindowSec
    });
  }
}

export function logEvent(event: string, data: Record<string, unknown> = {}): void {
  const entry = {
    ts: new Date().toISOString(),
    pid: process.pid,
    uptimeMs: Math.round(process.uptime() * 1000),
    event,
    ...data
  };

  if (process.env.LOG_TO_FILE !== '1') {
    return;
  }

  try {
    ensureLogDir();
    const filePath = getLogPath();
    rotateIfNeeded(filePath);
    fs.appendFileSync(filePath, `${JSON.stringify(entry)}\n`, 'utf8');
  } catch (error) {
    // ignore file logging failures
  }
}
