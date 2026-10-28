---
title: Microsoft permissions
description: Every permission you can ask for on a Microsoft connection, in the words the person sees, and what each one allows.
nav: Microsoft permissions
---

These are the permissions of the `microsoft-graph` connector. It talks to Microsoft Graph **version 1.0 only**. The beta version is refused. All permissions are delegated: the app acts as the signed-in person, within what that person can already do.

Personal Microsoft accounts work for the OneDrive, Outlook and Calendar groups. Work and school accounts may need an administrator to allow some permissions first. If an administrator must approve, the person sees: "Your organization requires an administrator to approve this app before you can connect. Ask your IT administrator to approve it, then try again."

## How to read the tables

- **read** can only look. It sends `GET` calls, plus a few `POST` calls that only read (finding meeting times, reading a schedule).
- **read and write** can look and also change things.
- **write only** can only send. It cannot read anything back.

When `require_approval_for_writes` is on, anything that is not a read waits for a person ([holding writes for approval](connections-write-approval.md)).

As with Google, ask for `.read` unless you need to change things. A broader login covers a narrower need: a person who approved the access behind `onedrive.write` has also covered `onedrive.read`. You still name the permission your app uses.

Always asked in addition, so the platform can tell which account it is: sign-in basics (`openid`, `profile`, `email`, `offline_access`, `User.Read`).

## Files, OneDrive and Excel

Files in your own OneDrive use the `onedrive` permissions. Files other people shared with you, and other drives, need the `files.all` permissions.

| Permission | Type | Description |
| --- | --- | --- |
| `onedrive.read` | read | This lets your tool read the files in your OneDrive. It cannot change them. |
| `onedrive.write` | read and write | This lets your tool read, add, change and delete files in your OneDrive. |
| `files.all.read` | read | This lets your tool read every file you can open in Microsoft 365, including files shared with you. It cannot change them. |
| `files.all.write` | read and write | This gives your tool full control of every file you can open in Microsoft 365, including files shared with you. |
| `excel.read` | read | This lets your tool read the Excel workbooks in your OneDrive. It cannot change them. |
| `excel.write` | read and write | This lets your tool read and change the Excel workbooks in your OneDrive. |
| `sharepoint.read` | read | This lets your tool read the SharePoint sites, lists and pages you can open. It cannot change them. |
| `sharepoint.write` | read and write | This lets your tool read and change the SharePoint sites, lists and pages you can edit. |

## Outlook mail, calendar and contacts

| Permission | Type | Description |
| --- | --- | --- |
| `mail.read` | read | This lets your tool read your Outlook email. It cannot send or change anything. |
| `mail.write` | read and write | This lets your tool read, write drafts, move, flag and delete your Outlook email. Sending needs `mail.send`. |
| `mail.send` | write only | This lets your tool send email from your Outlook account, and reply to and forward messages. |
| `calendar.read` | read | This lets your tool read your Outlook calendar. It cannot change it. Reading a schedule and finding meeting times count as reads. |
| `calendar.write` | read and write | This lets your tool read, add, change and delete events and calendars in your Outlook calendar. |
| `contacts.read` | read | This lets your tool read your Outlook contacts. It cannot change them. |
| `contacts.write` | read and write | This lets your tool read, add, change and delete your Outlook contacts. |

## To Do and OneNote

| Permission | Type | Description |
| --- | --- | --- |
| `tasks.read` | read | This lets your tool see your Microsoft To Do lists and tasks. It cannot change them. |
| `tasks.write` | read and write | This lets your tool add, change, finish and delete your Microsoft To Do lists and tasks. |
| `notes.read` | read | This lets your tool read your OneNote notebooks. It cannot change them. |
| `notes.write` | read and write | This lets your tool read, add and change your OneNote notebooks, sections and pages. |

## Teams

| Permission | Type | Description |
| --- | --- | --- |
| `teams.chats.read` | read | This lets your tool read your Microsoft Teams chats and their messages. |
| `teams.chats.write` | read and write | This lets your tool read your Microsoft Teams chats and send messages in them as you. |
| `teams.read` | read | This lets your tool see the Microsoft Teams teams you belong to and their channels. It cannot read messages. |
| `teams.channel.read` | read | This lets your tool read the messages in Microsoft Teams channels you belong to. Work accounts may need an administrator to allow it. |
| `teams.channel.send` | write only | This lets your tool post messages and replies to Microsoft Teams channels as you. It cannot read them. |

## People and profile

| Permission | Type | Description |
| --- | --- | --- |
| `people.read` | read | This lets your tool see the people you work with most, ranked by how often you are in touch. |
| `users.read` | read | This lets your tool look up the names and email addresses of people in your organisation. |
| `profile.read` | read | This lets your tool read your name, email address and profile picture. |

> **Good to know** Older notes may show `teams.chat.read`, `teams.chat.write` or `teams.message.send`. Those names are retired. Use `teams.chats.read`, `teams.chats.write` and `teams.channel.send`.

## Paths and the official client

Paths start at `me/...`, `drives/...`, `sites/...`, `chats/...` and so on. Version 1.0 is already in the address, so do not add `v1.0`. `me/drive` is the person's own OneDrive, which is what the `onedrive` permissions open. Another drive id needs `files.all.read` or `files.all.write`.

Using the official Microsoft Graph client? `drives.byDriveId('me')` points at `me/drive`. Using version beta is refused with `version_not_supported`. More in [calling the API](connections-calling-the-api.md#the-official-microsoft-client).

Next: [Google permissions](connections-google-permissions.md) or [calling the API](connections-calling-the-api.md).
