export interface SendEmailInput {
  to: string;
  templateAlias: string;
  variables: Record<string, string>;
  registrationId?: string;
}

export type SendEmailResult =
  | { ok: true; resendId: string }
  | { ok: false; error: string };

export interface ResendApiResponse {
  id?: string;
  message?: string;
  name?: string;
  statusCode?: number;
}
