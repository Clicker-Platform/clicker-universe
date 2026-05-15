'use client';

import * as Sentry from '@sentry/nextjs';

export default function SentryTestPage() {
  return (
    <div style={{ padding: 24, fontFamily: 'system-ui' }}>
      <h1>Sentry Test</h1>
      <button
        type="button"
        onClick={() => {
          throw new Error('Sentry test client-side error');
        }}
        style={{ padding: '8px 16px', marginRight: 8 }}
      >
        Throw client error
      </button>
      <button
        type="button"
        onClick={() => {
          Sentry.captureMessage('Sentry test manual message', 'info');
          alert('Sent message to Sentry');
        }}
        style={{ padding: '8px 16px', marginRight: 8 }}
      >
        Send manual message
      </button>
      <button
        type="button"
        onClick={async () => {
          const res = await fetch('/api/sentry-test');
          alert(`Server response: ${res.status}`);
        }}
        style={{ padding: '8px 16px' }}
      >
        Trigger server error
      </button>
    </div>
  );
}
