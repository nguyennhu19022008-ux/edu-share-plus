# 08 — Security Model

## Status

**Checkpoint 3C security/RLS blueprint. Design only; no live policies, credentials or Supabase project exist yet.**

EDU SHARE+ is a school platform involving student profiles, contact information, moderation, verification evidence and dispute evidence. Security is therefore designed as a backend/database property, not a frontend role check.

---

## 1. Trust boundaries

### Untrusted / semi-trusted

- Browser JavaScript and localStorage/session state;
- URL/query parameters (`?page=...&id=...`);
- any email, user ID, role, owner ID or school ID supplied by client payload;
- file names/extensions supplied by client;
- client-generated analytics payloads;
- UI-hidden buttons.

### Trusted after validation

- Supabase Auth JWT/`auth.uid()` for caller identity;
- PostgreSQL constraints;
- RLS policies;
- narrowly scoped trusted database functions/RPCs;
- backend/Edge Function only when server-side integration is genuinely required;
- object-storage authorization policies;
- server-generated audit history.

Service-role/secret keys are never browser assets because they bypass normal RLS protections.

---

## 2. Authorization model

### Roles

- Guest (`anon`)
- Student (`authenticated` + approved student role/account state)
- Teacher/Moderator (school-scoped capability)
- Verification Staff (school/request-scoped capability)
- Admin (privileged operational capability)

A user can hold multiple role assignments, but grants are explicit and may be school-scoped. Teacher != global Admin.

### Account state gate

An authenticated account is not automatically an approved platform participant.

Operational mutations that require student participation must require:

```text
authenticated identity
+
profiles.account_status = approved
+
required role/scope
```

Pending/rejected/suspended users have intentionally limited access.

---

## 3. RLS helper strategy

Role/scope checks should not duplicate large joins in every policy. The implementation may use narrow helper functions in the non-exposed `private` schema, e.g.:

- `private.is_approved_user()`
- `private.has_role(text, uuid)`
- `private.can_moderate_school(uuid)`
- `private.can_verify_request(uuid)`
- `private.can_handle_case(uuid)`

For helpers used in RLS:

- prefer invoker semantics where sufficient;
- if SECURITY DEFINER is required to avoid recursive RLS or to read role assignments safely, set an explicit/empty `search_path`, fully qualify tables, return the minimum boolean result and restrict EXECUTE;
- policies should explicitly target `anon` or `authenticated`;
- use authenticated UUID, never request email;
- tests must cover policy recursion and cross-school escalation.

---

## 4. Table-level policy inventory

The names below are policy intents, not executable SQL.

### `schools`, `school_classes`, `categories`

**SELECT**
- Guest/Student: active reference rows needed for UI.
- Staff: rows within operational scope; Admin all.

**INSERT/UPDATE/DELETE**
- no ordinary student write;
- trusted Admin/configuration path only.

### `profiles`

**SELECT**
- Student: own complete operational profile.
- Staff: minimum rows within authorized operational scope.
- Guest marketplace should consume a privacy-safe projection, not unrestricted base profile rows.

**INSERT**
- created through registration bootstrap derived from `auth.uid()`.

**UPDATE**
- Student: only own allowed public/privacy-display fields; cannot change account status, reputation cache, school/role arbitrarily.
- Staff/Admin: controlled support path.

**DELETE**
- no client direct delete.

### `profile_private`

**SELECT/UPDATE**
- own row for approved self-service fields;
- staff only for explicit account-review/support purpose and school scope.

Guest: none.

No public projection may expose face image, raw phone/email unless the user-facing flow explicitly authorizes those fields.

### `roles`, `user_roles`, `account_reviews`

- Students cannot assign or revoke roles.
- Teacher/Moderator may review accounts only if granted that capability and scope.
- Role assignment/revocation is Admin/trusted function only.
- User-role history is staff-visible, not ordinary public data.

### `posts`

**Guest SELECT**
Only:

```text
moderation_status = approved
AND lifecycle_status = active
AND is_hidden = false
```

plus school/public deployment scope.

**Student SELECT**
- same public set;
- own posts across allowed workflow states.

**Student INSERT**
- through trusted submission function;
- owner forced to `auth.uid()`;
- school derived from profile;
- moderation forced pending;
- lifecycle forced active.

**Student UPDATE**
- direct broad update discouraged;
- owner-content updates/resubmit/visibility/lifecycle use explicit trusted operations so owner cannot modify moderation/status history fields.

**DELETE**
- no normal client hard delete.

