# Monitoring Functions — Setup

## getPosthogStats

Required environment variables (set via Secret Manager / `firebase functions:secrets:set`):

- `POSTHOG_PERSONAL_API_KEY` — PostHog Personal API Key (Settings → Personal API Keys, scope `query:read`)
- `POSTHOG_PROJECT_ID` — PostHog project ID (numeric, found in project settings)
- `POSTHOG_HOST` — optional, defaults to `https://us.i.posthog.com` (use `https://eu.i.posthog.com` for EU)

Set:

```bash
firebase functions:secrets:set POSTHOG_PERSONAL_API_KEY
firebase functions:secrets:set POSTHOG_PROJECT_ID
```

Bind the secret to the function in deploy config (or via `runWith({ secrets: [...] })` if migrating to v2 callable).

## retentionCleanup

No secrets required. Runs daily at 02:00 WIB (`Asia/Jakarta`).

Constants in `scheduled/retentionCleanup.ts`:
- `PLATFORM_LOGS_RETENTION_DAYS = 7`
- `EMAIL_LOG_RETENTION_DAYS = 30`
- `BATCH_SIZE = 500`, `MAX_BATCHES = 20` (max 10,000 docs/collection per run)

### Initial deploy: dry-run safety

Before flipping retention to 7d/30d on prod, deploy once with conservative cutoffs (e.g., 365 days for both) to confirm scheduling and permissions. Then lower the constants.

Manual trigger for verification:

```bash
gcloud scheduler jobs run firebase-schedule-retentionCleanup-asia-southeast1 --location asia-southeast1
```

Verify the `retention.cleanup.done` event appears in `platform_logs` after the run.
