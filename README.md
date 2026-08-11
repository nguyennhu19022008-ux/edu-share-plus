# EDU SHARE+ Rebuild

Current checkpoint: **2D — Data Access Boundary**.

The user-tested **Phase 1 local frontend baseline is PASS & FROZEN**. Phase 2A–2C audited and modularized the frontend. Checkpoint 2D adds provider-neutral repository contracts and a React data-access provider so pages/components no longer import controlled mock/local stores directly.

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
- `docs/20_PHASE2D_DATA_ACCESS_BOUNDARY.md`

Checkpoint 2D still uses controlled local UI samples. It does **not** connect Supabase, PostgreSQL, real authentication, storage, migration or production services.
