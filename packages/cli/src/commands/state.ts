// A project's state as the API sends it (Phase 15). The words come from the platform; the CLI only lays them out, so it always matches the dashboard and MCP.
export interface ApiState { state: string; label: string; reason: string; next_action?: { label: string } | null; badges?: Array<{ label: string }>; also?: string[] }

/** One line for `platform ls`: the name, the state, then the details. */
export function projectLine(p: any): string {
  const st: ApiState | undefined = p.state;
  const details = `v${p.current_version ?? 'none'}, ${p.visibility ?? ''}${p.role ? `, you are ${p.role}` : ''}${p.url ? `, ${p.url}` : ''}`;
  const badges = st?.badges?.length ? ` [${st.badges.map((b) => b.label).join('; ')}]` : '';
  return `- ${p.name}  ${st ? st.label.toUpperCase() : ''}${badges}  (${details})`.replace(/  +\(/, '  (').replace(/\s+$/, '');
}

/** The lines under a project that needs something: the reason and the one next step. Calm states have none. */
export function stateDetail(p: any): string[] {
  const st: ApiState | undefined = p.state;
  if (!st || (st.state === 'live' || st.state === 'asleep')) return [];
  return [`    ${st.reason}`, ...(st.next_action ? [`    Next: ${st.next_action.label}`] : [])];
}
