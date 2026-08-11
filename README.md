# EDU SHARE+ Rebuild

Current checkpoint: **2C — Feature Modularization**.

The user-tested **Phase 1 local frontend baseline is PASS & FROZEN**. Checkpoint 2C reorganizes the largest frontend pages into feature-owned components/utilities while preserving the approved UI, UX, behavior and legacy URL model.

## Run local

```bash
npm install
npm run dev
```

Main routes remain unchanged:

- Landing: `http://localhost:5173/`
- Marketplace: `http://localhost:5173/?page=index`
- Add Post: `http://localhost:5173/?page=add`
- My Posts: `http://localhost:5173/?page=myPosts`
- Owner Detail: `http://localhost:5173/?page=myDetail&id=OWN-001`
- Edit Post: `http://localhost:5173/?page=editPost&id=OWN-003`
- Profile: `http://localhost:5173/?page=profile`
- Teacher/Admin: `http://localhost:5173/?page=admin`

## Build check

```bash
npm run build
```

## Architecture docs

- `docs/16_PHASE1_INTEGRATION_AUDIT.md`
- `docs/17_FRONTEND_ARCHITECTURE_AUDIT.md`
- `docs/18_PHASE2B_APPLICATION_SHELL.md`
- `docs/19_PHASE2C_FEATURE_MODULARIZATION.md`

Checkpoint 2C does **not** connect Supabase, a database, authentication, storage or production services. Data-access decoupling is reserved for Checkpoint 2D.
