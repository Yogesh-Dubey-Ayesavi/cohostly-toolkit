#!/usr/bin/env node
// `npx @cohostly/sdk types [--check] [--out dir]`
import { runTypes } from './types-command.js'

const args = process.argv.slice(2)
if (args[0] !== 'types') { console.error('usage: cohostly-sdk types [--check] [--out <dir>]'); process.exit(2) }
const i = args.indexOf('--out')
runTypes({ check: args.includes('--check'), out: i >= 0 ? args[i + 1] : undefined }).then((r) => { (r.code ? console.error : console.log)(r.message); process.exit(r.code) })
