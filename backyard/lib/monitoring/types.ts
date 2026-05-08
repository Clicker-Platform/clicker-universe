export interface PosthogActivityRow {
  event: string;
  url: string | null;
  count: number;
  lastSeenAt: string | null;
}

export interface PosthogStats {
  health: {
    reachable: boolean;
    totalEvents24h: number;
    lastEventAt: string | null;
    errorCode?: 'auth' | 'rate_limit' | 'network' | 'unknown';
    errorMessage?: string;
    retryAfterSec?: number;
  };
  perActivity: PosthogActivityRow[];
}

export interface ResendTenantRow {
  siteId: string;
  siteName: string | null;
  sent24h: number;
  failed24h: number;
  failRate: number;
  lastSentAt: string | null;
}

export interface EmailFailure {
  logId: string;
  siteId: string;
  siteName: string | null;
  to: string[];
  cc: string[] | null;
  bcc: string[] | null;
  subject: string;
  fromName: string;
  fromAddress: string;
  templateAlias: string;
  error: string | null;
  errorCode: string | null;
  resendId: string | null;
  tags: { name: string; value: string }[];
  createdAt: string;
  sentAt: string | null;
}

export interface ResendStats {
  summary: {
    sent24h: number;
    failed24h: number;
    failRate: number;
  };
  perTenant: ResendTenantRow[];
  recentFailures: EmailFailure[];
  recentAll: EmailFailure[];
}

export type StatsWindow = '1h' | '24h' | '7d';
