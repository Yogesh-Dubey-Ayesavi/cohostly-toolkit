# notes-data

A notes API where each signed-in person sees only their own notes.

- **Shows:** managed data end to end: the `data` binding, a migration with a policy line, and `platform.data` calls that run as the visitor.
- **Bindings:** `data`.
- **Before the first run:** `npm run types` writes `platform.gen.js`. Run it again whenever a migration adds a table.
- **To change the table:** add `migrations/002_*.sql`. Never edit `001_init.sql` once it has been deployed; the deploy is refused.

Read `references/data.md` for the policy lines, `$app`, and the limits.
