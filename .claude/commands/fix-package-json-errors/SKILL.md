---
name: Fix package.json Errors for Firebase Deployment
description: Diagnose and fix common package.json and dependency errors that cause Firebase Hosting/Functions deployment failures in this pnpm monorepo.
---

# Fix package.json Errors for Firebase Deployment

## Project Context

This is a **pnpm monorepo** with multiple Next.js apps and Cloud Functions deployed to Firebase Hosting (with `webframeworks` experiment). The worktree to work with is **`main/`** (ignore `dev/`).

### Discover Project Structure

```bash
# List all packages with pnpm lockfiles
find . -name pnpm-lock.yaml -not -path '*/node_modules/*' -exec dirname {} \;

# List all package.json files
find . -name package.json -not -path '*/node_modules/*' -maxdepth 2
```

> **IMPORTANT**: Even when deploying `--only hosting`, the web frameworks experiment auto-generates and deploys Cloud Functions for SSR. This means Cloud Functions build errors WILL block hosting deployment.

---

## Error Pattern #1: Missing Dependency in pnpm Project

### How to Recognize
Cloud Build error mentioning a missing dependency, e.g.:
- `you have not included [package] in your dependencies`
- `Module not found: Can't resolve '<package>'`
- `Cannot find module '<package>'`

### Root Cause
pnpm enforces **strict dependency resolution**. Unlike npm/yarn, pnpm will NOT hoist un-declared dependencies. If a package is used but not listed in `dependencies`, it will fail during Cloud Build.

### Diagnosis
1. Read the error message to identify the **missing package name**.
2. Identify which directory triggered the error (check the build logs for the function/app name).
3. Check if the package is in that directory's `package.json`:
   ```bash
   grep "<package-name>" <directory>/package.json
   ```

### Fix
```bash
cd <affected-directory>
pnpm add <missing-package-name>
```

---

## Error Pattern #2: Dependency Version Conflict

### How to Recognize
- `While resolving: <package>@<version>`
- `Found: <package>@<different-version>`
- Lockfile integrity errors

### Root Cause
Different packages in the monorepo specify different versions of the same dependency. Cloud Build uses the lockfile strictly and fails on conflicts.

### Diagnosis
Check all versions of the conflicting package across the monorepo:
```bash
grep '"<package-name>"' */package.json
```

### Fix
Pick one version, update ALL `package.json` files to match (use pinned versions without `^`), then run `pnpm install` in each affected directory.

---

## Error Pattern #3: Missing `engines.node` Field

### How to Recognize
```
Skipping functions deploy: no Node version specified
```

### Root Cause
Firebase requires `engines.node` in `package.json` to determine the Cloud Functions runtime.

### Fix
Add to every package that deploys Cloud Functions:
```json
"engines": { "node": "22" }
```

---

## Error Pattern #4: Lockfile Out of Sync

### How to Recognize
```
ERR_PNPM_OUTDATED_LOCKFILE
```

### Root Cause
`package.json` was edited manually but `pnpm install` was not run to update `pnpm-lock.yaml`.

### Fix
```bash
cd <affected-directory>
pnpm install
```

> **RULE**: Always run `pnpm install` after modifying any `package.json`.

---

## General Diagnosis Workflow

When a deployment fails with a package.json-related error:

1. **Read the error message** — identify the package name and error type.
2. **Identify the affected directory** — check which function/app failed in the build log.
3. **Check `package.json`** — is the dependency listed? Is the version correct?
4. **Check `pnpm-lock.yaml`** — is it in sync with `package.json`?
5. **Fix** — `pnpm add <package>` or edit version, then `pnpm install`.
6. **Verify across monorepo** — check if other packages have the same issue:
   ```bash
   # Check all packages for a specific dependency
   grep "<package-name>" */package.json

   # Check all lockfiles are in sync
   for pkg in $(find . -name pnpm-lock.yaml -not -path '*/node_modules/*' -exec dirname {} \;); do
     (cd "$pkg" && pnpm install --frozen-lockfile) || echo "❌ Out of sync: $pkg"
   done
   ```
