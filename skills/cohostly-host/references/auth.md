# Sign-in, keys, visibility and roles

Read this before sharing a project, changing who can open it, or connecting a client, machine or CI job. Most "why can't they open it?" questions are answered here.

## Who is calling, and how they prove it

There are three kinds of caller. Pick the right one; using a person's key in CI, or a shared key in a chat, is the most common mistake.

| Caller | How they sign in | Where the credential lives |
| --- | --- | --- |
| **A person using an MCP client** (Claude Code, Claude Desktop) | OAuth sign-in once in the browser, then a consent screen. The client gets a token for that one app address. Access tokens last 30 minutes; refresh tokens 30 days and rotate. | The client stores the token. Nothing to paste. |
| **A person using the CLI** | `platform login` runs a device flow: a code appears in the terminal, they approve it in the dashboard at `/cli-login`, and the key is handed over once. Or `platform login --token plk_...` with a key they made in the dashboard. | `~/.config/cohostly/credentials.json`, mode 600. The server keeps only a hash. |
| **Automation or CI** | An API key (`plk_...`) for the account or one project, made by a person. | The CI secret store. Never the repo. |

Rules to repeat to the person when relevant:

- A key is shown once. If it is lost, make a new one and end the old one.
- Ending a person's access (removing them from a project) also ends the connections they made to that project's tools.
- Do not put a key in a manifest, a commit, an environment file in the repo, or a chat.

## Visibility: who can open the app's address

| Level | Who can open the app |
| --- | --- |
| `private` | Only people the project is shared with, and the account's owners and admins. |
| `account` | Any signed-in member of the owning account. |
| `link` | Anyone who has the address. The address has a random suffix, so it cannot be guessed, but anyone holding it can open it. |
| `public` | Anyone on the internet, and it may be listed. |

Defaults, and a trap to check:

- The **manifest** default is `link` (`packages/image-builder/src/defaults.ts`).
- The **project record** defaults to `private` in the database.
- These are not reconciled in code yet. After a first deploy, call `describe_project` and read the visibility it reports. If it is not what the person wants, call `set_visibility`. Do not assume.

Also note: the manifest schema accepts only `private`, `link` and `public`. `account` works through `set_visibility` and the dashboard but a manifest that sets it fails validation. If the person wants account-wide access, set it with `set_visibility` after the deploy, not in the manifest.

Changing to `public` or `link` is a decision for the person. Say what it means in one sentence first: "anyone with the link can open it, and it can be found by anyone if public".

Access checks happen on every request at the proxy. A change takes effect within about 30 seconds, usually at the next request. A browser that is not signed in is sent to sign in; a script or a signed-in stranger with no access gets a plain "not found", so the app does not reveal that it exists.

## Roles

On a project:

| Role | Can |
| --- | --- |
| viewer | Open the app, see the page and the version list. |
| editor | Also deploy, promote, roll back, change the manifest, see build details and logs. |
| admin | Also change sharing and visibility. |

On an account: `owner`, `admin` or `member`. Account owners and admins can act as admin on every project in the account and can delete. A plain member sees a project only when its visibility is `account`, or when they were invited.

When sharing, pick the lowest role that does the job. `viewer` is the default for a reason. Ask before giving `admin`.

## Sharing by email

`share` takes an email. If the person already has an account, they get access at once. If not, they get an invitation that expires after 14 days and activates when they confirm their address. Repeating the invitation changes the role. Tell the person that an invitation is pending; do not say they have access.

## What an app's visitors can see

The platform tells each app who is calling, in signed headers and a token. This is not a credential the app should store, and the visitor's network address is never passed on. The app side is in `cohostly-app-code/references/context.md`. Use `describe_context` to show the person exactly which fields an app receives before they decide.

## Connecting a client (for the person)

When a person adds a Cohostly app's address to an MCP client, they sign in and approve once. If the client says it needs sign-in, the person has not connected yet, or their access was removed. Explain both options in plain words and let them choose; do not offer to create a key to get around a refused sign-in.
