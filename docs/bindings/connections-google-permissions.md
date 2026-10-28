---
title: Google permissions
description: Every permission you can ask for on a Google connection, in the words the person sees, and what each one allows.
nav: Google permissions
---

These are the permissions of the `google-workspace` connector. You list their names under `permissions` in `cohostly.json`. The description of each is the sentence the person reads on the consent screen, so they know what they are agreeing to.

## How to read the tables

Each permission has a type:

- **read** can only look. It sends `GET` calls, plus a few `POST` calls that only read (for example asking a calendar when people are free).
- **read and write** can look and also change things: add, edit, delete, send.
- **write only** can only send or create. It cannot read anything back.

The type matters for approval. When `require_approval_for_writes` is on, anything that is not a read waits for a person. Reads pass straight through. See [holding writes for approval](connections-write-approval.md).

Many names come as a pair: `.read` and `.write`. Ask for `.read` unless you truly need to change things. A person is more willing to say yes to less.

A broader login covers a narrower need. If the person approved on Google's screen the access behind `sheets.write`, the access behind `sheets.read` is covered too. You still list `sheets.read` yourself if that is what your app asks for.

Google also has to agree. The person must approve the matching access on Google's own consent screen, and the connection collects every access that any tool was ever given. What keeps one tool away from a service it was not given is the platform's own check on the path of each call, not Google's access list.

Always asked in addition, so the platform can tell which account it is: sign-in basics (`openid` and `email`).

> **Careful** Wider permissions, such as whole-account Sheets or whole Drive, need Google's own app review before every person can use them. Whether they are open to everyone on a given platform is up to the platform operator. The narrow "files you pick" permissions (`sheets.files`, `drive.files`) do not have that problem. Prefer them when you can: see [picked files and narrowing](connections-picked-files.md).

## Gmail

| Permission | Type | Description |
| --- | --- | --- |
| `gmail.read` | read | This lets your tool read your Gmail messages, threads, labels and attachments. It cannot send, change or delete anything. |
| `gmail.send` | write only | This lets your tool send email from your Gmail account. It cannot read your mail. |
| `gmail.compose` | read and write | This lets your tool write, change and send drafts in your Gmail account, and send email. |
| `gmail.modify` | read and write | This lets your tool read your Gmail, send email, and label, archive, mark and move messages to the bin. It cannot delete messages for good. |
| `gmail.full` | read and write | This gives your tool full control of your Gmail, including deleting messages for good and changing your settings. |

## Google Drive

| Permission | Type | Description |
| --- | --- | --- |
| `drive.files` | read and write | This lets your tool read and write the Google Drive files you pick for it (and files it creates), and nothing else in your Drive. It never reaches sharing settings. A picked-files permission: the person chooses the files in Google's picker. |
| `drive.read` | read | This lets your tool see and download every file in your Google Drive, including shared drives. It cannot change them. |
| `drive.write` | read and write | This gives your tool full control of your Google Drive, including shared drives: it can see, add, change, share and delete any file. |
| `drive.activity` | read | This lets your tool see the history of changes to your Google Drive files (who changed what, and when). |
| `drive.labels.read` | read | This lets your tool see the Google Drive labels your organisation uses. It cannot change them. |
| `drive.labels.write` | read and write | This lets your tool create and change Google Drive labels (work and school accounts, label administrators). |

## Sheets, Docs, Slides and Forms

A Docs, Sheets, Slides or Forms id is also its Drive file id.

