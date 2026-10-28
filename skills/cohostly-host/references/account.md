# The account: what belongs to it, and who decides

Read this when the person asks about their account, who can approve something, account-wide secrets or AI keys, or why a change is "waiting for approval".

## What an account is

The workspace that owns projects. Each person in it is an `owner`, `admin` or `member`. Owners and admins act as admin on every project in the account and can delete projects; a member sees a project only if its visibility is `account` or they were invited (`auth.md`).

## What belongs to the account, not to one project

| Thing | What to know |
| --- | --- |
| **Secrets** | A secret normally belongs to one project. `share_secret` moves it to the whole account so other projects can use it; only owners and admins can. `list_secrets` shows names and where each is set, never values. |
| **AI provider keys** | The platform provides some models with no key. Others need the account's own provider key. `list_ai_keys` shows which models need one and each saved key's provider, a short hint and whether the provider accepts it. It never shows a key and cannot add one: the person adds it in the dashboard (AI keys) or runs `platform ai-keys set <provider>`. Owners and admins only. `check_manifest` with the `project` named, and a deploy, warn when a listed model needs a key the account has not saved. |
| **Connections** | Links to outside services (Google, Microsoft) that apps use. Removing a person from a project ends the connections they made to it. |
| **API keys** (`plk_...`) | Scoped to the whole account or to one project, made by a person. See `auth.md`. |
| **Activity** | The account's activity log of who changed what. |
| **Usage** | `usage` counts projects, deploys and backups. Compute time and AI spend are not measured everywhere yet; say so rather than guessing a cost. |

## Requests that wait for a person

Some changes are held until the right person approves them. Each is one kind of request, with a default decider that an account can change (dashboard, Approvals, Advanced):

| Kind | Raised when | Decided by (default) | Open for |
| --- | --- | --- | --- |
| `deploy` | A teammate or assistant deploys under a gated deploy policy | Project admins, the project owner, and account owners and admins | 1 day |
| `make_public` | Someone who is not an account owner or admin, or an assistant, widens who can open an app to `signed_in`, `link` or `public` | Account owners and admins | 7 days |
| `spend_raise` | A project's monthly AI limit is to be raised | Account owners and admins | 7 days |
| `app_action` | A running app asks a person to confirm something (`cohostly-app-code/references/approvals.md`) | Project admins, the project owner, and account owners and admins | 1 day |

There is also an `access_request` kind (a person asking to open an app) that exists but is not active yet; do not promise it.

`make_public` and `spend_raise` are high risk: they can never be covered by an "always allow" rule or approved in a batch, and an approval over MCP needs the person signed in to the dashboard.

How to handle them: see `requests.md`.

## What this skill does not cover

Creating an account, billing, inviting members at the account level, promoting or removing members, and how many accounts one person can have are not described here. Say that you do not know and point the person at the dashboard; do not invent steps.
