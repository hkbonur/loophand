// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { CommentsSection, type BoardComment } from "./CommentsSection";
import type { Id } from "../../../convex/_generated/dataModel";

afterEach(() => cleanup());

const comment = (over: Partial<BoardComment>): BoardComment => ({
  _id: "c1" as Id<"taskComments">,
  body: "hello",
  createdAt: 0,
  ...over,
});

describe("CommentsSection", () => {
  test("shows the empty state with no comments", () => {
    render(<CommentsSection comments={[]} onAdd={() => {}} submitting={false} now={0} />);
    expect(screen.getByText(/no comments yet/i)).toBeTruthy();
  });

  test("renders a comment body", () => {
    render(
      <CommentsSection
        comments={[comment({ body: "use the brand palette" })]}
        onAdd={() => {}}
        submitting={false}
        now={0}
      />,
    );
    expect(screen.getByText("use the brand palette")).toBeTruthy();
  });

  test("fires onAdd with the trimmed draft and clears it", () => {
    const onAdd = vi.fn();
    render(<CommentsSection comments={[]} onAdd={onAdd} submitting={false} now={0} />);
    const box = screen.getByPlaceholderText(/leave a comment/i) as HTMLTextAreaElement;
    fireEvent.change(box, { target: { value: "  ship it  " } });
    fireEvent.click(screen.getByRole("button", { name: /comment/i }));
    expect(onAdd).toHaveBeenCalledWith("ship it");
    expect(box.value).toBe("");
  });

  test("does not fire onAdd for an empty draft", () => {
    const onAdd = vi.fn();
    render(<CommentsSection comments={[]} onAdd={onAdd} submitting={false} now={0} />);
    fireEvent.click(screen.getByRole("button", { name: /comment/i }));
    expect(onAdd).not.toHaveBeenCalled();
  });

  test("disables the button while submitting", () => {
    render(<CommentsSection comments={[]} onAdd={() => {}} submitting now={0} />);
    fireEvent.change(screen.getByPlaceholderText(/leave a comment/i), {
      target: { value: "x" },
    });
    expect((screen.getByRole("button", { name: /comment/i }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });
});
