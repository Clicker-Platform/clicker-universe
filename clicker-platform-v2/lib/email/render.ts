import { render } from '@react-email/render';
import type { ReactElement } from 'react';

export async function renderTemplate(
  template: ReactElement
): Promise<{ html: string; text: string }> {
  const [html, text] = await Promise.all([
    render(template),
    render(template, { plainText: true }),
  ]);
  return { html, text };
}
