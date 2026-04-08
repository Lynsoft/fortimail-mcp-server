// ─── FortiMail MCP Server Constants ──────────────────────────────────────────

/** Maximum characters in a single tool response before truncation. */
export const CHARACTER_LIMIT = 25_000;

/** Default pagination page size. */
export const DEFAULT_PAGE_SIZE = 50;

/** API request timeout in milliseconds. */
export const REQUEST_TIMEOUT_MS = 30_000;

/** Maximum retries on transient failures. */
export const MAX_RETRIES = 3;

/** Base delay (ms) for exponential backoff between retries. */
export const RETRY_BASE_DELAY_MS = 1_000;

// ─── Cache TTLs (seconds) ────────────────────────────────────────────────────

export const CACHE_TTL = {
  /** Domain list / domain settings – relatively stable. */
  DOMAIN: 300,
  /** User lists, user maps. */
  USER: 120,
  /** Profiles (GeoIP, auth, notification). */
  PROFILE: 300,
  /** Mail queue snapshots – stale quickly. */
  MAIL_QUEUE: 15,
  /** Reports / log file lists. */
  REPORT: 60,
  /** SMTP configuration. */
  SMTP_CONFIG: 300,
} as const;

// ─── Queue type enum (used across mail-queue endpoints) ──────────────────────

export const QUEUE_TYPES: Record<string, number> = {
  default: 0,
  incoming: 1,
  outgoing: 2,
  sdefault: 3,
  sincoming: 4,
  soutgoing: 5,
  ibe: 6,
  sibe: 7,
  fortiguard: 8,
  sandbox: 9,
  outbreak: 10,
  tqueue: 11,
  ecqueue: 12,
} as const;

export const QUEUE_TYPE_LABELS: Record<number, string> = Object.fromEntries(
  Object.entries(QUEUE_TYPES).map(([k, v]) => [v, k]),
);

// ─── Account types for viewing mail in queue ─────────────────────────────────

export const ACCOUNT_TYPES: Record<string, number> = {
  dead_mail: 4,
  deferred_queue: 5,
  incoming_queue: 6,
  outgoing_queue: 7,
  slow_deferred: 9,
  slow_incoming: 10,
  slow_outgoing: 11,
  ibe_queue: 13,
  ibe_slow: 14,
  fortiguard: 16,
  sandbox: 17,
  outbreak: 19,
  ec_queue: 23,
} as const;

// ─── Log types ───────────────────────────────────────────────────────────────

export const LOG_TYPES = [
  "alog",
  "elog",
  "vlog",
  "slog",
  "nlog",
  "klog",
  "mlog",
] as const;
export type LogType = (typeof LOG_TYPES)[number];

// ─── Report classes ──────────────────────────────────────────────────────────

export const REPORT_CLASSES = [
  "domain_mailstats",
  "mailbox_stats",
  "mail_stats",
] as const;
export type ReportClass = (typeof REPORT_CLASSES)[number];
