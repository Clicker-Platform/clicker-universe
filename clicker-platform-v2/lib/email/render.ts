import { render } from '@react-email/render';
import { createElement } from 'react';
import type { ReactElement } from 'react';
import { EmailContextProvider } from './email-context-provider';
import type { EmailContext } from './types';

export async function renderTemplate(
  template: ReactElement,
  context: EmailContext
): Promise<{ html: string; text: string }> {
  const wrapped = createElement(EmailContextProvider, { context, children: template });
  const [html, text] = await Promise.all([
    render(wrapped),
    render(wrapped, { plainText: true }),
  ]);
  return { html, text };
}
