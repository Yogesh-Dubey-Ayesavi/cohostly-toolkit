// platform backup | backups | restore: backups of a stateful project's /data disk (persistent-disk snapshots).

function parse(args: string[]) {
  const flags = new Set<string>();
  const opts: Record<string, string> = {};
  const rest: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--freeze') flags.add('freeze');
    else if (args[i] === '--slot' && args[i + 1]) opts.slot = args[++i];
    else if (args[i] === '--project' && args[i + 1]) rest.unshift(args[++i]);
    else if (!args[i].startsWith('--')) rest.push(args[i]);
  }
  return { flags, opts, rest };
}

async function call(apiUrl: string, method: string, path: string, body?: unknown): Promise<any> {
  let res: Response;
  try {
    res = await fetch(`${apiUrl}${path}`, {
      method,
      headers: { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (err: any) {
    console.error(`Failed to connect to API at ${apiUrl}: ${err.message}`);
    process.exit(1);
  }
  const data = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) {
    console.error(`Error: ${data.error || res.statusText}`);
    process.exit(1);
  }
  return data;
}

export async function handleBackup(args: string[], apiUrl: string) {
  const { flags, opts, rest } = parse(args);
  const project = rest[0];
  if (!project) {
    console.error('Error: project name required (platform backup <project> [--freeze])');
    process.exit(1);
  }
  const data = await call(apiUrl, 'POST', `/v1/projects/${encodeURIComponent(project)}/backups`, {
    slot: opts.slot,
    consistency: flags.has('freeze') ? 'app' : 'crash',
  });
  console.log(`Backup ${data.backup.id} created (${data.backup.consistency}-consistent) at ${data.backup.created_at}`);
  console.log(data.note);
}

export async function handleBackups(args: string[], apiUrl: string) {
  const { rest } = parse(args);
  const project = rest[0];
  if (!project) {
    console.error('Error: project name required (platform backups <project>)');
    process.exit(1);
  }
  const data = await call(apiUrl, 'GET', `/v1/projects/${encodeURIComponent(project)}/backups`);
  console.log(`BACKUPS for project '${project}':`);
  if (!data.backups.length) {
    console.log('  (none yet; take one with: platform backup ' + project + ')');
    return;
  }
  for (const b of data.backups) {
    console.log(`- ${b.id}  ${b.created_at}  ${b.kind}  ${b.consistency}-consistent  slot=${b.slot}`);
  }
}

export async function handleRestore(args: string[], apiUrl: string) {
  const { rest } = parse(args);
  const [project, backupId] = rest;
  if (!project || !backupId) {
    console.error('Error: usage: platform restore <project> <backup-id>  (list ids with: platform backups <project>)');
    process.exit(1);
  }
  const data = await call(apiUrl, 'POST', `/v1/projects/${encodeURIComponent(project)}/restore`, { backup_id: backupId });
  console.log(`Restored ${project} to backup ${data.restored_from} (taken ${data.backup_time}).`);
  if (data.old_disk) {
    console.log(`The disk you had before (${data.old_disk}) is kept until ${data.old_disk_kept_until}, then deleted.`);
  }
  console.log('The app restarts on the restored data with its next request.');
}
