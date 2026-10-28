export async function handleVersions(args: string[], apiUrl: string) {
  let project = '';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--project' && args[i + 1]) {
      project = args[i + 1];
      i++;
    } else if (!args[i].startsWith('--')) {
      project = args[i];
    }
  }

  if (!project) {
    console.error('Error: project name required (e.g. platform versions <project> or --project <name>)');
    process.exit(1);
  }

  try {
    const res = await fetch(`${apiUrl}/v1/projects/${encodeURIComponent(project)}/versions`);
    if (!res.ok) {
      const err = await res.json() as any;
      console.error(`Failed to fetch versions: ${err.error || res.statusText}`);
      process.exit(1);
    }

    const data = await res.json() as { project: string; current_version?: number; versions: any[] };
    console.log(`VERSIONS for project '${data.project}' (current: v${data.current_version ?? 'none'}):`);
    if (!data.versions || data.versions.length === 0) {
      console.log('  (no versions found)');
      return;
    }

    for (const v of data.versions) {
      const isCurrent = v.version === data.current_version ? ' (current)' : '';
      let pause = 'memory';
      try { pause = JSON.parse(v.artifact_json || '{}').pause_mode || 'memory'; } catch { /* a failed version has no artifact */ }
      console.log(`- v${v.version}${isCurrent}: status=${v.status}, engine=${v.engine_resolved}, pause_mode=${pause}, created=${v.created_at}`);
      if (v.engine_notice) {
        console.log(`    notice: ${v.engine_notice}`);
      }
    }
  } catch (err: any) {
    console.error(`Failed to connect to API: ${err.message}`);
    process.exit(1);
  }
}
