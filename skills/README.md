# Cohostly agent skills

Two skills teach an AI agent to use Cohostly. They live in this repo so they change in the same commit as the platform behaviour they describe.

| Skill | Audience | Triggers when the person says... |
| --- | --- | --- |
| [`cohostly-host`](cohostly-host/SKILL.md) | Whoever puts an app online and shares it | "deploy this", "put it on cohostly", "share it with", "who can open it", "make it public", "my deploy failed" |
| [`cohostly-app-code`](cohostly-app-code/SKILL.md) | Whoever writes code that runs on Cohostly | "read the visitor's name", "call the AI gateway from my app", "add a secret to my app", "use the platform's data" |

Both are plain folders: a `SKILL.md` router plus `references/` files that are read only when the task needs them.

## Why two skills, not one and not eight

**Decision: split by audience and trigger, not by tool or by feature.**

- **One big skill loses.** Every turn that mentions Cohostly would pay for the whole platform in context, and a deploy question would drag in SDK types. The sources we checked agree on this: a skill's name and description are always loaded, its body is loaded when it triggers, and bundled files are loaded only when read ([Anthropic, *Equipping agents for the real world with Agent Skills*](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills); [SwirlAI, *Agent Skills: Progressive Disclosure*](https://www.newsletter.swirlai.com/p/agent-skills-progressive-disclosure)).
- **Eight narrow skills lose too.** Each one adds a description that is always loaded, and the agent has to choose between near-identical triggers. A deploy usually runs `check`, `deploy`, `describe`, `share` in one go. Splitting that across skills makes the agent reload context several times. Triggers also overlap: "share" means sharing a project (hosting) and sharing a secret (secrets).
- **Two skills win because the triggers do not overlap.** A person who asks for a deploy is not asking how to read a visitor's name, and the reverse holds too. Each skill's description can then be specific, which is what gets it triggered at the right time.
- **Auth is not its own skill.** Sign-in, roles and visibility come up in the middle of a deploy, so they live in `cohostly-host/references/auth.md`. Making them a separate skill would split a single decision in two.
- **Tools are not documented twice.** MCP already sends each tool's description to the client. The skill covers the *workflow* (the order of calls, the confirm step, what to refuse) and the gotchas the tool descriptions do not say. It does not copy the tool list.

The sources were clear on progressive disclosure and on keeping descriptions specific. They did not directly compare splitting by task against splitting by tool, so the split above is our judgement, based on those principles.

**When to add a third skill:** only when a new audience with a new trigger appears (for example, an operator running the platform itself). Do not add one for a new tool or a new feature. Add a reference file instead.

## How we write a skill here

### Layout

```
skills/<name>/
├── SKILL.md              # required: frontmatter + router. Under about 150 lines.
├── references/           # read on demand, one topic per file
│   ├── <topic>.md        # each opens with a one-line "read this when..."
├── assets/examples/      # complete small apps an agent copies and changes (cohostly-app-code)
├── scripts/              # small deterministic helpers, run rather than read (scaffold.sh copies an example)
├── evals/evals.json      # older test prompts
├── evals/<case>/         # newer tests: prompt.md, case.yaml and graders/ (what skill-creator writes)
```

Examples are real, not sketches. `packages/api/src/skill-examples.test.ts` checks that every example's settings file passes the platform's own resolver, every policy line parses, only existing `platform.data` calls are used, and the code parses, so an example cannot go stale without a test failing. Add a script only for something deterministic that would otherwise be rewritten each time.

### Frontmatter

```yaml
---
name: cohostly-host
description: <what it does, then "Use when..." with the phrases a real person types. Be a little pushy.>
---
```

- `name` matches the folder name.
- The `description` is the trigger. Put all "when to use" information there, not in the body. Name the surfaces it covers (MCP tools, the `platform` CLI, sharing, visibility) so a request phrased in any of them matches.
- Say what it does **not** cover, when a near neighbour exists. The other skill is named for that reason.

### Body

- **Router first.** SKILL.md says which reference to read for each kind of task, and what to do first. It does not repeat the reference.
- **Imperative and short.** "Call `check_manifest` before `deploy`" beats a paragraph of background.
- **Explain the reason** for each rule. A rule with its reason survives an unexpected case; a bare MUST does not. Use capitals only for the few cases where a mistake is costly and irreversible (sending a secret value through chat).
- **Name real things exactly.** Tool names, flags, header names and env vars must match the code. Before you ship a skill, grep each name in the repo. A skill that names a flag that does not exist is worse than none.
- **Mark the plan-only parts.** Phase 8 and later features are described as planned. Say so, and say what the agent should do instead today.
- **One source of truth per fact.** If a fact is in two files, it will drift. Put the fact in one reference and link to it.
- **Reference files over 300 lines** get a table of contents at the top.

### Test prompts

Write 3 to 5 realistic prompts in `evals/evals.json`, the kind a person would really type, some casual, one with a typo, one that is a near miss for the other skill. Run each with and without the skill, look at the output yourself, and only then write assertions. Assertions must be checkable: "the reply contains a `confirm_token` and no URL until the second call", not "the reply is helpful".

Check triggering separately: run the description against queries it should match and queries it should not. Tune the description, not the body, to fix triggering.

### Review checklist before merging

- [ ] Frontmatter `name` equals the folder name; `description` names the trigger phrases and the neighbour skill.
- [ ] SKILL.md is a router, under about 150 lines.
- [ ] Every tool, flag, header and env var name was grepped in the repo.
- [ ] Planned features are marked as planned.
- [ ] No secret, key or token appears anywhere in the skill, even as an example. Use `plk_...` and `<value>`.
- [ ] Each rule that matters has its reason next to it.
- [ ] The skill does not instruct anything the platform would refuse (for example, deploying a public app without asking).

## Sources

- Anthropic engineering, *Equipping agents for the real world with Agent Skills*: https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills
- SwirlAI, *Agent Skills: Progressive Disclosure as a System Design Pattern*: https://www.newsletter.swirlai.com/p/agent-skills-progressive-disclosure
- Tessl registry review of Anthropic skill best practices (description and body guidance): https://tessl.io/registry/skills/github/NeoLabHQ/context-engineering-kit/apply-anthropic-skill-best-practices/review
- Smart Scope, *Claude Skills design patterns for reliable triggering and validation* (the "keep SKILL.md under about 1,000 words" heuristic is from this third-party guide, not an Anthropic rule): https://smartscope.blog/en/generative-ai/claude/claude-skills-design-patterns-official-guide/
