---
title: Approvals
description: "One inbox for everything waiting on a person: list, read, approve, deny, decide in bulk, make always-allow rules, and hand your decisions to someone else."
nav: Approvals
---

`cohostly approvals` is one inbox for every request that waits on a person. Think of the "in tray" on a manager's desk. Some papers are for you to sign, some are yours waiting on someone else, and some are already filed.

Deploy requests held by a [ship policy](ship.md) also show up here. For how an app raises its own requests, see [the approvals binding](../bindings/approvals.md).

## Usage

```bash
cohostly approvals [needs-me | waiting | history] [--project <name>] [--json]
cohostly approvals show <id>
cohostly approvals approve <id> [--note <text>]
cohostly approvals deny <id> [--note <text>]
cohostly approvals bulk <id> <id> ... [--deny] [--note <text>]
cohostly approvals rules <project>
cohostly approvals allow <project> <action> --per-request <N> --per-day <N> [--days <N>] [--unit <word>]
cohostly approvals revoke-rule <project> <rule>
cohostly approvals away [<email> [--days <N>]]
cohostly approvals end <delegation>
```

The three tab commands take `--project` as a **filter**. `rules`, `allow` and `revoke-rule` take the project as a plain word.

## The tabs

| Command | Description |
| --- | --- |
| `needs-me` | Everything waiting for you to decide. This is the default. Empty: `Nothing is waiting for you.` |
| `waiting` | What you asked for that is still waiting on someone else. Empty: `You are not waiting on anyone.` Requests raised by an app, with no person behind them, do not appear here. |
| `history` | What has been decided. Empty: `No history yet.` |

## show

```bash
cohostly approvals show <id>
```

Prints one request in the platform's own words:

```
<id>  [<risk>]  <headline>
  The app wrote: <the app's own sentence>
  Why: ...
  Now: ...
  If approved: ...
    - <change>
  <status>[, open until YYYY-MM-DD][, decided by X for Y (channel)]
  Can decide: A, B
```

The headline is written by the platform. What an app wrote is shown **apart**, after `The app wrote:`, so an app cannot dress its own words up as the platform's.

## approve and deny

```bash
cohostly approvals approve <id> --note "checked the diff"
cohostly approvals deny <id> --note "not this week"
```

The CLI fetches the request and prints it, then sends your decision with the request's fingerprint (a short hash of its details). If the request changed after you read it, the platform refuses: `This approval changed since you opened it, so your answer was not recorded. Open it again and check what it says now.` Nothing asks you to confirm.

The answer is the platform's note, for example `Your answer is recorded. 1 of 2 approvers have approved.` or `This approval is now approved.`

> **Careful** A request carries a fingerprint so a decision cannot be applied to something that changed. Always read `show` first.

## bulk

```bash
cohostly approvals bulk <id> <id> <id> [--deny] [--note <text>]
```

Decides several requests in one go. Up to **25**, all **low-risk app actions**, all of the same kind. Otherwise: `Only low-risk app actions can be decided together. Decide these one at a time: <ids>.` It prints one line per id: `<id>  <status>` or `<id>  not decided: <error>`.

## rules, allow and revoke-rule

An **always-allow rule** lets a narrow kind of app action pass without asking you each time.

```bash
cohostly approvals allow shop send_email --per-request 5 --per-day 20 --days 30 --unit emails
cohostly approvals rules shop
cohostly approvals revoke-rule shop <rule>
```

| Flag | Type | Description |
| --- | --- | --- |
| `--per-request <N>` | number | **Required.** The most one request may ask for. |
| `--per-day <N>` | number | **Required.** The most the rule allows in a day. At least `--per-request`. Without both: `A rule needs --per-request and --per-day, so it stays narrow.` |
| `--days <N>` | number | How long the rule lasts. Default 30. The platform allows 1 to 90. |
| `--unit <word>` | text | What is being counted, such as `emails`. |

- The action key is lower-case letters, digits and `. _ : -`.
- Making or revoking a rule needs a **project admin**. An assistant cannot make one.
- A rule never covers a high-risk request.
- `allow` prints the rule as a sentence, for example `tool may send email up to 20 emails a day.`
- `rules` lists `<id>  active|ended  <sentence>  (N used today)`.

## away and end

```bash
cohostly approvals away alex@example.com --days 14
cohostly approvals away
cohostly approvals end <delegation>
```

`away <email>` hands your decisions to someone for a while. The default is 7 days and the most is **30**. The person must already have an account and share one of your accounts, and cannot be you. It ends by itself. `away` with no email lists those you gave and those you received (`<id>  you -> <to>, until <date>`). `end <id>` prints `Your decisions are yours again.` An assistant cannot start a handover.

## What kinds of request exist

| Kind | Raised when | Decided by (default) | Open for |
| --- | --- | --- | --- |
| `deploy` | A deploy under a policy that holds new versions. | Project admins, including the project owner and account owners and admins. | 7 days |
| `make_public` | A person who is not an account owner or admin widens who can open an app. | Account owners and admins. | 7 days |
| `spend_raise` | A project's monthly AI limit is to be raised. | Account owners and admins. | 7 days |
| `app_action` | A running app asks a person to confirm something. | Project admins. | 1 day by default. An app may set 60 seconds to 7 days. |

`access_request` exists as a name but nothing can create one yet.

## Rules the platform enforces

- A request is refused if you are not eligible, it was already decided, or its details changed since you read it.
- **No self-approval** applies to `deploy`, `make_public` and `spend_raise`: the person who asked cannot decide it while another eligible person exists. It does not apply to an app's own request, where the person whose click triggered the app can approve it.
- A request made by an assistant or a service key cannot be decided by an assistant or a service key.
- **High-risk** requests (`make_public`, `spend_raise`) cannot be in a bulk decision or an always-allow rule. Only decisions from **email and Telegram links** are refused for them. The CLI and the dashboard can decide them.

> **Careful** Deploy requests have a separate quirk. A deploy made from the CLI is made by a key, and a key cannot approve a deploy request another key made. Approve those in the dashboard. See [ship](ship.md).

## Files read and written

None. Uses the saved key (or `PLATFORM_API_KEY`) and `API_URL`. Decisions are recorded with the channel `cli`. A network failure prints `Fatal: TypeError: fetch failed`.

## Exit codes

`0` on success, `1` on any failure, including a refused decision.

## Examples

See what needs you, then read and approve one:

```bash
cohostly approvals
cohostly approvals show <id>
cohostly approvals approve <id> --note "looks right"
```

Clear three routine requests together:

```bash
cohostly approvals bulk <id1> <id2> <id3>
```

Cover for a week of leave:

```bash
cohostly approvals away alex@example.com --days 7
```

## Related pages

- [Ship](ship.md): the deploy side of approvals.
- [Approvals binding](../bindings/approvals.md): how apps raise requests.
- [Who decides](../bindings/approvals-who-decides.md): deciders and separation of duties.
