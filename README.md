# EDU SHARE+ Rebuild

Current checkpoint: **2A — Frontend Architecture Audit**.

The user-tested **Phase 1 local frontend baseline is PASS & FROZEN**. Checkpoint 2A changes documentation only; it does not redesign or change runtime behavior.

## Run local

```bash
npm install
npm run dev
```

Main routes:

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

Checkpoint 2A does **not** connect Supabase, a database, authentication, storage or production services.
