---
title: Who sees and answers
description: "Who can see a request, who can answer it, where they answer, how high-risk requests are handled, and how Always allow rules work."
nav: Who decides
---

Your app asks. This page explains who is on the other side: who gets told, who may answer, and where.

## Who can see a request

A request is visible to its **approvers**, and to the editors and admins of the project.

## Who may decide

The rule for a request is fixed when it is made. The choices are `owner`, `admins` (the default), `editors` or `named` people. With no rule saved for the project, an app action goes to the project owner, the account's owners and admins, and project collaborators with the admin role.

Eligibility is checked **when the person decides**, not when the request is made. Someone removed from the project after an email went out can no longer decide.

A project can also set:

- **More than one approver.** `required` can be 1 to 5. One denial still denies the request at once.
- **Escalation.** If a rule sets `escalate_after_seconds` (at least 60, and less than the expiry), then the account's owners and admins also become approvers after that time, and are told.
- **A different expiry per action.** A rule's `expires_in_seconds` changes the default (60 seconds to 7 days).

> **Careful** The project approval rule (who decides, how many approvers, escalation, expiry per action) and "Block this tool" can be set **only through the platform's API** today. There is no screen for them in the dashboard, no command in the CLI, and no AI assistant tool. An error message may point you to "dashboard (Approvals, Blocked)". That screen does not exist yet. See [errors](approvals-errors.md), `approval_blocked`.

## Where people answer

| Where | What you can do there |
| --- | --- |
| Dashboard, `/approvals` | An inbox with the tabs Needs me, Waiting and History. Search. Approve or deny, with a note. Bulk approve for low-risk app actions. Withdraw. Always allow rules. "Away" delegation. A per-kind "who decides" setting under Advanced. |
| Command line | `cohostly approvals ...`, listed below. |
| In-app notice | One notice per approver, updated live. |
| Daily digest | Optional. It also lists what is waiting. |
| AI assistant | Tools to list approvals and to decide them. |
| Email | One email per approver. The link opens a confirmation page. Opening it never decides anything, the answer is a separate button press. The link works once and lasts up to 24 hours, or until the request expires if that is sooner. |
| Telegram | A person links a chat. Low and medium risk requests get Approve and Deny buttons. High risk gets only an "Open to decide" button. |

> **Careful** Email and Telegram depend on how your platform is set up. Check with whoever runs your platform that they are switched on before you promise them to your team. The dashboard, the CLI and in-app notices do not depend on that.

Approval messages ignore a person's mute and digest settings, so a request is not silently held back.

## The command line

```sh
cohostly approvals [needs-me|waiting|history] [--project <project>] [--json]
cohostly approvals show <id>
cohostly approvals approve <id> [--note <text>]
cohostly approvals deny <id> [--note <text>]
cohostly approvals bulk <id> <id> ... [--deny] [--note <text>]
cohostly approvals rules <project>
cohostly approvals allow <project> <action> --per-request <n> --per-day <n> [--days 30] [--unit <unit>]
cohostly approvals revoke-rule <project> <rule>
cohostly approvals away [<email> [--days 7]]
cohostly approvals end <delegation>
```

- `approve` and `deny` first fetch the request and send its `details_hash` back, so the answer is tied to exactly what is on screen.
- `show` prints what the app wrote, why it was asked, what happens now and if approved, the status, and who can decide.
- `waiting` lists what **you** asked for. A request raised by an app has no person who asked, so it is not expected to appear there.
- Logging in with a service key counts as an AI or service channel (see below).

## People cannot be their own approver, with one exception

For the platform kinds (deploy, make public, spend or limit raise), the person who asked cannot decide while another eligible person exists.

For an **app action** the platform does not record a person as the asker, so the person whose click made the app ask **can** approve it. Do not rely on approvals as a two-person rule for app actions unless your rule picks other people.

## Requests raised by an AI assistant or service key

A request made through an AI assistant or a service key cannot be decided through an assistant channel (the assistant tool, a service key, or a development token). A person has to answer: in the dashboard, with their own CLI sign-in, or by email or Telegram (not for high risk).

The platform knows who or what made the request from the signed request context your app forwards. An app that does not forward the visitor's context is recorded as an app.

## High-risk requests

A request with `risk: 'high'` is held to a stricter standard:

- It cannot be covered by an Always allow rule.
- It cannot be part of a bulk decision.
- It cannot be decided from an email or Telegram link. The person must use the dashboard or the CLI while signed in.

## Always allow

An **Always allow** rule lets a project say "for this action, do not ask me every time, up to a limit". What is verified about it:

- It applies to **app actions** only, per project and per action key.
- It has a limit per request and a limit per day. The amount is counted from `details.quantity` in your request. If `quantity` is missing or not a number, it counts as 1. A value of 0 or less counts as 1.
- It lasts 1 to 90 days. The CLI default is 30. You can revoke it at any time.
- Only a project admin can create or revoke one. An AI assistant cannot.
- It never covers high-risk requests.
- It never covers a connection write that was held for approval.
- The platform cannot check that the app did only what it declared.

> **Careful** This page makes no promise about what your app sees when a request matches an Always allow rule. Do not build a flow that depends on it until the platform team confirms how it behaves for apps.

## Delegation ("away")

A person can hand their decisions to a member of a shared account. It lasts at most 30 days (7 by default in the CLI) and ends by itself. An AI assistant cannot create one.

## Bulk decisions

Up to 25 requests at once, only low-risk app actions, and all of the same kind.

## Audit trail

Every request keeps an append-only list of events, such as requested, decided, expired, cancelled, escalated, blocked, rate limited, notified, callback delivered and callback failed. Project admins can export it as JSON or CSV.

## Blocks

An owner can block one action, or the whole app, from asking. A blocked app gets `approval_blocked`. Adding a block cancels the requests that are open. Blocks can be set only through the API today.
