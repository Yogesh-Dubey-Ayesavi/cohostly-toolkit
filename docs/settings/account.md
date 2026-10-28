---
title: The account
description: What belongs to the account instead of one project, and who decides.
nav: Account
---

An **account** is the workspace that owns projects. Each person in it is an `owner`, an `admin` or a `member`.

## What belongs to the account

| Thing | What to know |
| --- | --- |
| Secrets | A secret normally belongs to one project. `cohostly secrets share` moves it to the whole account so other projects can use it. Only owners and admins can. |
| AI provider keys | Needed for models the platform does not provide. Only owners and admins can add them. See [AI](../bindings/ai.md). |
| Connections | Links to outside services (Google, Microsoft) that apps use. Removing a person from a project ends the connections they made to it. |
| API keys (`plk_...`) | Scoped to the whole account or to one project, and made by a person. |
| Activity | The account's log of who changed what. |
| Approval rights | Who may approve opening an app wider, or raising a spending limit. |
| Usage | Counts projects, deploys and backups. Compute time and AI spend are not measured everywhere yet. |

## Requests that wait for a person

Some changes are held until the right person approves. Each is one kind of request, and an account can change who decides under Approvals, Advanced in the dashboard. The kinds are listed in [jobs and approvals](../cli/jobs-and-approvals.md#what-kinds-of-request-exist).

There is also an `access_request` kind (a person asking to open an app) that exists but is not active yet. Do not promise it.

## What these docs do not cover

Creating an account, billing, inviting members at the account level, promoting or removing members, and how many accounts one person can have are done in the dashboard. Pricing is not set: costs shown are estimates.

## Custom domains and limits

See [sharing](../cli/sharing.md#cohostly-domains) for domains and [limits](../limits/limits.md) for what an account may run at once.
