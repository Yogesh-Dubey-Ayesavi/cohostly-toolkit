export async function handleRollback(args: string[], apiUrl: string) {
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
    console.error('Error: project name required (e.g. platform rollback <project> or --project <name>)');
    process.exit(1);
  }

  try {
    const res = await fetch(`${apiUrl}/v1/projects/${encodeURIComponent(project)}/rollback`, {
      method: 'POST',
    });

    const data = await res.json() as any;
    if (!res.ok) {
      console.error(`Rollback failed: ${data.error || res.statusText}`);
      process.exit(1);
    }

    console.log(data.message || `Rolled back project '${project}' to version v${data.current_version}`);
  } catch (err: any) {
    console.error(`Failed to connect to API: ${err.message}`);
    process.exit(1);
  }
}
