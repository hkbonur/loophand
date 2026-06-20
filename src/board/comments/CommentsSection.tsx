import React from "react";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "../../ui/button";
import { SectionLabel } from "../SectionLabel";
import { commentTimeLabel } from "./commentFormat";

export interface BoardComment {
  _id: Id<"taskComments">;
  body: string;
  createdAt: number;
}

interface Props {
  comments: BoardComment[];
  onAdd: (body: string) => void;
  submitting: boolean;
  now: number;
}

// Presentational comment thread + composer. The container owns the convex query
// and mutation; this only renders and reports a new comment body.
export function CommentsSection(props: Props) {
  const [draft, setDraft] = React.useState("");
  const canSend = draft.trim().length > 0 && !props.submitting;

  const send = () => {
    if (!canSend) return;
    props.onAdd(draft.trim());
    setDraft("");
  };

  return (
    <div>
      <SectionLabel>Comments</SectionLabel>
      {props.comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No comments yet.</p>
      ) : (
        <ul className="mb-3 flex flex-col gap-2">
          {props.comments.map((comment) => (
            <li key={comment._id} className="rounded-2xl border border-border bg-card px-3 py-2">
              <p className="whitespace-pre-wrap text-sm text-foreground">{comment.body}</p>
              <span className="text-xs text-muted-foreground">
                {commentTimeLabel(comment.createdAt, props.now)}
              </span>
            </li>
          ))}
        </ul>
      )}
      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder="Leave a comment for the agent…"
        className="min-h-16 w-full rounded-2xl border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
      />
      <div className="mt-2 flex justify-end">
        <Button size="sm" disabled={!canSend} onClick={send}>
          Comment
        </Button>
      </div>
    </div>
  );
}