**Teacher/Moderator**
- moderation scope only for school;
- owner content is not silently impersonated/rewritten by moderator unless a separately approved support feature requires it.

### `post_media` / `file_objects`

- public post media readable only when anchored to a public post and file visibility permits;
- owners can manage their own draft/post media through authorized storage flow;
- private/restricted file objects never become public through generic file-row reads;
- file bytes and metadata authorization must agree.

### `favorites`

- authenticated approved user can SELECT/INSERT/DELETE own `(user_id=auth.uid())` rows;
- cannot favorite as another user;
- public save counts are aggregate/projection data, not full saver identities.

### `comments`

- public can read visible comments only on public/readable posts;
- approved student inserts only as self and only when post comments are enabled;
- author editing window/policy is implemented explicitly later;
- owners cannot directly hide other users' comments unless existing workflow grants it; moderators have separate moderation capability;
- soft-removed/internal moderation data not exposed publicly.

### `contact_events`

- only approved authenticated users can create their own authorized contact event;
- contact info retrieval and event creation should happen in one trusted workflow so a client cannot bypass behavioral logging;
- post owner can view contact events for own post and mark handled;
- staff access only for support/moderation purpose.

### `notifications`

- recipient SELECT own only;
- recipient can mark own read;
- browser cannot create arbitrary notifications for others.

### `moderation_actions`

- no student insert/update/delete;
- authorized moderator/Admin read within scope;
- write only through trusted moderation transaction.

### `reports`

- approved authenticated user can create report as self through trusted target-validation function;
- reporter can read own report status if product UX exposes it;
- moderation staff can read/update queue in scope;
- resolution changes are audited;
- report evidence/internal notes, if later added, are not public.

### `verification_requests`

- post owner can request seller-origin verification;
- interested non-owner student can request buyer-origin verification according to workflow;
- requester identity is derived from auth;
- assignment is coordinator/Admin only;
- verification staff sees assigned/request-relevant records;
- no self-verification.

### `verification_results` / `verification_evidence`

- result insertion only by authorized assigned verifier/trusted flow;
- results append, not overwrite;
- raw evidence accessible only to requester/owner/staff where the approved workflow requires it;
- public marketplace receives only a safe verification summary/badge (outcome, date, scope summary, verifier unit), never raw evidence/internal notes.

### `transactions`

- only participants/staff can read non-public transaction details;
- creation/transition through trusted function that validates post owner/counterparty;
- no student can mark an arbitrary transaction completed by direct row UPDATE;
- transaction events are append-oriented.

### `cases`, `case_participants`, `case_updates`, `case_evidence`

- participant reads only cases where they are a participant;
- assigned handler/staff reads cases in scope;
- student messages/evidence only in own case;
- `staff_only` updates denied to student participants;
- status/assignment/resolution transitions are staff/trusted function only;
- evidence private/restricted.

### Price/reputation tables

- students may request a price estimate but cannot edit model versions/reference data/output lineage;
- price reference curation is staff/admin capability;
- estimate records are immutable snapshots;
- students cannot write their own reputation points/model/cache;
- reputation model/reference administration is privileged and audited.

### `private.*`

No direct Guest/Student browser table access.

- audit: trusted write only;
- analytics: allowlisted ingestion path only;
- migration map: migration tooling/staff only.

---

## 5. Public projection strategy

The normalized base model contains fields that should not all be browser-readable. Repositories should therefore consume explicit projections.

Examples:

### Marketplace post projection

May expose:

- post ID/title/description/category/trade type/price;
- public media;
- privacy-respecting seller display name/class;
- reputation display cache;
- safe metrics;
- current verification summary/badge.

Must not expose:

- `profile_private`;
- phone/email before authorized contact flow;
- face image;
- verification raw evidence/internal notes;
- moderator internal notes;
- case/dispute data;
- hidden/rejected post data to Guest.

### Owner projection

May expose own moderation reason/history and own contact metrics but still must not leak unrelated users' private fields.

### Staff projections

Must remain school/capability scoped; a convenient dashboard view must not bypass scope rules.

PostgreSQL/Supabase views must be designed deliberately: views may bypass underlying RLS depending on creator/security mode. For views intended to honor caller policies on supported PostgreSQL versions, use `security_invoker=true`. Privileged projections should instead be narrow, explicitly granted functions/views with tests.

---

## 6. Security-sensitive workflows requiring atomic trusted operations

### Post moderation

