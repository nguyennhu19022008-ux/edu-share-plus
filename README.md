# EDU SHARE+ Rebuild

Current checkpoint: **Phase 5A — Foundation Stabilization**.

EDU SHARE+ is being rebuilt on React, Vite, TypeScript, Git/GitHub and Supabase. The former Google Apps Script / Google Sheets generation is frozen as historical/research reference; its operational accounts, posts, comments, favorites and notifications are **not migrated** into the new Supabase system.

## Current status

See:

- `docs/00_CURRENT_PROJECT_STATUS.md`
- `docs/ROADMAP.md`
- `docs/00_PHASE_STATUS.md` for historical checkpoints

The real Supabase Auth and teacher account-review flows are already connected. Marketplace/profile/owner-post/post-moderation areas are still being migrated away from mock/local runtime repositories.

## Run local

```bash
npm ci
npm run dev
```

App origin:

```text
http://localhost:5173
```

Local Supabase Auth is configured for the same Vite origin and requires email confirmation.

## Verify

```bash
npm run test:run
npm run build
```

GitHub Actions runs the same unit-test and production-build gates on Phase branches and pull requests.

## Main routes

- Landing: `http://localhost:5173/`
- Marketplace: `http://localhost:5173/?page=index`
- Add Post: `http://localhost:5173/?page=add`
- My Posts: `http://localhost:5173/?page=myPosts`
- Profile: `http://localhost:5173/?page=profile`
- Teacher/Admin: `http://localhost:5173/?page=admin`

## Architecture reference

The existing architecture/security/database documents under `docs/` remain useful historical and technical references. Current implementation decisions and sequencing are summarized in `docs/00_CURRENT_PROJECT_STATUS.md` and `docs/ROADMAP.md`.
