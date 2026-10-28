---
title: Data limits and errors
description: "The numbers to design for, and every error the data service can send, with what it means and how to fix it."
nav: Limits and errors
---

The data service is small on purpose. Knowing its edges early saves a late-night surprise.

## Limits

| Limit | Description |
| --- | --- |
| Calls per minute | 600 per project, counted in fixed one-minute windows, for all of the project's binding calls together (AI, data, connections and the rest). Past it, a call gets `429 rate_limited` with a `retry-after` header and `x-ratelimit-*` headers. |
| Rows per read | Up to 1000. If you give no `take`, you get 100. A bigger `take` is quietly cut to 1000. The same caps apply to `$app`. |
| Rows from `$app.sql` | Up to 1000. There is no default of 100. |
| Time per query | 10 seconds. A table call past it answers `504 query_timeout`. A raw SQL statement answers `400 sql_failed`. The statement is not cancelled on the database side, so keep queries light. |
| Queries at once | About 16 per project. A call that cannot start waits up to about 2 seconds, then gets `429 too_many_queries`. Other projects are not affected. |
| Request size | 1,000,000 bytes (about 1 MB). Over it, the reply is `400 invalid_request` with a message that says the body is not valid JSON. The message is misleading. The body is simply too big. |
| Writers | One at a time per database. Many simultaneous writes queue. Keep writes small. |
| Databases | 6 per account by default. Checked at a project's first database. See [limits](../limits/limits.md). |
| Data key life | 1 to 90 days, 30 by default. See [data keys](data-keys-and-tester.md). |
| Visitor context | A signed context is valid for about 5 minutes and for one app. |
| SDK retries | Two more tries on network errors and on 429, 502, 503 and 504. 30 seconds per try. |
| After a deploy or rollback | The data API can take up to about 5 seconds to switch to the new version. Membership changes (`member_of`) show up within about 3 seconds. |

### What is not limited

The platform does not set a per-project cap on storage size or on rows read and written today. Do not read that as unlimited: a limit may arrive, and the database provider's own plan sits underneath. There is also no documented maximum number of tables, columns, migration files or rows in a `createMany`.

### Speed

Do not plan around exact figures. A create takes several steps inside the database, so it is slower than a read, and `createMany` is one call instead of many. A caller far from the platform feels each round trip. Write throughput for one project is modest, and it has not been measured well enough to promise a number.

### Designing for the limits

- Page with `take` and `skip` instead of asking for everything.
- Batch with `createMany`, in pieces under 1 MB.
- Count with `count`, not by reading all rows.
- Do heavy totals once, in a job through `$app.sql`, and store the result in a table.
- If you see `429`, wait and try again. Do not loop at full speed.

## Errors

A platform-made error looks like this:

```json title="Error body"
{ "error": { "code": "database_not_ready", "message": "This project has no managed database yet.", "how_to_fix": "Set \"bindings\": {\"data\": {\"managed\": true}} in the manifest, add migrations, and deploy." } }
```

In the SDK these arrive as a `PlatformError` with `status`, `code`, `message` and `howToFix`. The next table lists each code, with its HTTP status.

| Code | Type | Description |
| --- | --- | --- |
| `invalid_token` | 401 | The call has no valid binding token. It is missing, unknown, expired or revoked. A tool running on the platform gets the token automatically. Elsewhere, send `PLATFORM_TOKEN` as `X-Platform-Binding-Token`. |
| `binding_not_declared` | 403 | The project has not declared the `data` binding. Add `data` under `bindings` in `cohostly.json` and deploy. |
| `rate_limited` | 429 | The project is calling the platform too fast (600 a minute). Slow down and retry after the `retry-after` time. |
| `database_not_ready` | 409 | The project has no managed database yet, or the live version stored no data API. Set `"bindings": { "data": { "managed": true } }`, add migrations, and deploy. This also happens under `cohostly dev` if the project has never been deployed. |
| `invalid_context` | 401 | The visitor's context could not be verified. Forward the `X-Platform-Context` header of the request your app received, unchanged. |
| `context_for_another_app` | 403 | The context was issued for a different app. Forward the context of the request your own app received. |
| `context_unavailable` | 503 | The platform cannot check who is calling right now. Try again in a moment. |
| `data_api_not_allowed` | 403 | The person who made this data key may no longer use the data API for this project. Ask a project admin to turn on data API access for them, or make a new key. |
| `missing_scope` | 403 | The key lacks `data:read` or `data:write` for this call. Make a key with the scope the call needs. |
| `raw_sql_not_allowed` | 403 | Raw SQL is only for your app. Use the table routes, or run the SQL from the app itself with `$app.sql`. |
| `sql_not_allowed` | 400 | Only one SELECT, INSERT, UPDATE or DELETE statement is allowed. Schema changes belong in migrations. Send one statement at a time. |
| `sql_failed` | 400 | The statement failed, or took too long. Check the statement against your tables. |
| `not_available` | 400 | Transactions and raw queries are not available through the data API. Use the table operations. |
| `not_found` | 404 | There is nothing at that address. Use `/data/api/model/<table>/<operation>` with a table that exists. |
| `query_timeout` | 504 | The query took too long. Ask for fewer rows or filter more. |
| `too_many_queries` | 429 | The project has too many data requests running at once. Slow down and retry in a moment. |
| `invalid_request` | 400 | The request is not valid: bad JSON, a body over 1 MB, or a value that does not fit the schema. Fix the request and try again. |

### Errors from the rules

Some errors come from the row rules and have no `code` or `how_to_fix` of their own:

- **A write refused by a rule: `403`**, with `rejectedByPolicy: true` in the body. In the SDK, check `e.status === 403 && e.details?.rejectedByPolicy`. The caller is not allowed to do that to that row. Check who is calling and which lines the table has. Do not retry it.
- **A wrong HTTP method, an unknown table, or a badly shaped query: `400`.** If you call by hand, use the method and address in the [SDK reference](data-sdk-reference.md).

### Things that look like errors but are not

- **An empty list and no error.** Reads that a rule hides return fewer rows, not a refusal. A table with no rule returns `[]` to visitors, and refuses their writes with `403`.
- **A `count` of 0 from `updateMany` or `deleteMany`.** No row matched, or none was yours.

### Deploy errors

These stop a deploy before anything is built. Every one is explained where it happens.

| Message starts | Type | Description |
| --- | --- | --- |
| `Migration <name> could not be applied to an empty database` | 422 | A migration has an SQL error. Fix the file. See [tables and migrations](data-tables-and-migrations.md). |
| `The migration <name> was already applied and has been edited since.` | 409 | An applied file was changed. Put it back and add a new file. |
| `The migration <name> failed on the database` | 422 | A file failed on the real database. Nothing from that file was applied. |
| `Table "<t>": the policy "<text>" ...` | 422 | A row rule is written wrongly. See [row rules](data-row-rules.md). |
| `The table name "<t>" cannot be used.` | 422 | A table or column name is not allowed. Use letters, digits and underscores, starting with a letter. |
| `The migrations create no tables...` | 422 | There is no table to build an API from. |
| `The project's database could not be prepared.` | 502 | A temporary fault. Your previous version is still live. Try again in a moment. |

The checks that run before the build reply with the body `{ "error": "Your data could not be set up", "details": "<message>" }`. The `502` has its own sentence.

If you have a problem that is not here, see [troubleshooting](../limits/troubleshooting.md).
