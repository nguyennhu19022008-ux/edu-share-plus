# EDU SHARE+ Rebuild

Current checkpoint: **3A — Database Requirements + Entity Audit**.

The user-tested **Phase 1 local frontend baseline is PASS & FROZEN** and **Phase 2 Frontend Architecture is PASS & FROZEN**. Checkpoint 3A audits database requirements, legacy data classification, candidate entities and backend permission boundaries before any ERD/SQL/database implementation.

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
- `docs/21_PHASE3A_DATABASE_REQUIREMENTS_ENTITY_AUDIT.md`
- `docs/05_PERMISSION_MATRIX.md`

Checkpoint 3A is documentation-only. The application still uses controlled local UI samples. It does **not** create/connect Supabase, PostgreSQL, real authentication, storage, migration or production services.
