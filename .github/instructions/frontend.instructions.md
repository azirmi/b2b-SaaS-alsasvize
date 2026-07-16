---
description: 'Always-on frontend rules for the Alsasvize Next.js App Router PWA: RSC-first architecture, cookie-auth API integration, Socket.io real-time, and the anti-AI-slop design system.'
applyTo: 'frontend/**'
---

# Frontend Rules — Alsasvize Web (Next.js App Router)

The `frontend/` app is a mobile-ready PWA consuming the NestJS API documented in [AGENTS.md](../../AGENTS.md). Stack: **Next.js (App Router) · React · TypeScript · Tailwind CSS · shadcn/ui · Radix · Lucide React · socket.io-client**. Output production-ready code only — no `// TODO` stubs, no placeholder UI, no fluff comments.

## Architecture — Server-First (RSC)

- **Default to React Server Components.** Add `"use client"` ONLY at the leaf node that actually needs interactivity (hooks, event handlers, Socket.io listeners, browser APIs). Never mark a page/layout client just to reach one button — push the boundary down.
- Fetch data in Server Components; pass plain serializable props to client leaves. Mutations go through **Server Actions** or route handlers, never by leaking secrets to the browser.
- Keep global state minimal. Prefer server data + URL state (`searchParams`) over client stores. Reach for context/Zustand only for genuinely cross-tree client state.
- Responsive is mandatory: design mobile-first, layer `md:` / `lg:`. The UI is wrapped as a PWA later — no fixed pixel widths, no desktop-only interactions.

## Mobile-First Responsiveness (critical)

- Always design mobile-first: base Tailwind classes target mobile, then upscale with `md:` and `lg:`.
- **Never** rely on plain `overflow-x-auto` for mobile data tables. Implement a **Table-to-Cards** pattern instead:
  - Keep a desktop table for `md+`.
  - On mobile, hide `thead`, render each row as a card (`flex flex-col`), and display each field with a visible label/value pair.
- Prevent viewport cut-offs on iPhone-sized screens: avoid negative margins (for example `-mx-4`), fixed-width containers (for example `w-[600px]`), and parent `overflow-hidden` wrappers that clip content. Prefer `w-full`, `min-w-0`, and content-aware wrapping.

## Navigation & Tabs

- If tabs, filters, or horizontal nav items overflow on mobile, wrap them in a strictly scrollable strip:
  - `flex w-full overflow-x-auto whitespace-nowrap scrollbar-hide`
- Keep the page viewport fixed while allowing only the tab strip to scroll/swipe.

## Heavy Components (calendar/timeline)

- Non-shrinking components (calendar, scheduler, dense timeline) must be caged in a local scroll container: `w-full overflow-x-auto`.
- Give the inner component an explicit `min-w-*` so scrolling happens inside the component cage instead of breaking the app viewport.

## Conditional Rendering Hygiene

- Mobile cards must render cleanly: no duplicate values, no empty labels, and no placeholder separators when data is missing.
- Keep the established typography and semantic color mapping exactly as defined in the design-system skill; do not introduce ad-hoc visual variants.

## API Integration (cookie auth — no bearer tokens)

