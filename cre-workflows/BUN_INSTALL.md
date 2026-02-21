# Bun install (CRE workflow)

The **ip-registration-workflow** uses Bun. If you see **integrity check failed** errors when running `bun install`:

1. **Clear Bun’s cache** (from any directory):
   ```bash
   bun pm cache rm
   ```

2. **Install only in the workflow folder** (not from repo root):
   ```bash
   cd cre-workflows/ip-registration-workflow
   bun install
   ```

3. If it still fails (e.g. `Integrity check failed for tarball: viem` or `typescript`):
   - Try again after a few minutes (registry/cache can be temporarily bad).
   - Or use **npm** in this folder instead:
     ```bash
     cd cre-workflows/ip-registration-workflow
     npm install
     ```
     Then run the CRE CLI as usual (`cre workflow simulate ...`); the workflow itself doesn’t require Bun at runtime.

**Repo root:** The main project uses **yarn** (see `packageManager` in root `package.json`). Prefer **`yarn`** or **`npm install`** in the repo root instead of `bun install` to avoid lockfile/cache conflicts.
