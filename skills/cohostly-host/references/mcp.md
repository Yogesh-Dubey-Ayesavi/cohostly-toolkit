# MCP tools

Read this when the MCP tools for Cohostly are available and you need to know what a tool takes, what it returns, or the order to call them in.

The server is at `https://api.<platform-domain>/mcp` (Streamable HTTP, stateless). Every call runs as the signed-in person and is written to the activity log as made by an agent. Tool descriptions are sent to the client too; this file covers the workflow and the parts the descriptions leave out.

## Beyond tools

The server also offers:

- **Resources.** `skill://<name>/<path>` for the skills, their references and the worked example apps (`skill://index` lists them all); `platform://reference/<name>` for the platform's lists (`platform://reference/index`).
- **Tools for clients that do not read resources.** `read_skill` (skill and path) and `read_reference` (name; empty for the index).
- **Prompts** a client may show as a menu: `deploy_folder`, `share_safely`, `debug_failed_deploy`, `add_sign_in`. Each is a short request that points back at these skills.

## Calls in order, for one deploy

```
check_manifest (optional)   -> problems, warnings, settings
deploy (code, no settings)  -> Live, or needs_confirmation + confirm_token + draft
  ... show the draft to the person, collect edits ...
deploy (same code, confirm_token [, manifest]) -> Live: <url>
describe_project            -> confirm address, visibility, live version
set_visibility              -> only after the person chooses
share                       -> only after the person names the people
```

## Deploying

### `deploy`

Inputs (send exactly one of the code inputs):

| Input | Use when |
| --- | --- |
| `tarball_base64` | the project is small. Base64 of a `.tar.gz` with relative paths, no `node_modules` or `.venv`. The size limit is shown in the tool's description. |
| `upload_id` | the project is too big. Get it from `get_upload_url` first. |
| `source_url` | the archive is at a public `https` address. |

A sealed `.cohostly` file is sent the same way (`get_upload_url`, upload, `deploy` with `upload_id`): its own settings and secrets are used. See `snapshot.md`.

Other inputs: `project` (required, lowercase letters, numbers and dashes, it becomes the address), `manifest` (text of a `cohostly.json`), `confirm_token`, `skip_confirmation`.

Replies:

- **No settings file, first call:** Railpack plans the build. When every setting was read from the files and none is risky, it goes live and the reply lists the settings with their `source`. Otherwise `status: needs_confirmation`, a `confirm_token`, `expires_in_s`, and a `draft` of the settings with reasons. Nothing is online yet.
- **Confirmed:** `Live: <url>` with `stages` (uploading, building, starting, live).
- **Failed:** the first line is `code: <code>`, so you can act without reading prose; then the stage it stopped at, the cause, and what to do. The codes and their fixes are in `troubleshooting.md`. Pass the plain sentences on to the person.

Rules:

- Redeploying the same name creates a new version. If the changes affect saved settings, you get a new draft to confirm, not a live deploy.
- The `confirm_token` expires; if it does, call `deploy` again to get a fresh one.
- A project name someone else owns returns "already taken". Do not try another name without asking the person.

### `get_upload_url`

Returns a one-time `upload_url`, `upload_id` and `expires_in_s`. Send the archive with an HTTP `PUT` (the reply gives a `curl` line: `curl -X PUT -H "Content-Type: application/gzip" --data-binary @project.tar.gz "<upload_url>"`), then call `deploy` with the `upload_id`. Plain `curl -T` also works. The upload id is removed after a successful deploy.

### `check_manifest`

Input: `manifest` (JSON text). Use `"{}"` to see every standard setting. Returns `valid`, `problems`, `warnings`, `notes` and `settings` (each with its source). Read-only.

### `check_code`

Input: `project` and `files` (a map of path to TypeScript source). Type-checks against the project's contract, so a wrong argument or a model the manifest does not allow is caught before deploying. Use it when you are writing code that uses platform bindings; see `cohostly-app-code`.

## Looking

| Tool | Returns |
| --- | --- |
| `list_projects` | Each project's name, address, visibility, live version and the person's role. |
| `describe_project` | Address, visibility, live version, the settings it runs with, version count, and who it is shared with (admins only). Use this to confirm what is actually set. |
| `list_versions` | Every version newest first, with status and which one is live. Failed deploys are listed too. |
| `describe_context` | What a project tells its app about each kind of visitor. Optional `project`, or a `preset` to preview. |
| `describe_bindings` | Which platform services the project declares and when they were last used. |
| `describe_data` | Tables and row rules for the managed database. Never shows rows or addresses. |
| `get_contract` | The typed calls the app can make through `platform`, for a project that has a live version. |
| `preview_contract` | The same typed calls for a settings file (and its migrations) before anything is deployed: send `cohostly.json` and, for managed data, the migrations, and write the reply to `platform.gen.ts`. |
| `usage` | Counts of projects, deploys and backups over `days`. |
| `get_logs` | The app's recent output (owners and editors). Give `since` to read only new lines. |
| `list_connections` | The connections the manifest asks for, connected or not, the account, permissions and file limits. `available` lists the connected accounts of the project's own account only; when it is empty, `note` says which account that is and `connected_in_other_accounts` where the person's connections are. |
| `describe_connection` | One connection in plain words: whose account it acts as, what it may do, and the connect page for `access: "user"`. |

## Changing

| Tool | Notes |
| --- | --- |
| `promote` | `version` (number). The version must have built successfully. |
| `rollback` | Makes the version that was live before the current one live again. |
| `grant_connection` | Gives an account connection to a project's binding (project admins). Confirm the permissions and files with the person. You cannot connect or disconnect an account; a person does that in the dashboard. |
| `set_visibility` | `private`, `account`, `link` or `public`. Confirm with the person first. The reply restates what the level means. |
| `share` | `email`, `role` (`viewer` default, `editor`, `admin`). An unknown email gets a `pending` invitation that activates when they sign up. Confirm role with the person. |

## Secrets and tokens

| Tool | Notes |
| --- | --- |
| `list_secrets` | Names, when each changed, who set it, and which secrets the settings ask for but nobody has set. Never values. |
| `request_secret` | Returns a secure link (works once, 15 minutes). The person types the value there. You never receive the value. |
| `share_secret` | Moves a project secret to the whole account. Owners and admins only. |
| `delete_secret` | Refused while the live version still needs it. Destructive; confirm first. |
| `list_tokens` | Dev tokens (hints only) and whether the running app's token is healthy. |
| `request_dev_token` | Gives a token for one project, dev environment only, shown once. Print it only to the environment of code you are running, never into the chat log or a file that gets committed. |
| `revoke_token` | Ends a dev token now. Destructive. |
| `rotate_sandbox_token` | Restarts the running app with a new token. The old one works about 10 minutes more. Destructive. |
| `start_dev_session` | Explains how the person runs the project on their own machine. Starts nothing. |

See `secrets-and-tokens.md`.

## Writing for the person

The tool descriptions were written for a reader who has never heard of Cohostly. Keep to that register:

- Say "your app is live at <url>", not "the sandbox is running at".
- Say "only people you share it with can open it", not "private visibility".
- When a tool says "Nothing is online yet", say that too. Do not describe the draft as a deploy.
