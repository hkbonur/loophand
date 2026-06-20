import { CaretDownIcon, XIcon } from "@phosphor-icons/react";
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

interface Option {
  value: string;
  label: string;
}

const SELECT_CLASS =
  "h-9 appearance-none rounded-full border border-border bg-muted pl-3 pr-8 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30";

// One board-filter dropdown. The empty option ("") clears that dimension; the
// caller maps the selected string back onto the typed filter. Native <select>
// with a themed caret so the chevron matches the pill chrome on every platform.
function FilterSelect(props: {
  label: string;
  placeholder: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative">
      <select
        aria-label={props.label}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        className={SELECT_CLASS}
      >
        <option value="">{props.placeholder}</option>
        {props.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <CaretDownIcon
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}

const asOption = (value: string): Option => ({ value, label: value });

// Board toolbar filter: tag / agent / type. Status is the column axis, so it's
// not offered here.
export function BoardFilters(props: Props) {
  const value = props.value;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <FilterSelect
        label="Filter by tag"
        placeholder="All tags"
        value={value.tag ?? ""}
        options={props.tags.map(asOption)}
        onChange={(tag) => props.onChange({ ...value, tag: tag || null })}
      />
      <FilterSelect
        label="Filter by agent"
        placeholder="All agents"
        value={value.agentTokenId ?? ""}
        options={props.agents.map((agent) => ({ value: agent.id, label: agent.name }))}
        onChange={(id) =>
          props.onChange({ ...value, agentTokenId: (id || null) as BoardFilter["agentTokenId"] })
        }
      />
      <FilterSelect
        label="Filter by type"
        placeholder="All types"
        value={value.type ?? ""}
        options={props.types.map(asOption)}
        onChange={(type) => props.onChange({ ...value, type: type || null })}
      />

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
