import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderTemplate } from '../render';
import { FormSubmission } from '../templates/system/FormSubmission';
import type { EmailContext } from '../types';

const ctx: EmailContext = {
  fromName: 'Acme Coffee',
  fromAddress: 'noreply@clicker.id',
  replyTo: null,
  brand: {
    businessName: 'Acme Coffee',
    logoUrl: null,
    primaryColor: null,
    siteUrl: 'https://acme.clicker.id',
  },
};

describe('renderTemplate', () => {
  it('renders FormSubmission to HTML and text', async () => {
    const out = await renderTemplate(
      createElement(FormSubmission, {
        formTitle: 'Contact form',
        data: { name: 'Jane', email: 'jane@example.com' },
      }),
      ctx
    );
    expect(out.html).toContain('<html');
    expect(out.html).toContain('Contact form');
    expect(out.html).toContain('Jane');
    expect(out.html).toContain('Acme Coffee');
    expect(out.text).toContain('Contact form');
    expect(out.text).toContain('Jane');
  });

  it('uses field labels when provided', async () => {
    const out = await renderTemplate(
      createElement(FormSubmission, {
        formTitle: 'Contact',
        data: { field_1: 'Hello' },
        fieldLabels: { field_1: 'Message' },
      }),
      ctx
    );
    expect(out.html).toContain('Message');
    expect(out.html).toContain('Hello');
  });
});
