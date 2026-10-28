# visitor-greeting

Shows the visitor's name to a signed-in person, and a sign-in link to everyone else.

- **Shows:** the request context (`middleware`, `req.platform.caller`), `loginUrl`, and treating a missing name as unknown.
- **Bindings:** none. It reads the context the platform sends on every request.
- **Settings:** `context.preset: "friendly"` is what lets `caller.name` arrive (the person must also have agreed to share it).

Read `references/context.md` for the fields and the rules.

```bash
platform dev --project visitor-greeting -- npm start   # try it signed in and signed out
cohostly deploy                                         # see cohostly-host
```