- Auth is an **HTTP-only cookie** (`ACCESS_TOKEN_COOKIE`); JS cannot read it. Derive auth state from `GET /auth/me`, never by parsing cookies. Never store the JWT in `localStorage`/JS.
- Base URL: `process.env.NEXT_PUBLIC_API_URL` (dev `http://localhost:3001`).
- **Server Components must forward the cookie manually** — server-to-server fetches do not inherit it:
  ```ts
  import { cookies } from 'next/headers';
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/applications/mine`, {
    headers: { cookie: (await cookies()).toString() },
    cache: 'no-store',
  });
  ```
- **Client fetches must send `credentials: 'include'`** so the cookie rides along cross-origin.
- Protect route groups with `proxy.ts` (Next 16's renamed middleware): redirect when the cookie is absent. Do real role checks server-side via `/auth/me`. **Never trust a client-supplied role** — roles come from the server session only.
- Endpoints, DTOs, and enums are the source of truth in the backend — mirror them, do not invent shapes:
  - Auth: [auth.controller.ts](../../backend/src/auth/auth.controller.ts) (`/auth/register`, `/auth/onboard` multipart, `/auth/login`, `/auth/logout`, `/auth/me`).
  - Applications: [visa-applications.controller.ts](../../backend/src/visa-applications/visa-applications.controller.ts) (`mine`, `pool`, `:id`, `claim`, `stage`, `pause`, `resume`, `reassign`, `force-cancel`).
  - Documents: [documents.controller.ts](../../backend/src/documents/documents.controller.ts).
  - Enums (`Role`, `VisaStage`, `FileType`, `OcrStatus`): [enums.ts](../../backend/src/generated/prisma/enums.ts) — keep a hand-maintained mirror in `frontend/lib/enums.ts`.

## File Uploads — direct-to-storage, zero API payload

Files never pass through the API. Two steps, always:
1. `POST /documents/presigned-url` → `{ document, key, uploadUrl, expiresIn }`.
2. `PUT` the raw file bytes straight to `uploadUrl` (MinIO/S3) from the browser. Downloads use `GET /documents/:id/download` → `{ url }` then fetch that URL.

Sole exception: onboarding streams the passport through `POST /auth/onboard` as `multipart/form-data`. Do not add other server file passthroughs.

## Real-time (Socket.io)

- Encapsulate all socket logic in a custom hook (e.g. `useSocket`) inside a `"use client"` leaf. Create the connection once, and **always remove listeners + disconnect in the effect cleanup** to prevent leaks and duplicate handlers.
- Namespace is `/events`; connect from the browser with `io("<API>/events", { withCredentials: true })` (mobile/native uses `{ auth: { token } }`).
- Only non-customers receive broadcasts (server `staff` room). Event names are contract constants from [events.gateway.ts](../../backend/src/events/events.gateway.ts): `applicationClaimed`, `stageChanged`, `slaBreached` — with the typed payloads defined there. Emissions happen post-commit, so treat them as authoritative refresh triggers (e.g. `router.refresh()` / revalidate).

## Design System (anti-AI-slop) — enforced

Emulate **Claude / Vercel / Linear**: professional, minimalist, information-dense.

- **Depth via borders, not shadows:** `border border-border/40 shadow-sm`. No heavy/exaggerated drop-shadows.
- **Restrained radii:** `rounded-md` / `rounded-lg` only. No pill-shaped cards or oversized corners.
- **Typography hierarchy:** `tracking-tight` on headings, `leading-relaxed` on body; demote secondary text with `text-muted-foreground`.
- **Monochrome dominance.** Color (red / green / blue / amber) is reserved **exclusively** for semantic status (SLA breach, approved, paused, in-process) — never for decoration.
- **Use shadcn/ui + Radix primitives** for every standard component (Button, Input, Dialog, Table, Select, Badge, DropdownMenu, Tooltip). Do not hand-roll bespoke HTML/Tailwind for things a primitive already covers. Icons come from `lucide-react`.

Full tokens, typography scale, status→color mapping, and component recipes: **[frontend-design-system skill](../skills/frontend-design-system/SKILL.md)**.

## Integration pitfalls

- Cross-origin cookies need credentials on **both** ends: send `credentials`/`withCredentials`, and the API must allow the exact frontend origin with `credentials: true` (REST CORS + socket `CORS_ORIGIN`). Prefer a same-origin Next.js rewrite/proxy to keep the cookie first-party and avoid `SameSite` friction.
- The dev backend cookie is `SameSite=Lax` + `Secure` in prod; a cross-site production deployment requires `SameSite=None; Secure`.
- Validate forms with the same constraints the API enforces (see each DTO). The API runs a strict `whitelist` + `forbidNonWhitelisted` pipe — never send unknown fields.
