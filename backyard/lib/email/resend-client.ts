import type { ResendApiResponse } from './types';

export interface ResendCallInput {
  from: string;
  to: string;
  templateAlias: string;
  variables: Record<string, string>;
  replyTo?: string;
}

export async function callResend(input: ResendCallInput): Promise<ResendApiResponse> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY is not set');

  const body: Record<string, unknown> = {
    from: input.from,
    to: input.to,
    template_alias: input.templateAlias,
    variables: input.variables,
  };
  if (input.replyTo) body.reply_to = input.replyTo;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as ResendApiResponse;
  if (!res.ok) {
    throw new Error(data.message ?? `Resend API error: ${res.status}`);
  }
  return data;
}
