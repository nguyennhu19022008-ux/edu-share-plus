# 01 — PROJECT AUDIT

Source of truth: original EDU SHARE+ ZIP supplied by project owner.

## Legacy page identifiers

`landing`, `loginStudent`, `registerStudent`, `loginGV`, `index`, `add`, `editPost`, `detail`, `myPosts`, `myDetail`, `profile`, `admin`.

## Legacy runtime

Browser → Google Apps Script HTML Service / `google.script.run` → Apps Script services → Google Sheets / Google Drive / Apps Script Cache, Properties and triggers.

## Phase 1 rule

The new frontend must port visible UI, layout, labels, navigation and behavior from the legacy source before architectural refactoring or backend replacement.
