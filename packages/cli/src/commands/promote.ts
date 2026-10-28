export async function handlePromote(args: string[], apiUrl: string) {
  let project = '';
  let version = '';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--project' && args[i + 1]) {
      project = args[i + 1];
      i++;
    } else if (!args[i].startsWith('--')) {
      if (!version) {
        version = args[i];
      } else if (!project) {
        project = args[i];
      }
    }
  }

  if (!version) {
    console.error('Error: version number required (e.g. platform promote <version> [--project <name>])');
    process.exit(1);
  }
  if (!project) {
    console.error('Error: project name required (e.g. platform promote <version> --project <name>)');
    process.exit(1);
  }

  const cleanVersion = version.replace(/^v/, '');

  try {
    const res = await fetch(`${apiUrl}/v1/projects/${encodeURIComponent(project)}/versions/${cleanVersion}/promote`, {
      method: 'POST',
    });

    const data = await res.json() as any;
    if (!res.ok) {
      console.error(`Promotion failed: ${data.error || res.statusText}`);
      process.exit(1);
    }

    console.log(`Promoted project '${project}' to version v${cleanVersion}`);
  } catch (err: any) {
    console.error(`Failed to connect to API: ${err.message}`);
    process.exit(1);
  }
}
