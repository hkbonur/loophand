import React from "react";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "../../ui/button";
import { Textarea } from "../../ui/textarea";
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
      {props.comments.length > 0 ? (
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
      ) : null}
      <Textarea
        value={draft}
        onChange={setDraft}
        placeholder="Leave a comment for the agent…"
        rows={3}
      />
      <div className="mt-2 flex justify-end">
        <Button size="sm" disabled={!canSend} onClick={send}>
          Comment
        </Button>
      </div>
    </div>
  );
}
