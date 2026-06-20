import { XIcon } from "@phosphor-icons/react";
import type { Id } from "../../convex/_generated/dataModel";
import { type BoardFilter, EMPTY_FILTER, isFilterActive } from "./filters";

export interface AgentOption {
  id: Id<"apiTokens">;
  name: string;
}

interface Props {
  tags: string[];
  agents: AgentOption[];
  types: string[];
  value: BoardFilter;
  onChange: (filter: BoardFilter) => void;
}

const SELECT_CLASS =
  "h-9 rounded-full border border-border bg-card px-3 text-xs text-foreground focus:border-primary focus:outline-none";

// Board toolbar filter: tag / agent / type. Empty option ("") clears that
// dimension. Status is the column axis, so it's not offered here.
export function BoardFilters(props: Props) {
  const value = props.value;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label="Filter by tag"
        value={value.tag ?? ""}
        onChange={(event) => props.onChange({ ...value, tag: event.target.value || null })}
        className={SELECT_CLASS}
      >
        <option value="">All tags</option>
        {props.tags.map((tag) => (
          <option key={tag} value={tag}>
            {tag}
          </option>
        ))}
      </select>

      <select
        aria-label="Filter by agent"
        value={value.agentTokenId ?? ""}
        onChange={(event) =>
          props.onChange({
            ...value,
            agentTokenId: (event.target.value || null) as BoardFilter["agentTokenId"],
          })
        }
        className={SELECT_CLASS}
      >
        <option value="">All agents</option>
        {props.agents.map((agent) => (
          <option key={agent.id} value={agent.id}>
            {agent.name}
          </option>
        ))}
      </select>

      <select
        aria-label="Filter by type"
        value={value.type ?? ""}
        onChange={(event) => props.onChange({ ...value, type: event.target.value || null })}
        className={SELECT_CLASS}
      >
        <option value="">All types</option>
        {props.types.map((type) => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
      </select>

      {isFilterActive(value) ? (
        <button
          type="button"
          onClick={() => props.onChange(EMPTY_FILTER)}
          className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <XIcon className="h-3.5 w-3.5" />
          Clear
        </button>
      ) : null}
    </div>
  );
}
