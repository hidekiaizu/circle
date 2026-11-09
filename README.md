# Circle

A shared, interactive map of CMU's social network. People claim invited
profiles, describe the communities they belong to, and build mutually
confirmed connections. Supabase stores and synchronizes the graph in real
time across browsers.

## Features

- **Force-directed graph** (react-force-graph-2d): nodes repel, connected
  people attract, and stronger relationships pull moderately closer. Pan,
  zoom, and drag nodes.
- **Relationship categories**: Familiar, Acquaintance, Friend, Close Friend,
  Very Close Friend (1–5). Line thickness and opacity scale with strength.
- **Hide weak ties**: Familiar connections are hidden by default and can be
  revealed with a toggle.
- **Claim links and ghost profiles**: every unclaimed node has a one-time invite
  link and a visually distinct dashed treatment.
- **Rich profiles**: major, class year, residence, hometown, and clubs are
  visible; the locally claimed owner can edit their profile.
- **Mutual confirmation**: proposed connections remain faint and dashed until
  the endpoint opposite the proposer confirms them.
- **Filters and recommendations**: color by profile attributes, filter by
  major/year/residence/strength, and discover people through mutuals and shared
  attributes.
- **Search & focus**: type-ahead search jumps to and centers a person.
- **Shared persistence**: Supabase Postgres is the source of truth and Realtime
  propagates inserts, updates, and deletes. `localStorage` holds only the
  claimed browser identity and onboarding preference.

## Tech stack

- Next.js (App Router) + TypeScript
- Tailwind CSS
- react-force-graph-2d (d3-force physics)
- Supabase Postgres + Realtime
- Prisma ORM 7 for schema migrations and deterministic seeding

## Getting started

```bash
npm install
npx prisma migrate deploy
npm run seed
npm run dev
```

Open http://localhost:3000 and click **Explore the graph**.
See [docs/supabase-setup.md](docs/supabase-setup.md) for environment variables,
the open MVP policies, Realtime verification, and count checks.

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build (runs TypeScript)
- `npm start` — serve the production build
- `npm run lint` — ESLint
- `npm test` — unit tests (Vitest)
- `npm run seed` — create the single unclaimed Hideki Aizu originator profile
  when the graph is empty; existing data is never replaced
- `npm run bootstrap:originator` — create the single unclaimed Hideki Aizu
  starting profile, but only when the people table is empty
- `npm run verify:db` — report the current database counts and verify RLS
  policies and Realtime, without assuming the demo seed is installed
- `EXPECTED_PEOPLE=… EXPECTED_RELATIONSHIPS=… npm run verify:db` — require a
  specific pair of counts for another deployment state

## Project structure

```
src/
  app/
    page.tsx            Landing page
    graph/page.tsx      Graph route (wraps the store provider)
    claim/[token]/      One-time profile claim route
    layout.tsx, globals.css
  components/
    GraphExplorer.tsx   Client shell: header, panels, search, state
    GraphCanvas.tsx     Dynamic (ssr:false) wrapper for the canvas
    GraphView.tsx       react-force-graph-2d rendering + force tuning
    InspectPanel.tsx    Profiles, invite links, confirmation, recommendations
    ManagePanel.tsx     Add one of your connections
    SearchBox.tsx       Type-ahead search
  lib/
    types.ts            Domain types + category constants
    graph.ts            Domain -> force-graph mapping, neighbor/mutual helpers
    store-core.ts       Pure graph operations + computeStrength
    GraphStore.tsx      React context + optimistic Supabase synchronization
    supabase/           row mapping, repository, Realtime reducer, client
    selectors.ts        profile options, colors, filters
prisma/
  schema.prisma         relational model
  migrations/           constraints, MVP policies, Realtime publication
  seed.ts               non-destructive originator bootstrap
```

## MVP security boundary

The current database policies deliberately allow anonymous reads and writes to
support a no-auth prototype. Do not store sensitive information. Add Supabase
Auth and owner-scoped RLS before public deployment.
