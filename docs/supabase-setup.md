# Supabase setup

Circle currently uses an intentionally open, no-auth MVP data model. Anyone
with the browser-safe publishable/anon key can read and mutate the graph. Do not
store sensitive data, and replace these policies with authenticated ownership
rules before a public launch.

## Environment

Copy `.env.example` to `.env.local` and provide:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (preferred), or the legacy
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `DATABASE_URL`, or the supported local alias `DIRECT_URL`, using a direct or
  session-pooler PostgreSQL connection suitable for migrations

Never put a Supabase secret/service-role key in a `NEXT_PUBLIC_` variable.

## Apply and seed

```bash
npx prisma validate
npx prisma generate
npx prisma migrate deploy
npm run seed
```

The seed is non-destructive. It creates the single unclaimed Hideki Aizu
originator profile only when the graph is empty and leaves existing data alone.

Run `npm run verify:db` to report the current counts and verify RLS and
Realtime without assuming a particular graph size. To require an expected
deployment state, set both
`EXPECTED_PEOPLE` and `EXPECTED_RELATIONSHIPS` before `npm run verify:db`.

Verify counts in Supabase SQL Editor:

```sql
select (select count(*) from public.people) as people,
       (select count(*) from public.relationships) as relationships;
```

The migration enables RLS, grants the `anon` and `authenticated` roles CRUD
access through explicit open MVP policies, and adds both `public.people` and
`public.relationships` to `supabase_realtime`. Verify publication membership:

```sql
select schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
  and tablename in ('people', 'relationships')
order by tablename;
```

If publication management is unavailable to the migration role, open Supabase
Dashboard → Database → Publications → `supabase_realtime` and enable both
tables. The client subscribes to Postgres Changes for inserts, updates, and
deletes on each table.
