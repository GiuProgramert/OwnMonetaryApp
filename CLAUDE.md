# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

A personal finance / monetary tracking app built on the Next.js + Supabase starter kit (App Router). Users manage accounts (with balances), movement types (income/expense categories), and movements (transactions) tied to their Supabase-authenticated user. All UI copy is in Spanish.

## Commands

```bash
npm run dev      # start dev server (localhost:3000)
npm run build    # production build
npm run start    # run production build
npm run lint     # eslint (next/core-web-vitals + next/typescript)
```

There is no test suite configured in this repo.

Environment variables live in `.env.local`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_BASE_URL`.

## Architecture

### Feature module pattern (accounts, movement-types, movements)

Each domain entity follows the same layout — when adding a new entity or field, mirror this structure exactly:

- `lib/schemas/<entity>.ts` — Zod schema (`<entity>Schema`) used for both client-side form validation and Supabase insert/update payloads, plus the TS types (`<Entity>`, `create<Entity>`) used across server and client code. Types are hand-declared to match the exact columns selected in the service layer — they are not derived from Supabase's generated types.
- `lib/services/<entity>.ts` — **server-only** reads (`createClient` from `lib/supabase/server`, used from Server Components/pages). Always fetches the authenticated user via `supabase.auth.getUser()` and scopes queries with `.eq("user_id", ...)` for owner-scoped tables (accounts, movements). `movement_types` is a shared/global table with no user scoping.
- `lib/services/<entity>.client.ts` — **client-only** mutations (`createClient` from `lib/supabase/client`, used from `"use client"` forms). Re-validates input with the Zod schema via `safeParse` before hitting Supabase, even though the form already validated it.
- `components/<entity>/create-form.tsx`, `edit-form.tsx` (or `edit.form.tsx`), `delete-form.tsx`, `table.tsx` — `"use client"` forms built with `react-hook-form` + `@hookform/resolvers/zod`; `table.tsx` is an async Server Component that calls the read service directly and renders shadcn/ui `<Table>`.
- `app/protected/<entity>/page.tsx` — list page, renders the table inside `<Suspense fallback={<TableSkeleton />}>`.
- `app/protected/<entity>/create/page.tsx`, `edit/[id]/page.tsx`, `delete/[id]/page.tsx` — thin route wrappers using the shared `FormContainer` layout; edit/delete pages fetch the record server-side via `get<Entity>ById` and call `notFound()` if missing.

After any client-side mutation, forms call `revalidateMyDataAndRedirect(path)` (`lib/services/revalidate.ts`, a `"use server"` action) to revalidate the list path's cache and redirect back to it — this is the standard post-mutation flow, not `router.push` + manual refetch.

Not-found lookups check `error.details === notFoundDetailMessage` (from `lib/constants.ts`) rather than the Postgrest error code, since Supabase's `.single()` error shape is matched by message text here.

### Database triggers

The schema has no versioned migrations in this repo — triggers and functions live only in Supabase. See [`docs/database.md`](docs/database.md) for what they do, the app-level rules they impose (never write `updated_at` or `current_balance` from the app, `movements.type` must be exactly `credit`/`debit`), and the balance-drift diagnostic/repair queries. Read it before touching `movements` or `accounts` balance logic.

### Auth & Supabase clients

Three separate Supabase client constructors exist for three contexts — use the one matching where the code runs:
- `lib/supabase/server.ts` — Server Components, Route Handlers, Server Actions.
- `lib/supabase/client.ts` — Client Components (`"use client"`).
- `lib/supabase/middleware.ts` — `updateSession()`, called from the root `middleware.ts`.

`middleware.ts` matches all routes except static assets/images and runs `updateSession`, which refreshes the Supabase session and redirects unauthenticated users to `/auth/login` for any path outside `/`, `/login`, and `/auth`. Do not reorder the code around `supabase.auth.getClaims()` in `lib/supabase/middleware.ts` or drop the cookie-forwarding logic — both are called out in-file as easy ways to cause random session loss.

Routes under `app/protected/` are the authenticated app shell (sidebar + content); `app/auth/` holds login/sign-up/password-reset flows from the Supabase UI Library starter.

### Other conventions

- Always use braces for `if` statements, including single-statement bodies — no one-line `if (x) doThing();` or brace-less multi-line `if`. Applies to all TS/TSX in this repo.
- Path alias `@/*` maps to the repo root (see `tsconfig.json`).
- shadcn/ui is configured with style `new-york`, base color `neutral`, no prefix (`components.json`); primitives live in `components/ui/`. `axios` is set up in `lib/axios/index.ts` with `NEXT_PUBLIC_BASE_URL` as base but is not currently used by the CRUD services above (they call Supabase directly).
- Currency values are formatted with `toLocaleString("es-PY")` and a `Gs.` prefix (Paraguayan guaraní).
- Colors are stored as hex strings validated by `hexColorRegex` in `lib/constants.ts` and rendered as swatches (`<input type="color">` in forms, colored `<div>` in tables).

### Component usage

- Before building any UI, check `components/` for something reusable — both `components/ui/` primitives and existing feature components (e.g. `FormContainer`, `TableSkeleton`). Don't recreate what's already there.
- For a basic element (input, label, button, checkbox, badge, card, dropdown, table, skeleton), use the shadcn/ui primitive in `components/ui/` directly rather than hand-rolling markup.
- For anything more complex than a single primitive covers (a composed field, a piece of UI reused across more than one form/table, a non-trivial interaction), build a dedicated component instead of inlining it in a page or form.
- New shadcn/ui primitives get added via `npx shadcn@latest add <component>` (style `new-york`, base color `neutral`, no prefix — see `components.json`) so they land in `components/ui/` with the project's existing conventions, not hand-written from scratch.
- New feature components follow the existing folder structure: colocate under `components/<entity>/` (e.g. `components/accounts/`) alongside that entity's `create-form.tsx` / `edit-form.tsx` / `delete-form.tsx` / `table.tsx`, and reuse `FormContainer` for create/edit page layout. Cross-entity/shared components (not tied to one domain) go at the top level of `components/`, matching `form-container.tsx`, `table-skeleton.tsx`, `sidebar.tsx`, etc.
