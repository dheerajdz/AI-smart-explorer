# Railway deployment notes — backend

Use this file to configure Railway (or similar CI) to build and run the backend service.

1) Set the service Root Directory

- In Railway UI: open the Project → Service → Settings → Deploy (or Service Settings).
- Set the Root Directory (or "Root") to: `backend` and save.

Why: the repository root contains only a minimal `package.json`. The real Node app and its start scripts live in the `backend/` subdirectory, so Railway must run install/build/start there.

2) Required scripts (backend)

Ensure `backend/package.json` defines these scripts:

- `dev` — developer/start script used locally (e.g., `pnpm dev` or `ts-node-dev ...`).
- `start` — production start command (e.g., `node dist/index.js` or `node build/index.js`).
- `build` — build step if using TypeScript (e.g., `tsc -p .`).

3) Environment variables

- Set Railway environment variables for any secrets used by the backend (Mongo URI, Redis, STRIPE keys, TELEGRAM token, etc.).

4) Local verification

Run these locally to confirm the same commands Railway will execute:

```bash
# from repo root
cd backend
pnpm install
pnpm build   # if applicable
pnpm start
```

5) Alternative: keep Railway pointed at repo root

- This repository includes top-level `start`/`build` scripts to help builders detect a start command. If you prefer not to change Railway settings, the top-level scripts will forward to the frontend or backend as configured. However, pointing Railway directly to `backend` is cleaner and less error-prone.

6) Redeploy

- After changing the Root Directory, redeploy the service in Railway to pick up the new working directory.

7) Notes for maintainers

- If you use GitHub/Git integration, set the service when creating the integration so the Root Directory is recorded.
- To open a PR from the repo root using the `gh` CLI (if available & authenticated):

```bash
gh pr create --title "docs: add Railway backend deploy notes" --body-file PR_DESCRIPTION.md --head feat/solve-pending-issues --base main
```
