---
title: cohostly ship
description: Hold new versions until an admin approves them, and approve, deny or withdraw them from the command line.
nav: Ship
---

By default, anyone who can deploy can release a new version. `cohostly ship` lets a project hold new versions at the door until an admin says yes. Think of a shop where staff can stock the shelves in the back room, but a manager must open the curtain.

## Usage

```bash
cohostly ship <project>
cohostly ship requests <project>
cohostly ship approve <project> <request> [--note <text>]
cohostly ship deny <project> <request> [--note <text>]
cohostly ship withdraw <project> <request>
cohostly ship policy <project> [direct|approve_all|approve_risky]
```

The project is a **positional** argument here. `--project` is not accepted and stops with `I do not know "--project".`

| Flag | Type | Description |
| --- | --- | --- |
| `--note <text>` | text | A short reason, saved with `approve` or `deny`. |
| `--json` | on or off | Print the raw answer for a script. Default off. |

### Who may run it

| Subcommand | Role needed |
| --- | --- |
| `requests`, `policy` (viewing) | editor |
| `policy <mode>` (changing) | admin |
| `approve`, `deny` | admin |
| `withdraw` | editor for your own request, or admin |

## Policies

| Policy | Meaning |
| --- | --- |
| `direct` | Every deploy goes live. |
| `approve_all` | Every new version waits for an admin. |
| `approve_risky` | Only versions with risky changes wait. The request lists the changes in plain words. |

```bash
cohostly ship policy hello approve_risky
```

It prints the policy's label, then `It applies to the next deploy.` Run `ship policy hello` with no mode to see the current one.

## See what is waiting

```bash
cohostly ship requests hello
```

Each line is `<id>  version <N>  <status>  (until YYYY-MM-DD)  <summary>`, with `(yours)` added to requests you made. When there is nothing, it prints `Nothing is waiting for approval.`

A request stays open for **7 days**. After that it expires and cannot be approved. Deploy the code again.

## What a held deploy looks like

When a deploy is held, `cohostly deploy` tells you the version is built and waiting, lists the risky changes, and says visitors keep seeing the live version. A held version shows as "Not released" until decided. `promote` and `rollback` skip it.

## Approve, deny or withdraw

```bash
cohostly ship approve hello <request> --note "checked the change"
```

| Subcommand | What it prints |
| --- | --- |
| `approve` | `Version N is going live. Visitors will see it within about 15 seconds.` |
| `deny` | `Version N was not approved. Visitors keep the version they had. You can deploy the code again.` |
| `withdraw` | `Version N was withdrawn. It stays as Not released.` |

None of these ask you to confirm. They act at once.

### Rules the platform enforces

- A request that is no longer pending is refused: it expired, was replaced by a newer version, or was already decided.
- A request for code older than what is live is closed. The message says the newer version is already live.
- The person who made a request cannot decide it when another admin exists: `You made this request, so another admin has to decide it. You can still withdraw it.` If they are the only admin they may approve it, and it is recorded as self-approved.

> **Careful** At the moment, `cohostly ship approve` is refused for a version that was deployed with the command line. The platform treats a deploy from the CLI as made by a service key, and the answer is `An AI assistant or a service key cannot decide a request that an assistant or a service key made. A person has to decide it in the dashboard.` The deploy output still suggests `ship approve`. Approve those versions in the dashboard. `ship approve` works for requests made by people in the dashboard. Also, if your key has no person behind it, you get `This access key has no person behind it, so it cannot decide deploy requests.`

The same requests also appear in [approvals](approvals-command.md).

## Exit codes

`0` on success, `1` on any failure, including a refused decision.

## Examples

Hold only the risky releases, then look at the queue:

```bash
cohostly ship policy hello approve_risky
cohostly ship requests hello
```

Take back your own request:

```bash
cohostly ship withdraw hello <request>
```

Deny with a reason, as JSON:

```bash
cohostly ship deny hello <request> --note "not before Friday" --json
```

## Related pages

- [Deploy](deploy.md): what a held deploy prints.
- [Approvals](approvals-command.md): the one inbox for everything waiting on a person.
- [Share](sharing.md): who can open the app.
