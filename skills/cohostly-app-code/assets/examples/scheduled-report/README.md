# scheduled-report

Runs a job every weekday at 9:00 India time, safely when the platform delivers it twice.

- **Shows:** `platform.cron.schedule` (node-cron's argument order), a named schedule with a time zone, retries, `app.use(platform.cron.express())`, and using the run id to make a repeat harmless.
- **Bindings:** `cron` (defined in code, so `cron.code` is true) and `data` (a table only the app itself can use: `app_only`).
- **Why not `setInterval`:** an idle app is paused, and a paused app runs nothing.

Prefer a manifest schedule when the job is just a web call or a command (see `references/cron.md`).
