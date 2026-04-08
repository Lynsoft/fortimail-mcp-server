// ─── FortiMail API response & model types ────────────────────────────────────

/** Generic collection wrapper returned by many FortiMail list endpoints. */
export interface FortiMailCollection<T> {
  objectID: string;
  reqAction: number;
  totalRemoteCount?: number;
  subCount?: number;
  remoteSorting?: boolean;
  nextPage?: boolean;
  nodePermission?: number;
  nodeAccessDetails?: number;
  collection: T[];
}

// ─── Domain ──────────────────────────────────────────────────────────────────

export interface DomainListItem {
  mkey: string;
  ip: string;
  port: number;
  is_subdomain: boolean;
  maindomain?: string;
  mxflag?: number;
  is_association?: boolean;
  is_service_domain?: boolean;
  recipient_verification?: string;
  ec_status?: boolean;
  failed_time?: number;
  isReferenced?: number;
}

export interface DomainSetting {
  recipient_retention_period?: number;
  comment?: string;
  disk_quota?: number;
  mxflag?: number;
  ip?: string;
  port?: number;
  usessl?: boolean;
  is_subdomain?: boolean;
  maindomain?: string;
  fallbackhost?: string;
  fallbackport?: number;
  fallbackusessl?: boolean;
  relay_ip_group?: string;
  remove_outgoing_header?: boolean;
  alternative_domain_name?: string;
  recipient_verification?: number;
  max_message_size?: number;
  dkim_signing_option?: number;
  arc_sealing_option?: number;
  ec_status?: boolean;
  [key: string]: unknown;
}

// ─── Domain Info ─────────────────────────────────────────────────────────────

export interface DomainInfo {
  customer_name?: string;
  customer_email?: string;
  account_limit?: number;
  comment?: string;
}

// ─── User Mail ───────────────────────────────────────────────────────────────

export interface UserMail {
  mkey: string;
  status?: boolean;
  type?: number;
  displayname?: string;
  ldapprofile?: string;
  radius_profile?: string;
  password?: string;
}

// ─── User Map ────────────────────────────────────────────────────────────────

export interface UserMap {
  mkey: string;
  external_name?: string;
}

// ─── Profiles ────────────────────────────────────────────────────────────────

export interface ProfGeoip {
  mkey: string;
  comment?: string;
  country?: string;
}

export interface ProfNotification {
  mkey: string;
  type?: number;
  email_template?: string;
  comment?: string;
  recipient_options?: number;
  other?: string;
  attach_orignal_message?: boolean;
}

export interface ProfAuthImap {
  mkey: string;
  server?: string;
  port?: number;
  auth_type?: number;
  comment?: string;
  option?: number;
}

export interface ProfAuthSmtp {
  mkey: string;
  server?: string;
  port?: number;
  auth_type?: number;
  comment?: string;
  smtpauth_try_mhost?: boolean;
  option?: number;
}

// ─── SMTP Configuration ─────────────────────────────────────────────────────

export interface MailSetSmtp {
  proxy_original?: boolean;
}

// ─── Mail Queue ──────────────────────────────────────────────────────────────

export interface MailQueueItem {
  mkey: string;
  status?: number;
  envfrom: string;
  envto: string;
  subject: string;
  reason: string;
  firstprocess: string;
  lastprocess: string;
  rec_date: string;
  tries: number;
  type: number;
  cli_ip: string;
  client_cc: string;
  client_location: string;
  folder?: string;
}

export interface QueueMailView {
  from: string;
  subject: string;
  received: number;
  date: string;
  size: number;
  to: string;
  outbox_message_id?: string;
  remain_time: number;
  reply_to: string;
  cc: string;
  message_id: string;
  readables: Array<{ content: string }>;
}

// ─── Log File ────────────────────────────────────────────────────────────────

export interface LogFile {
  mkey: string;
  start?: string;
  end?: string;
  size?: number;
  logForm?: number;
}

// ─── Report ──────────────────────────────────────────────────────────────────

export interface ReportFile {
  mkey: string;
  log_report_dir?: string;
  last_access_time?: number;
  size?: number;
}
