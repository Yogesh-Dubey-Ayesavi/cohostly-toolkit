# approval-gate

Does nothing destructive until a person approves it in the dashboard.

- **Shows:** `platform.approvals.request` with a plain summary, the signed callback (`callback().express`), and a handler that is safe to run twice.
- **Bindings:** `approvals`, with `callback_path` set to the SDK's default path.
- **Rule it follows:** act only after `approved`, and only the action the summary described.
- **Polling instead:** drop `callback_path` and call `approval.wait()`; see `references/approvals.md`.

Approval emails are not sent yet; the person answers in the dashboard.
