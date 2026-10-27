# roles-gate

A private app with three doors: any member, editors and up, and an owner-only admin page.

- **Shows:** the request context's `access.role` (a person's role on this project) and `access.account_role` (their role in the owning account), `middleware({ required: true })`, and refusing with 403 instead of hiding a button.
- **Bindings:** none.
- **Settings:** `visibility: "private"`, so only people the project is shared with (and the account's owners and admins) get in. Share with `viewer`, `editor` or `admin` and see the pages change. Roles are listed at `platform://reference/roles`.
- **The rule it follows:** a role is checked on the server from the signed context. Hiding a link in the page is a courtesy, not a lock.

Read `references/context.md` for the fields and `references/sign-in.md` for platform sign-in versus your own.
