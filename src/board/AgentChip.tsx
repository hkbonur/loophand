import { agentInitials, isAgentDark } from "../lib/agentActivity";

export interface AgentInfo {
  name: string;
  lastUsedAt?: number;
}

interface Props {
  // The resolved agent, or null when the raising token is gone/unattributed.
  agent: AgentInfo | null;
  now: number;
  // Optional muted lead-in, e.g. "raised by" / "resumed by".
  caption?: string;
}

// Attribution chip: a monogram avatar + the agent's name, with a muted dot when
// the agent has gone dark. Names render as plain text only (agent-supplied).
export function AgentChip(props: Props) {
  const name = props.agent?.name ?? "Unknown agent";
  const dark = props.agent ? isAgentDark(props.agent.lastUsedAt, props.now) : false;

  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
      <span
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold uppercase text-muted-foreground"
        aria-hidden
      >
        {agentInitials(name)}
      </span>
      {props.caption ? <span className="shrink-0">{props.caption}</span> : null}
      <span className="truncate font-medium text-foreground">{name}</span>
      {dark ? (
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/50"
          title="Idle — no recent activity"
        />
      ) : null}
    </span>
  );
}