```text
authorize moderator school scope
→ validate requested transition
→ update posts current state
→ append post_status_history
→ append moderation_actions
→ create notification
→ append audit log
COMMIT
```

No partial success is acceptable.

### Verification result

```text
authorize assigned verifier
→ reject self-verification
→ validate revision lineage
→ append result
→ update request state
→ attach evidence metadata
→ audit
COMMIT
```

### Case resolution

```text
authorize handler
→ validate transition
→ append case update
→ update case current status/resolution
→ notify participants
→ audit
COMMIT
```

### Price estimate

```text
select active immutable model
→ select eligible reference observations
→ calculate deterministic output
→ store input snapshot/output/explanation
→ store exact reference lineage
COMMIT
```

The seller's chosen price remains separate.

---

## 7. Secret/key model

Browser may eventually contain only public/publishable project configuration intended for client use.

Never in browser/source repository:

- Supabase secret key/service-role key;
- database password/connection URI;
- SMTP secret;
- privileged webhook secret;
- private admin shared key;
- service account credentials.

Service-role/secret credentials belong only in protected server/CI environment variables and are used minimally because they bypass RLS.

`.env`/`.env.*` remain gitignored; an `.env.example` may document variable names without values.

---

## 8. File-security model

1. Validate MIME and magic bytes, not extension alone.
2. Enforce per-purpose size/type limits.
3. Generate randomized paths; never trust client file names as storage identity.
4. Public post-media bucket/object can be public only after the surrounding content rules allow it.
5. Avatar may be public if user chooses and product policy allows.
6. Face verification, verification evidence and case evidence remain private/restricted and use signed/authorized access.
7. Metadata row and storage object ownership must agree.
8. Deletion requires reference/orphan checks; no database base64 blobs.
9. Image derivatives/compression do not overwrite research/source originals.

---

## 9. Audit requirements

Material actions that must generate trusted audit records include at least:

- account approve/reject/suspend;
- role assign/revoke;
- post approve/reject/force hide/show/comment disable;
- verification assignment/result;
- report resolution/escalation;
- case assignment/status/resolution;
- price model activation/reference eligibility changes;
- reputation model/scoring administrative changes;
- privileged data export/access where appropriate.

Audit rows should record actor, role/scope snapshot, action, entity, before/after state where useful, source and timestamp.

Ordinary clients never supply a trusted `actor_id` for audit; it is derived from the authenticated context.

---

## 10. Operational analytics vs research data

Operational analytics may record minimized events such as view/search/save/contact/post/verification/case lifecycle, but:

- do not capture passwords/private messages/unnecessary personal data;
- do not use operational account count to rewrite historical KHKT participation figures;
- historical surveys stay separately governed;
- analytics events must use an allowlist and data-retention policy;
- research extracts require explicit methodology/version and are not implied by Admin role.

---

## 11. Threat scenarios to test

1. Student A changes URL `id` to Student B's hidden/rejected post.
2. Student sends `owner_id` of another user when creating/editing post.
3. Student directly sets `moderation_status='approved'`.
4. Student writes a staff role into `user_roles`.
5. Teacher from School A queries/moderates School B.
6. Verification staff assigns themselves or verifies own product.
7. Student queries raw verification/case evidence path.
8. User bypasses contact logging and directly requests private email/phone.
9. User reports a target with mismatched target_type/FKs.
10. User directly inserts audit/analytics payload claiming another actor.
11. SECURITY DEFINER helper has unsafe search path or over-broad execute grant.
12. View accidentally bypasses RLS and exposes hidden/private rows.
13. Service-role key accidentally appears in browser bundle/Git history.
14. File MIME/extension mismatch upload.
15. Replayed/forged role metadata in user-editable JWT metadata.

These become mandatory negative tests when backend implementation begins.

---

## 12. RLS performance rules

- RLS is authorization, not a substitute for explicit query filters.
- Index columns used by RLS predicates and common scopes (`owner_id`, `school_id`, assignee, participant IDs).
- Prefer row-local predicates where possible.
- For fixed per-request identity/helper results, later policy SQL should use statement-cached patterns recommended by Supabase where safe.
- Avoid policy joins that form recursive RLS dependencies; use carefully secured helper functions when required.
- Benchmark with realistic data and inspect execution plans before production.

---

## 13. References

- PostgreSQL Row Security: https://www.postgresql.org/docs/current/ddl-rowsecurity.html
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Secure Data/API: https://supabase.com/docs/guides/database/secure-data
- Supabase Database Functions: https://supabase.com/docs/guides/database/functions

