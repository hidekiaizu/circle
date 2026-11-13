# Invite-only database setup

Circle's Next.js server reads and writes Postgres through `DATABASE_URL` or
`DIRECT_URL`. Do not put either value in a `NEXT_PUBLIC_` variable. Anonymous
browser clients have no table access after the invite-only migration.

## Test without changing the live site

The existing `.env.local` points to the live database. **Do not run the new
migration with that connection for local testing.** The migration removes the
open policies used by the deployed version, so applying it before deploying
the new app would interrupt the live graph.

Create a separate Supabase project or database clone, then set its direct
Postgres connection in your local `.env.local`. Keep the live URL in a secure
place; do not commit either URL. A fresh test database can be initialized with:

```bash
npx prisma migrate deploy
npm run seed
npm run verify:db
```

The seed creates Hideki Aizu only when the test graph is empty. Obtain the
person ID from the test database, then issue the first private invitation:

```bash
npm run invite:originator -- PERSON_ID
```

The command prints a seven-day link for `http://localhost:3000`. Open it,
correct the name if needed, and set a username and password. Then sign out and
sign back in at `/`. The first member can add connected people and generate
their invitations from those nodes.

For a test clone containing existing people, use the exact ID of the intended
owner. The command refuses to issue a new link to a node that already has an
account. The migration rotates all old, publicly exposed claim tokens; old
links stop working.

## Access model

- Only holders of valid, unexpired invitation links can see a claim page and
  create an account for that node.
- The graph page and `/api/graph` require an authenticated session.
- The server verifies that a profile edit belongs to the signed-in person and
  that a relationship edit includes that person.
- Anonymous and authenticated Supabase client roles have no direct table grants.
- Passwords use salted scrypt hashes; sessions use random tokens stored as
  hashes in Postgres and sent as HTTP-only cookies.
- Invites expire in seven days. Generating another link invalidates the prior
  one. Claiming a node invalidates its link.
- Without email or phone, lost-password recovery requires manual verification
  and an administrator-issued reset; the app does not currently offer an
  automated reset.

Production deployment must coordinate the migration and app release. Back up
the live database and prepare an originator invitation first. The migration
and new app must be switched together because the deployed open-access build
cannot function once the old policies are revoked.
