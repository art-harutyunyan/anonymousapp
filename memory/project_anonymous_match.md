---
name: Anonymous Match project context
description: Full-stack anonymous chat/matching app built with Next.js 16 + Supabase. Current state and key decisions.
type: project
---

Built a full-stack "Anonymous Match" web app (18+ anonymous chat/matching platform).

**Why:** User requested a complete anonymous chat platform with discovery, mutual matching, and realtime chat.

**Stack:** Next.js 16 (App Router), TypeScript, Tailwind CSS v4, shadcn/ui v4 (uses @base-ui/react — no asChild prop on Button/Trigger), Supabase (Auth + PostgreSQL + Realtime + Storage), Zustand, React Hook Form + Zod v4.

**Key technical gotchas discovered:**
- shadcn/ui v4 uses `@base-ui/react` — `Button` has NO `asChild` prop. Use `buttonVariants` + `Link` directly instead.
- `DropdownMenuTrigger` from base-ui has no `asChild` — apply className directly to the trigger element.
- Zod v4 changed `invalid_type_error` → `error`. Use `z.number()` with RHF's `{ valueAsNumber: true }` option for number inputs.
- `z.coerce.number()` in Zod v4 has input type `unknown`, incompatible with RHF resolver typing — avoid it.
- Next.js 16 warns that `middleware.ts` is deprecated; renamed to `proxy` in future versions.

**Build status:** Clean build, 0 TypeScript errors, 11 routes.

**Database:** SQL migrations in `supabase/migrations/` (001–004). User still needs to configure Supabase and run them. SETUP.md has step-by-step instructions.

**How to apply:** When resuming this project, read the current file state rather than relying on this summary. The key files are middleware.ts, lib/supabase/*, app/**/page.tsx, and components/**.
