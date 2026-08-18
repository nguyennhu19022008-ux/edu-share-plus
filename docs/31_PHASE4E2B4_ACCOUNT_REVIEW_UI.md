# Phase 4E.2B4 — Real Account Review Queue UI

## Scope

- Preserve the existing Admin Dashboard and local post-moderation UI.
- Add one real Supabase-backed student account-review section above the post table.
- Read queue through `list_account_review_queue()`.
- Apply decisions through `review_student_account()`.
- Never update `profiles` or `account_reviews` directly from browser code.

## Decisions

- `approved`: confirmation required; no reason required.
- `needs_information`: reason required; student remains `pending_review`.
- `rejected`: reason required; student becomes `rejected`.

## Security

Teacher/Moderator school scope and Admin global scope remain enforced by the trusted RPCs. Browser code does not read `roles` or `user_roles` directly.

## Important data boundary

The new Account Review section is live operational Supabase data. The existing post moderation section remains `LOCAL_UI_SAMPLE` until Marketplace/Moderation integration phases.
