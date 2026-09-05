# EDU SHARE+ Rebuild

Current checkpoint: **Phase 7 — Codebase Optimization, Mobile UX & Scientific Evaluation (PASS)**.

EDU SHARE+ is built on React 19, Vite, TypeScript, Git/GitHub, PWA, and Supabase. The platform operates 100% on real Supabase backend services (Auth, PostgreSQL RLS, RPCs, and Private Signed Storage), with all runtime mocks completely removed.

## Current status

- **Phase 1–4**: Authentication, Double-Portal Role Separation, School Roster Trust Layer (**PASS**).
- **Phase 5 (5A–5J)**: Core Marketplace, Private Signed Media, Profile, Owner Post Lifecycle, Moderation & Full Mock Removal (**PASS**).
- **Phase 6 (6A–6D)**: Transactions, Impact Estimation, Price Estimator, Reputation Engine, Explainable Recommendations (**PASS**).
- **Phase 7**: Mobile Animation/Spacing Refinement, Codebase Consolidation & Deduplication, Scientific Integrity & PII Protection (**PASS**).

Detailed documentation:
- `docs/00_CURRENT_PROJECT_STATUS.md`
- `docs/ROADMAP.md`
- `docs/00_PHASE_STATUS.md` for historical checkpoints

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
