'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch('/api/password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
    } finally {
      setLoading(false);
      setSubmitted(true);
    }
  };

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0a0a0a', fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" }}>
      <div style={{ width: '100%', maxWidth: '380px', padding: '0 16px' }}>
        <div style={{ backgroundColor: '#111111', border: '1px solid #222222', borderRadius: '12px', padding: '32px' }}>
          <h1 style={{ margin: '0 0 8px', color: '#f8fafc', fontSize: '20px', fontWeight: 600 }}>
            Reset password
          </h1>

          {submitted ? (
            <p style={{ margin: '16px 0 0', color: '#a1a1aa', fontSize: '14px', lineHeight: 1.6 }}>
              If that email is registered, we sent a reset link. Check your inbox.
            </p>
          ) : (
            <>
              <p style={{ margin: '0 0 24px', color: '#a1a1aa', fontSize: '14px' }}>
                Enter your email and we&apos;ll send a reset link.
              </p>
              <form onSubmit={handleSubmit}>
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', color: '#f8fafc', fontSize: '14px', outline: 'none' }}
                />
                <button
                  type="submit"
                  disabled={loading}
                  style={{ marginTop: '12px', width: '100%', padding: '11px', backgroundColor: '#f8fafc', color: '#0a0a0a', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
                >
                  {loading ? 'Sending…' : 'Send reset link'}
                </button>
              </form>
            </>
          )}

          <p style={{ margin: '20px 0 0', textAlign: 'center', fontSize: '13px', color: '#71717a' }}>
            <Link href="/" style={{ color: '#a1a1aa', textDecoration: 'none' }}>
              ← Back to login
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
