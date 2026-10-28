---
title: Picked files and narrowing
description: Give a tool one file or a short list of files instead of a whole account, with Google's file picker or a restrict_to list.
nav: Picked files and narrowing
---

Most permissions open a whole service: `sheets.write` opens every Google Sheet in the account. Sometimes that is far more than your tool needs. There are two ways to hand over less.

Imagine a filing cabinet. A normal permission is a key to the whole cabinet. A **picked-files** permission is a key to the one drawer the person points at. **Narrowing** is a note on the key that says "only these folders".

## Picked files (Google)

Two permissions work this way, and only on Google:

- `sheets.files`: read and write the Google Sheets the person picks.
- `drive.files`: read and write the Google Drive files the person picks.

With either one, your tool reaches **only** the files the person chose in Google's file picker, plus any file your own tool creates. Nothing else in the account is visible to it. `drive.files` also never reaches who a file is shared with.

Google treats this kind of access as light, so it does not need Google's review the way whole-account Sheets or Drive does. If you can design your app around chosen files, do.

### What the person sees

1. They connect and agree on the consent screen. It says the tool may read and write the files they pick.
2. After they agree, Google's own picker opens in their browser. For a visitor in `user` mode, this is on the page that says they are connected. For an `owner` connection, it opens in the Connections page.
3. They tick the Sheets or Docs they want to share (they can pick several) and confirm. The dashboard confirms with "Added:" and the file names.

The picker runs in the person's own browser. The tool never sees the picker's short-lived token, and neither does an AI assistant.

> **Careful** Never ask a visitor to type or paste a file id. They pick in the picker, and the platform records the ids.

If the platform has not set up the picker, the person sees "The platform operator has not set up the Google file picker yet (a Google API key for it)." If the picker cannot load, they see "Google's file picker could not be loaded. Check your connection or an ad blocker." If they connected without allowing the files permission, they see "This connection was not given per-file access, so there is nothing to pick. Connect it again and allow "the files you pick"."

## Narrowing with `restrict_to`

A grant can carry a `restrict_to` list of resource ids. When it does, the platform allows a call only if it names one of those ids, even if the provider's own permission is wider.

Picking files fills this list for you. A grant can also be narrowed when it is made, for any permission that is about a specific file.

| Provider | What goes in the list |
| --- | --- |
| Google | A spreadsheet, document, presentation, form or Drive file id. |
| Microsoft | A drive item id, a chat id, a channel id, or a OneDrive path. |

Details:

- Up to 200 entries. Each is 1 to 512 characters. Repeats are removed.
- A OneDrive path that ends with `/` is a folder, and covers everything below it. Folders work only where the call uses a path (the `root:/...` form of OneDrive).
- Only permissions that are about a specific file can be narrowed. If none of the chosen ones is, the dashboard says "None of those permissions are about a specific file, so there is nothing to limit."
- To see whether a grant is narrowed from inside your app, read `restrict_to` in the [`allowed()`](connections-allowed.md) answer. It is present only when the grant is narrowed.

### A call that names no file

On a narrowed grant, a call must say which file it is about. If it does not, or if it names a file that is not on the list, the answer is `403 outside_grant`. The three messages are:

- "This connection is limited to specific files, and this call is not about one file."
- "This call does not name a file."
- "This connection is not allowed to use that file."

The fix reads: "The owner limited this tool to specific files. Ask them to add this one in Connections." Treat it as a normal state and say so in your page.

### Files your tool creates

On a grant narrowed to files, creating a new file is allowed. The new file's id is added to the list automatically, so your tool can keep working on what it just made. A grant that is not narrowed already reaches every file, so nothing is added.

Two edge cases:

- If the id could not be added (the list is already at 200, or something went wrong), the call still succeeds, but the answer carries the header `x-platform-note: The new file could not be added to this connection's list of files. Ask the owner to add it in Connections.`
- A grant narrowed to **folders** cannot create files. The message is "This connection is limited to specific folders, and creating a new file does not say which folder it goes in."

### Adding files later

For Google, the owner adds more files from the Connections page, by picking again. New picks are merged with the list that is already there, up to 200 in all. A pick that names no files is refused with "No files were chosen."

Next: [connect, reconnect, switch and disconnect](connections-connect-flows.md).
