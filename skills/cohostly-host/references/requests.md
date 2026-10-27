# Requests that wait for a person: approvals, deploy requests, spend limits

Read this when a deploy, a visibility change or a spend raise answers "waiting for approval", or the person asks what is waiting for them.

## The rule that matters most

**A person decides, not you.** Only call a decide tool after the person has told you, in this conversation, what to do about *this specific request*, having seen its summary and details. Read the request out to them as written first. You cannot decide a request that an AI assistant or a service key made, and nobody approves their own request when another admin exists; those have to be decided in the dashboard, by email or in Telegram.

## Approvals (any kind)

- `list_approvals` shows what is waiting, each with a summary, details and a `details_hash`.
- `decide_approval` with `decision: "approve"` or `"deny"`, an optional note, and the `details_hash` exactly as listed. A changed request has a new hash, so a decision cannot be applied to something the person did not see.
- A high-risk request (opening an app wider, raising a spend limit) can only be decided after the person signs in to the dashboard. Give them the link.

## Deploy requests

When a deploy policy holds new versions for an admin, the version stays "Not released" until decided.

- `list_deploy_requests` (optionally `status`: `pending`, `approved`, `denied`, `withdrawn`, `expired`) shows the version, who made it, the plain-English changes, which are risky and when it expires. Show the person the changes as written.
- `decide_deploy_request` approves (live within about 15 seconds) or denies (stays Not released).

## Raising a project's AI limit

`request_spend_raise` asks for a higher monthly limit (`monthly_usd`, higher than the current one, with a one-sentence `reason` the approver reads). It does **not** raise it: an owner or admin approves in their inbox and the limit stays as it is until then. Give the person the link in the reply, and never tell them it is raised.

## Opening an app wider

`set_visibility` to `signed_in`, `link` or `public` is held the same way for anyone who is not an account owner or admin (`auth.md`). The answer is `awaiting_approval` with a link: relay it, and say the app is unchanged.
