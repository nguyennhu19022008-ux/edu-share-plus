# EDU SHARE+ Rebuild

Current checkpoint: **3B — Database ERD + Relationship Decisions**.

The user-tested **Phase 1 Local Frontend** and **Phase 2 Frontend Architecture** are both **PASS & FROZEN**. Checkpoint 3A is PASS. Checkpoint 3B defines the target relational model and relationship decisions before any PostgreSQL/Supabase implementation.

## Run local

Runtime frontend source is unchanged from the accepted 3A/2D baseline.

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

- `docs/05_PERMISSION_MATRIX.md`
- `docs/06_DATABASE_ERD.md`
- `docs/16_PHASE1_INTEGRATION_AUDIT.md`
- `docs/17_FRONTEND_ARCHITECTURE_AUDIT.md`
- `docs/18_PHASE2B_APPLICATION_SHELL.md`
- `docs/19_PHASE2C_FEATURE_MODULARIZATION.md`
- `docs/20_PHASE2D_DATA_ACCESS_BOUNDARY.md`
- `docs/21_PHASE3A_DATABASE_REQUIREMENTS_ENTITY_AUDIT.md`
- `docs/22_PHASE3B_DATABASE_ERD_RELATIONSHIP_DECISIONS.md`

Checkpoint 3B is documentation/design-only. It does **not** create/connect Supabase, PostgreSQL, real authentication, storage, RLS, migration or production services.
