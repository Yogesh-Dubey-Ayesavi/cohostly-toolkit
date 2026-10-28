---
title: Holding writes for approval
description: "Make every change wait for a person's yes. The call answers 202 with an approval_id, and you send the same request again once it is approved."
nav: Holding writes for approval
---

Some changes should have a human nod first: sending email, deleting rows, posting to a team. A connection can hold every change until a person approves it.

Turn it on in the manifest, or have the person who gives the connection to the tool turn it on for the grant. Either one is enough.

```json title="cohostly.json"
{
  "bindings": {
    "connections": {
      "mail": {
        "provider": "google-workspace",
        "permissions": ["gmail.read", "gmail.send"],
        "access": "user",
        "require_approval_for_writes": true
      }
    }
  }
}
```

When it is on, a visitor connecting sees "Anything that changes something waits for your OK first." on the connect page.

## What counts as a write

- **Held:** a call that changes something. For a broad permission, that is any method other than `GET` and `HEAD`. For a permission that only sends, such as `gmail.send`, it is that send.
- **Not held:** reads. That includes the `POST` calls that only read, such as Sheets lookups by data filter, Calendar `freeBusy`, Outlook `getSchedule` and `findMeetingTimes`, and Drive activity queries.

The type column in the [Google](connections-google-permissions.md) and [Microsoft](connections-microsoft-permissions.md) tables tells you which kind of permission you have.

## How the hold works

The first time the write is sent, **nothing goes to the provider**. The platform makes an approval and answers with HTTP status `202`:

```json title="The 202 answer"
{
  "approval_id": "8f0c2a1e-0000-0000-0000-000000000000",
  "status": "pending",
  "expires_at": "2026-11-01T09:00:00Z",
  "message": "This write is waiting for a person to approve it. Nothing was sent to the provider.",
  "how_to_fix": "When it is approved, send the identical request again (same method, path, query and body) with X-Platform-Approval-Id: <id>. It works once."
}
```

The answer also has the header `retry-after: 30`. The `status` is `pending`, or `approved` if an identical write was already approved and not yet used.

> **Careful** In the SDK, a `202` is a **success**. The call **resolves** with this object. It does not throw. If you only wait for errors, you will think the write happened. Look for `approval_id` in the result.

```js title="Notice a held write"
const result = await platform.connections.mail.post(
  { path: 'gmail/v1/users/me/messages/send' },
  { raw: encodedMessage },
)

if (result && typeof result === 'object' && 'approval_id' in result) {
  // held: remember result.approval_id, tell the person it is waiting
} else {
  // sent
}
```

```py title="Notice a held write"
reply = requests.post(f"{base}/gmail/v1/users/me/messages/send", json={"raw": encoded_message},
                      headers=headers, timeout=35)

if reply.status_code == 202:
    approval_id = reply.json()["approval_id"]  # held: remember it, tell the person
else:
    reply.raise_for_status()  # sent
```

Sending the same write again while it is still pending returns the same `approval_id`, so nobody ends up with two approvals for one request.

### What the approver sees

The approval appears in the dashboard under Approvals ([approvals](approvals.md)). It carries a one-line summary, `<connection>: <METHOD> <path>`, the connection and the account, the method, the path, the query, the size of the body and a fingerprint (SHA-256) of the body. It marks the risk as medium.

**The body itself is never stored or shown.** The approver sees what kind of call it is and how big, not the message text. Write your own page so the person can see what is being sent before they say yes.

Approval emails are not sent yet. People decide in the dashboard.

## Finish the write

Once the approval says approved, send the **identical** request again, with the header `X-Platform-Approval-Id` set to the `approval_id`.

```js title="Send it again with the approval id"
const reply = await fetch(`${process.env.CONNECTION_MAIL_URL}/gmail/v1/users/me/messages/send`, {
  method: 'POST',
  headers: {
    'x-platform-binding-token': process.env.PLATFORM_TOKEN,
    'x-platform-approval-id': approvalId,
    'content-type': 'application/json',
    // user mode: also forward the visitor's X-Platform-Context header
  },
  body: sameBodyString, // the same string you sent the first time
})
```

```py title="Send it again with the approval id"
reply = requests.post(
    f"{base}/gmail/v1/users/me/messages/send",
    data=same_body_bytes,  # the same bytes you sent the first time
    headers={**headers, "x-platform-approval-id": approval_id, "content-type": "application/json"},
    timeout=35,
)
```

The platform accepts the approval only if **all** of these hold:

- It was approved, and the decision is less than **1 hour** old.
- It belongs to this project.
- It was made for exactly this request: the same project, connection, method, path, query and body. Even one changed byte needs a new approval.
- It has not been used before. It works **once**. A repeat of the same write needs a fresh approval.

If any of those fail, the answer is `approval_not_valid` with a `reason`. See [errors](connections-errors.md#approvals).

> **Good to know** The SDK adds an `Idempotency-Key` to changes so its own retries are safe. That key is not passed to Google or Microsoft, and approvals do not use it. They match on the request itself.

Keep the exact string or bytes you sent the first time and reuse them. Rebuilding the body can change spacing or the order of keys, and then the fingerprint no longer matches.

## How to find out it was approved

Send the identical write again **without** the header. While the approval is waiting, you get the same `202` with the same `approval_id` and `status: "pending"`. After it is approved, you get `202` with `status: "approved"` and the message "This write was approved. Send the identical request again with the header below." Then send it a third time with the header and it goes through.

You can also watch Approvals in the dashboard.

## A sensible flow

1. Make the write. If the result has an `approval_id`, save it together with the exact body.
2. Tell the person: "Waiting for approval."
3. Later, send the same write again without the header to see whether it is approved.
4. When it is, send it once more with `X-Platform-Approval-Id`. It goes through.
5. If it was denied or the hour passed, say so plainly and ask again.

Next: [errors](connections-errors.md).