| Permission | Type | Description |
| --- | --- | --- |
| `sheets.files` | read and write | This lets your tool read and write the Google Sheets you pick for it (and sheets it creates), and nothing else in your Google account. A picked-files permission. |
| `sheets.read` | read | This lets your tool read all the Google Sheets in your account. It cannot change them. |
| `sheets.write` | read and write | This lets your tool read, create and change all the Google Sheets in your account. |
| `docs.read` | read | This lets your tool read all the Google Docs in your account. It cannot change them. |
| `docs.write` | read and write | This lets your tool read, create and change all the Google Docs in your account. |
| `slides.read` | read | This lets your tool read all the Google Slides presentations in your account. It cannot change them. |
| `slides.write` | read and write | This lets your tool read, create and change all the Google Slides presentations in your account. |
| `forms.read` | read | This lets your tool read your Google Forms and the answers people sent. It cannot change them. |
| `forms.write` | read and write | This lets your tool create and change your Google Forms and read the answers people sent. |

A few Sheets reads are `POST` calls (the "by data filter" lookups). They count as reads, so they pass an approval gate untouched.

## Calendar, Tasks and Contacts

| Permission | Type | Description |
| --- | --- | --- |
| `calendar.read` | read | This lets your tool see your Google calendars and their events. It cannot change them. Asking when people are free (`freeBusy`) counts as a read. |
| `calendar.write` | read and write | This gives your tool full control of your Google calendars: it can add, change, share and delete calendars and events. |
| `tasks.read` | read | This lets your tool see your Google Tasks lists and tasks. It cannot change them. |
| `tasks.write` | read and write | This lets your tool add, change, finish and delete your Google Tasks and task lists. |
| `contacts.read` | read | This lets your tool see your Google Contacts and contact groups. It cannot change them. |
| `contacts.write` | read and write | This lets your tool add, change and delete your Google Contacts and contact groups. |

## Chat, Meet and Keep

| Permission | Type | Description |
| --- | --- | --- |
| `chat.read` | read | This lets your tool see your Google Chat spaces, their members and messages. It cannot post or change anything. |
| `chat.write` | read and write | This lets your tool create Google Chat spaces, add people to them, and post, change and delete messages as you. |
| `meet.read` | read | This lets your tool see your Google Meet meetings, who joined, recordings and transcripts. It cannot change them. |
| `meet.write` | read and write | This lets your tool create Google Meet meetings and change or end the ones it created, and see their records. |
| `keep.read` | read | This lets your tool read your Google Keep notes and their attachments. It cannot change them. Work and school accounts. |
| `keep.write` | read and write | This lets your tool read, create, share and delete your Google Keep notes. Work and school accounts. |

## Apps Script and Classroom

| Permission | Type | Description |
| --- | --- | --- |
| `scripts.read` | read | This lets your tool read your Apps Script projects and see their runs. It cannot change or run them. |
| `scripts.write` | read and write | This lets your tool create and change your Apps Script projects and their deployments. |
| `classroom.read` | read | This lets your tool see your Google Classroom classes, the people in them, coursework and announcements. It cannot change them. |
| `classroom.write` | read and write | This lets your tool manage your Google Classroom classes, the people in them, coursework, grades and announcements. |

## Organisation directory and profile

| Permission | Type | Description |
| --- | --- | --- |
| `directory.read` | read | This lets your tool see the people and groups in your Google Workspace organisation. You must be an administrator. |
| `directory.write` | read and write | This lets your tool add, change and remove people and groups in your Google Workspace organisation. You must be an administrator. |
| `profile.read` | read | This lets your tool read your name, email address and profile picture. |

## The narrower Google ids

`google-sheets` offers only `sheets.files`, `sheets.read` and `sheets.write`. `google-drive` offers only `drive.files`. Their permissions mean the same as the ones above (the consent sentence for `sheets.write` says "read and change" instead of "read, create and change"). New apps should use `google-workspace`.

## Paths

Each permission opens a set of paths on one Google service. The path in a call is Google's own, without the host, for example `v4/spreadsheets/<id>/values/A1:C100` for Sheets or `calendar/v3/calendars/primary/events` for Calendar. The platform picks the host from the permission that allows the call. See [calling the API](connections-calling-the-api.md).

Next: [Microsoft permissions](connections-microsoft-permissions.md) or [picked files and narrowing](connections-picked-files.md).
