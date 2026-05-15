# Security — Secret & Credential Management

## TL;DR

- **NEVER** commit service account keys, API keys, or `.env*.local` files.
- Pre-commit hook blocks common secret patterns. Bypass requires explicit `--no-verify`.
- Leaked keys → GitHub Secret Scanning notifies GCP → key auto-disabled. Rotate immediately.

## Secret Storage by Environment

| Environment | Storage | How to set |
|-------------|---------|------------|
| Local dev | `.env.development.local` (gitignored) | Reference path: `GCP_SERVICE_ACCOUNT_KEY=../scripts/your-key.json` |
| Local prod simulation | `.env.production.local` (gitignored) | Inline JSON or path |
| Firebase Hosting (prod) | GitHub Secrets → workflow injects into `.env.production.local` at build time | `gh secret set` |
| Cloud Functions | `firebase functions:secrets:set NAME` | Cloud Secret Manager |
| Sync-to-prod cross-project | Cloud Functions secret `PROD_SERVICE_ACCOUNT_KEY` | `firebase functions:secrets:set PROD_SERVICE_ACCOUNT_KEY` |

## Service Account Key Setup

### Generate new key

1. https://console.cloud.google.com/iam-admin/serviceaccounts?project=YOUR_PROJECT
2. Click target service account
3. Tab **Keys** → **Add Key** → **Create new key** → **JSON**
4. Save to `scripts/` (gitignored)
5. Update relevant `.env*.local`:
   ```
   GCP_SERVICE_ACCOUNT_KEY=../scripts/your-key-filename.json
   ```
6. Restart dev server

### File location convention

- `scripts/clicker-universe-firebase-adminsdk-*.json` — prod
- `scripts/clicker-universe-stagging-firebase-adminsdk-*.json` — staging
- Both ignored by `.gitignore` patterns:
  - `**/scripts/*firebase-adminsdk*.json`
  - `**/*firebase-adminsdk*.json`
  - `**/*service-account*.json`

## If a Key Leaks

1. **Disable in GCP** — IAM & Admin → Service Accounts → target SA → Keys → delete leaked key ID
2. **Generate replacement** (above)
3. **Update all `.env*.local`** referencing the old key file
4. **Restart all services** — dev servers, Cloud Run instances
5. **Audit git history** — if leaked file is in history:
   ```bash
   git log --all -- path/to/leaked-key.json
   ```
   If yes, decide: rewrite history (`git filter-repo`) + force push, OR accept history exposure (the key is dead anyway).

## Pre-commit Hook

Located at `.bare/hooks/pre-commit` (shared across all worktrees via bare repo).

Blocks:
- Filenames matching: `*firebase-adminsdk*.json`, `*service-account*.json`, `.env*.local`, `.env.production`
- Content patterns: `BEGIN PRIVATE KEY`, `BEGIN RSA PRIVATE KEY`, `private_key_id":`, AWS keys, Stripe live keys, GitHub PATs, Google API keys

**Bypass (use sparingly):**
```bash
git commit --no-verify
```

## CI Secret Scanning

- **Semgrep** runs on PRs (`.github/workflows/semgrep.yml`)
- **GitHub Secret Scanning** auto-enabled for public repos
- Run locally before commit:
  ```bash
  make semgrep-secrets
  ```
