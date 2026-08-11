# 05 — Permission Matrix

## Status

**Phase 3B ERD-aligned authorization requirements. RLS policies are not yet implemented.**

This matrix describes intended backend/database authorization boundaries. It does not imply that RLS policies or authentication have already been implemented.

Frontend visibility is never the source of authorization truth.

## Roles

- **GUEST** — unauthenticated public visitor.
- **STUDENT** — authenticated/approved student user.
- **TEACHER / MODERATOR** — school staff with moderation/account-review capabilities.
- **VERIFICATION STAFF** — optional specialized role for physical product verification.
- **ADMIN** — system administration role.

A future account may hold more than one staff capability. Checkpoint 3B stores assignments through `roles + user_roles`, with optional school scope and revocation history.

## Matrix

| Capability / resource | Guest | Student | Teacher / Moderator | Verification Staff | Admin |
|---|---|---|---|---|---|
| View public approved marketplace posts | Allow | Allow | Allow | Allow | Allow |
| View hidden/rejected/private posts | No | Own posts only where workflow permits | Allow for moderation scope | Only when required for assigned verification | Allow |
| Register account | Allow | n/a | n/a | n/a | n/a |
| Verify own email | Own registration only | Own | Own | Own | Own |
| Approve student account | No | No | Allow if granted account-review capability | No by default | Allow |
| Read own profile/private fields | No | Own | Only when operationally authorized | Only minimum fields required for assigned verification | Allow under admin purpose |
| Update student profile/privacy | No | Own allowed fields | No by default | No | Admin/support only where explicitly required |
| Assign roles | No | No | No by default | No | Allow |
| Create post | No | Own | Staff may create only if product requirements later allow | No by default | Allow if needed |
| Edit post content | No | Own + workflow rules | Moderation fields only, not impersonating owner content edits by default | Verification notes only | Privileged support path if required |
| Withdraw own post | No | Own | No by default | No | Administrative intervention if required |
| Approve/reject post moderation | No | No | Allow | No unless separately moderator | Allow |
| Hide/show post for moderation/safety | No | Own temporary visibility only if current flow supports it | Allow | No | Allow |
| Enable/disable comments on post | No | Own toggle if current owner flow allows | Allow | No | Allow |
| Favorite post | No | As self | As own user account if needed | As own user account if needed | As own user account if needed |
| Comment/reply | Public read only | Create as self; edit/delete rules later | Moderate according to capability | Ordinary-user behavior only unless moderator | Allow moderation |
| View contact information | No | Through authorized contact flow | Only when operational purpose requires | Minimum needed for assigned verification | Privileged support only |
| Create contact event | No | As self only | As own account if applicable | As own account if applicable | As own account if applicable |
| Mark owner contact as handled | No | Owner of post only | No by default | No | Support override only if designed |
| Report post/comment/user | No by default | As self | As own account / moderation tools | As own account | Allow |
| View report queue | No | Own submitted report status only if exposed | Allow within moderation scope | Only if relevant to verification | Allow |
| Request product verification | No | Seller or interested buyer according to flow | May assist/submit if workflow permits | No self-assignment by default | Allow support action |
| Assign verification request | No | No | Allow if granted coordinator permission | No self-escalation unless policy allows | Allow |
| Submit verification result | No | No | Only if also authorized verifier | Allow for assigned request | Allow if acting as verifier/admin |
| View private verification evidence | No | Own/request-related minimum scope | Authorized moderation/verification scope | Assigned verification scope | Allow under operational purpose |
| Create support/dispute case | No | As participant/self | Can create/support under role | If verification-related and permitted | Allow |
| View case | No | Cases where participant | Assigned/authorized cases | Assigned/verification-related cases only | Allow |
| Change case status/assignment | No | No; may respond/provide evidence | Allow within case-management scope | Limited to assigned verification-related steps | Allow |
| Upload post media | No | Own post only | Moderation evidence only if designed | Verification evidence | Admin/support |
| Upload case/verification evidence | No | Authorized case/request only | Authorized case/request | Assigned verification request | Allow |
| Read own notifications | No | Own | Own | Own | Own |
| Read another user's notifications | No | No | No by default | No | Only explicit support/admin purpose if designed |
| Write audit log directly | No | No | No client-direct write | No client-direct write | No client-direct write; generated by privileged backend/database action |
| Read audit history | No | Own activity summaries only if separately exposed | Authorized operational scope | Verification-relevant subset | Allow |
| Read operational analytics dashboard | Public summary only if approved | Personal metrics | School/moderation metrics | Verification metrics | Full authorized operational analytics |
| Read raw research datasets | No | No | Not automatically | No | Separate research governance; not implied by Admin role |

## Core enforcement rules

1. **RLS/backend authorization is authoritative.** UI checks are presentation only.
2. Every user-owned mutation derives identity from the authenticated session UUID, never a client-supplied email.
3. Service-role/server secrets never exist in browser code.
4. Staff permissions should be capability-scoped rather than assuming every teacher is a full administrator.
5. Verification evidence and dispute evidence are private by default.
6. Audit entries for privileged/material actions are generated by trusted backend/database logic, not by trusting arbitrary client payloads.
7. Research access is a separate governance concern; operational Admin rights do not automatically mean unrestricted access to historical survey data.

## To finalize during Phase 3C and later implementation

- exact RLS policy expressions and helper functions;
- PK/FK `ON DELETE` behavior and controlled account-anonymization workflow;
- account approval transition rules;
- staff assignment scope checks by school;
- ownership rules for any retained legacy posts;
- comment edit/delete/retention policy;
- support/admin override policy;
- evidence retention/access rules.
