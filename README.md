# Circle

A shared, interactive map of CMU's social network. People claim invited
profiles, describe the communities they belong to, and build mutually
confirmed connections. The graph is private to invited members.

## Features

- **Force-directed graph** (react-force-graph-2d): nodes repel, connected
  people attract, and stronger relationships pull moderately closer. Pan,
  zoom, and drag nodes.
- **Relationship categories**: Familiar, Acquaintance, Friend, Close Friend,
  Very Close Friend (1–5). Line thickness and opacity scale with strength.
- **Closeness filter**: Familiar connections are hidden by default. The
  Filters sheet switches between All connections, Acquaintance or closer,
  Friend or closer, and Close Friend or closer.
- **Claim links and ghost profiles**: a member can issue a seven-day invite
  link to an unclaimed connection, shown with a dashed treatment.
- **Rich profiles**: major, class year, residence, hometown, and clubs are
  visible; the signed-in owner can edit their profile.
- **Mutual confirmation**: proposed connections remain faint and dashed until
  the endpoint opposite the proposer confirms them.
- **Filters and recommendations**: color by profile attributes, filter by
  major/year/residence/strength, and discover people through mutuals and shared
  attributes.
- **Search & focus**: type-ahead search jumps to and centers a person.
- **Private persistence**: Postgres is the source of truth. Authenticated
  server routes load and update the graph; the client refreshes periodically.

## Tech stack

- Next.js (App Router) + TypeScript
- Tailwind CSS
- react-force-graph-2d (d3-force physics)
- Supabase Postgres
- Prisma ORM 7 for schema migrations and deterministic seeding

## Getting started

```bash
npm install
npx prisma migrate deploy
npm run seed
npm run invite:originator -- PERSON_ID
npm run dev
```

Open the private invitation printed by the command, then choose a username
and password. See [docs/supabase-setup.md](docs/supabase-setup.md) for safe
testing with a separate database and production rollout notes.

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
- `npm run invite:originator -- PERSON_ID` — issue the first private invitation
- `npm run verify:db` — verify private table access and report graph counts
- `EXPECTED_PEOPLE=… EXPECTED_RELATIONSHIPS=… npm run verify:db` — require a
  specific pair of counts for another deployment state

## Project structure

```
src/
  app/
    page.tsx            Sign-in page
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
    GraphStore.tsx      React context + authenticated API synchronization
    server/             database and session helpers
    selectors.ts        profile options, colors, filters
prisma/
  schema.prisma         relational model
  migrations/           schema and private-access policies
  seed.ts               non-destructive originator bootstrap
```

## Testing note

The local `.env.local` may still point to the live database. Do not apply the
invite-only migration to it while the deployed app still uses the old schema.
Use a separate database to test the entire claim and login flow first.
