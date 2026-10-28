# Where to look next

Read this when a skill does not answer the question, when you need the whole list of something, or when the person asks for documentation. Prefer the data to a guess.

## From the MCP connection (no network needed)

- `read_reference` (tool) or `platform://reference/<name>` (resource): the platform's own lists, as JSON, always current. `index` lists them. Names:
  `visibility`, `roles`, `approval-kinds`, `project-states`, `failure-codes`, `limits`, `context-fields`, `manifest`, `links`.
- `read_skill` (tool) or `skill://<name>/<path>` (resource): the skills and their references. `skill://index` lists every file, including the worked example apps under `assets/examples/`.
- Prompts the client may offer as a menu: `deploy_folder`, `share_safely`, `debug_failed_deploy`, `add_sign_in`.
- `get_contract`, `describe_bindings`, `describe_data`, `describe_context`, `describe_connection`: what one particular project is allowed and given.

## Which source answers which question

| Question | Read |
| --- | --- |
| Who can open an app, and what is each level? | `platform://reference/visibility`, then `auth.md` |
| What may a viewer, editor, admin or owner do? | `platform://reference/roles` |
| What does this failure code mean? | `platform://reference/failure-codes`, then `troubleshooting.md` |
| What is the limit for X, and what are the defaults? | `platform://reference/limits`, then `runtime.md` |
| What fields does the app get about a visitor? | `platform://reference/context-fields` |
| What may go in `cohostly.json`? | `platform://reference/manifest`, then `manifest.md` |
| What requests wait for a person? | `platform://reference/approval-kinds` |
| What state is a project in, and why? | `platform://reference/project-states` |
| How do I build an app of kind X? | `cohostly-app-code/references/recipes.md` |

## On the web

- Site map for assistants: `https://cohostly.cloud/llms.txt`. The MCP page: `https://cohostly.cloud/mcp`. The binding pages: `https://cohostly.cloud/bindings`. The glossary: `https://cohostly.cloud/glossary`.
- The app-side SDK: `@cohostly/sdk` on npm. The CLI: `cohostly` on npm.

If none of these answers it, say so plainly and ask the person. Do not state a limit, a price or a capability you cannot point to.
