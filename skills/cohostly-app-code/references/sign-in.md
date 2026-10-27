# Platform sign-in or the app's own?

Read this when an app needs people to sign in, when it already has a login (Supabase, Firebase, Auth0, NextAuth), or when someone asks "who should log in here?". The choice decides what to set as the app's visibility.

## Two kinds of sign-in

- **The platform's.** A person signs in to Cohostly. The platform decides whether they may open the app (visibility and sharing), and tells the app who they are in the signed request context. The app writes no login code.
- **The app's own.** The app has its own users and its own login page, with a service of its choice. The platform does not know these people.

## Choose by who the visitors are

| Visitors are... | Use | Set visibility to |
| --- | --- | --- |
| People you invite, who will have Cohostly accounts | Platform | `private` (named people) |
| Everyone in your team's account | Platform | `account` |
| Anyone with a Cohostly account | Platform | `signed_in` |
| Anyone with the link, who may sign in to be recognised (a greeting, saved preferences) | Platform, optional: `middleware({ required: false })` and `loginUrl()` | `link` or `public` |
| Customers or the public, who have no Cohostly account and sign up in your app | The app's own | `public` (or `link` while testing) |
| An app that already has its own login, moved here | Keep the app's own | `public` or `link` |
| A program, not a person | An access key | `private`, with a key per sender (`machine-access`) |

## Rules that follow

- **Do not put your own login behind the platform's.** If visibility is `private`, `account` or `signed_in`, an anonymous visitor is stopped before the app is reached, so they never see your login page, and anyone who gets in is already a Cohostly person. Own login needs `public` or `link`.
- **Pick one source of truth for "who is this".** With platform sign-in, the key for a person is `caller.id` (stable, opaque). With your own login, it is your user's ID. Do not mix them for the same decision. If you use the platform to gate an app and your own service for data, store `caller.id` next to your own user record.
- **Own-login people are anonymous to the platform.** They have `caller.kind` `anonymous`, they are not on the project's Users tab, and a managed-data policy such as `owner(user_id)` cannot see them. If such an app uses the data binding, it reads and writes in its own trusted code (`$app`) and applies its own per-user checks (`data.md`).
- **Settings for own-login frameworks that bake values into the page** (Next.js `NEXT_PUBLIC_*`, Vite `VITE_*`): the public values must exist while the app is built, not only when it starts. `cohostly snapshot` finds them (`cohostly-host/references/snapshot.md`, "Values the build needs"). Keep private keys out of those names.
- **The login provider must know the app's address.** Add the app's address to its list of allowed redirect or site URLs. The default address ends in a random suffix and changes if the link is reset, so a login that matters should run on a custom domain (`add_domain`), which stays put.
- **Widening visibility is the person's choice.** Moving a tool to `public` so its own login works is a decision to put it on the internet. Say that in one sentence and ask first (`cohostly-host/references/auth.md`).

## Where the examples are

`visitor-greeting` and `spa-login` (platform sign-in, optional), `roles-gate` (members and owner-only pages), `notes-data` (data per person), `my-agenda` (acts as the visitor), `machine-access` (keys), `fastapi-verify` and `go-verify` (the same checks outside Node). Choose with `recipes.md`.
