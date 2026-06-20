import { Badge } from "../ui/badge";
import { SectionLabel } from "./SectionLabel";
import { outcomeBadge } from "./format";
import type { DepEntry } from "./types";

interface Props {
  blockedBy: DepEntry[];
  blocks: DepEntry[];
  onOpen?: (taskId: DepEntry["_id"]) => void;
}

function DepRow(props: { entry: DepEntry; onOpen?: (taskId: DepEntry["_id"]) => void }) {
  const entry = props.entry;
  const badge = entry.outcome ? outcomeBadge(entry.outcome) : null;
  return (
    <button
      type="button"
      onClick={() => props.onOpen?.(entry._id)}
      className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2 text-left text-sm text-foreground transition hover:border-primary/40"
    >
      <span className="truncate">{entry.title}</span>
      {badge ? (
        <Badge tone={badge.tone}>{badge.label}</Badge>
      ) : (
        <Badge tone="neutral">{entry.status}</Badge>
      )}
    </button>
  );
}

// Dependency mini-view for the card dialog: what this task waits on (blockedBy)
// and what waits on it (blocks). Hidden when the task has no dependency edges.
export function DepMiniView(props: Props) {
  if (props.blockedBy.length === 0 && props.blocks.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      {props.blockedBy.length > 0 ? (
        <div>
          <SectionLabel>Blocked by</SectionLabel>
          <div className="flex flex-col gap-1.5">
            {props.blockedBy.map((entry) => (
              <DepRow key={entry._id} entry={entry} onOpen={props.onOpen} />
            ))}
          </div>
        </div>
      ) : null}
      {props.blocks.length > 0 ? (
        <div>
          <SectionLabel>Blocks</SectionLabel>
          <div className="flex flex-col gap-1.5">
            {props.blocks.map((entry) => (
              <DepRow key={entry._id} entry={entry} onOpen={props.onOpen} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
