import React from "react";
import { XIcon } from "@phosphor-icons/react";
import { Badge } from "../ui/badge";
import { addTag } from "./tagEdit";

interface Props {
  tags: string[];
  onChange: (tags: string[]) => void;
  disabled?: boolean;
}

// Inline tag editor: removable chips + an add-on-Enter input. Optimistic — emits
// the new array via onChange; the caller persists it (server re-normalizes).
export function TagEditor(props: Props) {
  const [draft, setDraft] = React.useState("");

  const commit = () => {
    const next = addTag(props.tags, draft);
    setDraft("");
    if (next !== props.tags) props.onChange(next);
  };

  const remove = (tag: string) => props.onChange(props.tags.filter((existing) => existing !== tag));

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      commit();
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {props.tags.map((tag) => (
        <Badge key={tag} tone="neutral">
          {tag}
          <button
            type="button"
            aria-label={`Remove ${tag}`}
            onClick={() => remove(tag)}
            disabled={props.disabled}
            className="-mr-0.5 ml-0.5 rounded-full p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            <XIcon className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={commit}
        placeholder="Add a tag…"
        disabled={props.disabled}
        className="h-7 w-28 rounded-full border border-border bg-muted px-3 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30 disabled:opacity-50"
      />
    </div>
  );
}
