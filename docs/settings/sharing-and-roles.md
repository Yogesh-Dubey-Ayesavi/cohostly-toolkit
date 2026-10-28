---
title: Sharing, sign-in and roles
description: Who can open your app, how they prove who they are, and what each role may do.
nav: Sharing and roles
---

## Three kinds of caller

| Caller | How they sign in | Where the credential lives |
| --- | --- | --- |
| A person using the CLI | `cohostly login` shows a code, they approve it in the dashboard, and a key is handed over once. Or `cohostly login --token plk_...` with a key they made. | `~/.config/cohostly/credentials.json`, readable only by them. The platform keeps a hash. |
| A person using an AI assistant | They sign in once in the browser and approve a consent screen. Access lasts 30 minutes and refreshes for up to 30 days. | The assistant stores it. |
| A script or CI job | An API key (`plk_...`) for an account or one project, made by a person. | The CI secret store. Never the repository. |

Using a person's key in CI, or sharing one key in a chat, is the most common mistake. A key is shown once. If it is lost, make a new one and end the old one. Removing a person from a project also ends the connections they made to it.

## Who can open an app

See [the share command](../cli/sharing.md) for the five levels: `private`, `account`, `signed_in`, `link` and `public`. In short, pick the narrowest one that does the job.

Checks happen on every request, at the edge. A change takes effect within about 30 seconds. A browser that is not signed in is sent to sign in. A script, or a signed-in stranger with no access, sees a plain "not found".

### An app with its own login

If your app has its own sign-in (Supabase, Firebase, Auth0, NextAuth), choose carefully. Cohostly's checks come first.

| Visitors are | Use | Set visibility to |
| --- | --- | --- |
| People you invite, who will have Cohostly accounts | The platform's sign-in | `private` |
| Everyone in your team's account | The platform's | `account` |
| Anyone with a Cohostly account | The platform's | `signed_in` |
| Anyone with the link, who may sign in to be recognised | The platform's, optional (`middleware({ required: false })` and `loginUrl()`) | `link` or `public` |
| Customers or the public who sign up in your app | The app's own | `public` (or `link` while testing) |
| A program, not a person | An access key | `private`, one key per sender |

- **Do not put your own login behind the platform's.** At `private`, `account` or `signed_in`, an anonymous visitor is stopped before your app, so they never see your login page. Own login needs `public` or `link`.
- **Pick one source of truth for "who is this".** With platform sign-in the key for a person is `caller.id`. With your own login it is your user's id. Do not mix them for the same decision.
- **People on your own login are anonymous to the platform.** They have `caller.kind` of `anonymous`, so a database rule such as `owner(user_id)` cannot see them. Use `$app` and your own checks.
- **Tell your login provider the app's address.** The default address ends in a random piece and changes if the link is reset, so for a login that matters, use a [custom domain](../cli/sharing.md#cohostly-domains).

## Roles

On a project:

| Role | Can |
| --- | --- |
| `viewer` | Open the app, see the page and the version list. |
| `editor` | Also deploy, promote, roll back, change settings, and see build details and logs. |
| `admin` | Also change sharing and visibility. |

On an account there are `owner`, `admin` and `member`. Owners and admins act as admin on every project in the account and can delete. A plain member sees a project only if its visibility is `account` or they were invited.

When sharing, pick the lowest role that does the job. `viewer` is the default for a reason.

## Invitations

`cohostly share invite` with an email gives a person with an account access at once. Otherwise it sends an invitation that expires after 14 days. Until they confirm, they do not have access.

## Widening is held for the right person

Moving an app to `signed_in`, `link` or `public` is held as a request when the person asking is not an account owner or admin. The app stays exactly as it was until an owner or admin approves. Deciding it requires being signed in to the dashboard. Narrowing takes effect at once.
