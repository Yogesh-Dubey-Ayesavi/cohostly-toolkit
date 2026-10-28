---
title: Approval kinds
description: "The kinds of approval, who may decide each one, how long each stays open, and what happens when it is approved, denied or left to expire."
nav: Kinds
---

Every approval has a **kind**. The kind decides who may answer, how long the request stays open, and what the platform does when it is approved. Your app raises only one kind, **App action**. The others are raised by the platform when a person or an AI assistant does something that needs a second pair of eyes.

Every kind ends in one of the same ways: approved, denied, or expired. **Expiry always fails closed.** An expired request is never treated as approved.

## How a request is worded

The platform writes the headline of every request from structured fields. What your app wrote in `summary` and `details` is shown apart, under a label that says it was written by the app and not by Cohostly. It never goes inside the headline. The one exception is your `action` key, which can appear in the headline, limited to lower-case letters, digits and `. _ : -`.

When a second request is raised about the same thing (a newer deploy, a second visibility change, a second limit raise), the first is closed as `superseded`. A superseded request cannot be answered. Your app never sees this status.

Reminders: one reminder goes out when a quarter of the time is left, at most 6 hours before the end.

## App action

**Label:** App action.

**Raised by:** a running app, through the approvals binding. A connection write held by `require_approval_for_writes` also raises one, with the action key `connection.write` (see [write approval](connections-write-approval.md)).

**Who may decide:** the project's own approval rule. With no rule saved, that is the project owner, the account's owners and admins, and project collaborators with the admin role.

**Open for:** 24 hours by default. Your request can ask for 60 seconds to 7 days with `expiresIn` (`expires_in` over HTTP). A project rule can change the default.

**Risk shown:** what your request said. `low`, `medium` (shown as "normal") or `high`.

- **On approve:** the status becomes `approved`, and the callback is sent if you registered a `callback_path`. **Your app does the action itself.**
- **On deny:** the status becomes `denied`, and the callback is sent.
- **On expire:** the status becomes `expired`, and the callback is sent. The check runs every minute, so the callback goes out within about a minute. Asking for the request by `id` reports `expired` straight away.

## Deploy or promote

**Label:** Deploy or promote.

**Raised by:** a teammate or an AI assistant deploying under a deploy policy that holds new versions.

**Who may decide:** project admins, the project owner, and the account's owners and admins. The account can change this to account admins only, or to named people.

**Open for:** 7 days.

**Risk shown:** normal. It is shown as `high` if the change widens who can open the app.

- **On approve:** the held version goes live.
- **On deny:** the version stays unreleased.
- **On expire:** the version cannot be approved later. Deploy again. A request for old code is also closed when a newer version goes live.

## Make public

**Label:** Make public.

**Raised by:** a project admin who is not an account owner or admin, or an AI assistant, who widens an app's visibility to `signed_in`, `link` or `public`.

**Who may decide:** the account's owners and admins. The account can change this.

**Open for:** 7 days.

**Risk shown:** always `high`.

- **On approve:** visibility is set to what was asked for (`link` stays `link`). If more than a day passes between the approval and the change being applied, it is not applied.
- **On deny:** visibility is unchanged.
- **On expire:** visibility is unchanged.

## Spend or limit raise

**Label:** Spend or limit raise.

**Raised by:** an owner or an AI assistant raising a project's monthly AI limit above its current value.

**Who may decide:** the account's owners and admins.

**Open for:** 7 days.

**Risk shown:** always `high`.

- **On approve:** the raised limit is recorded and the cost page shows it.
- **On deny:** the limit is unchanged.
- **On expire:** the limit is unchanged.

> **Careful** Approving a limit raise currently changes what the cost page shows. The AI gateway's own limit check does not read the raised value yet. Do not count on an approval to let a project spend more.

## Access request

`access_request` is reserved. Nothing raises it today, so you will not see it.

## What you can rely on in your app

Your app sees only the `app_action` kind. The other kinds appear in the dashboard and command line, not in the binding.

- Approved needs the required number of approving decisions. The default is 1. One denial denies the request at once.
- The same person cannot decide twice on one request.
- The platform kinds (deploy, make public, spend or limit raise) allow no more than 10 requests per kind, per project, per hour.

See [who sees and answers](approvals-who-decides.md) for the people, and [limits](approvals-limits.md) for the numbers.
