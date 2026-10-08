import * as fs from 'node:fs';
import * as path from 'node:path';

// `platform new <template> [folder]`: a tiny starting project of one of the common kinds, ready for `platform deploy` with no settings and no Dockerfile.
// These are examples to start from, not an app builder: each is a page that says hello.

const T: Record<string, { about: string; files: Record<string, string> }> = {
  static: { about: 'A plain website (index.html).', files: { 'index.html': '<!doctype html>\n<meta charset="utf-8">\n<title>Hello</title>\n<h1>Hello from Cohostly</h1>\n' } },
  flask: { about: 'A Python web app with Flask.', files: {
    'requirements.txt': 'flask==3.0.3\n',
    'app.py': 'from flask import Flask\n\napp = Flask(__name__)\n\n\n@app.get("/")\ndef home():\n    return "Hello from Flask on Cohostly"\n\n\nif __name__ == "__main__":\n    app.run(host="0.0.0.0", port=8080)\n' } },
  fastapi: { about: 'A Python API with FastAPI.', files: {
    'requirements.txt': 'fastapi==0.115.0\nuvicorn==0.30.6\n',
    'main.py': 'from fastapi import FastAPI\n\napp = FastAPI()\n\n\n@app.get("/")\ndef home():\n    return {"message": "Hello from FastAPI on Cohostly"}\n' } },
  express: { about: 'A Node web app with Express.', files: {
    'package.json': '{\n  "name": "hello",\n  "private": true,\n  "scripts": { "start": "node server.js" },\n  "dependencies": { "express": "4.19.2" }\n}\n',
    'server.js': 'const express = require("express")\nconst app = express()\napp.get("/", (req, res) => res.send("Hello from Express on Cohostly"))\napp.listen(3000, "0.0.0.0")\n' } },
  go: { about: 'A Go web server.', files: {
    'go.mod': 'module hello\n\ngo 1.21\n',
    'main.go': 'package main\n\nimport (\n\t"fmt"\n\t"net/http"\n)\n\nfunc main() {\n\thttp.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) { fmt.Fprint(w, "Hello from Go on Cohostly") })\n\thttp.ListenAndServe(":8080", nil)\n}\n' } },
  nextjs: { about: 'A Next.js site.', files: {
    'package.json': '{\n  "name": "hello",\n  "private": true,\n  "scripts": { "build": "next build", "start": "next start" },\n  "dependencies": { "next": "14.2.15", "react": "18.3.1", "react-dom": "18.3.1" }\n}\n',
    'app/layout.js': 'export default function Layout({ children }) {\n  return <html lang="en"><body>{children}</body></html>\n}\n',
    'app/page.js': 'export default function Page() {\n  return <h1>Hello from Next.js on Cohostly</h1>\n}\n' } },
};

export const TEMPLATES = Object.keys(T);

export function handleNew(args: string[]) {
  const [template, folder] = args.filter((a) => !a.startsWith('--'));
  if (!template || !T[template]) {
    console.error(`${template ? `Unknown template "${template}". ` : ''}Usage: platform new <template> [folder]\n\nTemplates:\n${TEMPLATES.map((t) => `  ${t.padEnd(8)} ${T[t].about}`).join('\n')}`);
    process.exit(1);
  }
  const dir = path.resolve(process.cwd(), folder || `my-${template}-app`);
  if (fs.existsSync(dir) && fs.readdirSync(dir).length) { console.error(`${dir} already exists and is not empty. Pick another folder name.`); process.exit(1); }
  for (const [f, body] of Object.entries(T[template].files)) {
    const p = path.join(dir, f); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, body);
  }
  const rel = path.relative(process.cwd(), dir) || '.';
  console.log(`Created ${rel}/ (${T[template].about})\n\nNext:\n  cd ${rel}\n  platform deploy`);
}
