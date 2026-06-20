// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { BoardFilters } from "./BoardFilters";
import { EMPTY_FILTER } from "./filters";
import type { Id } from "../../convex/_generated/dataModel";

afterEach(() => cleanup());

const agents = [{ id: "agent-a" as Id<"apiTokens">, name: "claude-code" }];
const baseProps = {
  tags: ["docs", "feature"],
  agents,
  types: ["approval", "visual_review"],
};

describe("BoardFilters", () => {
  test("selecting a tag emits an updated filter", () => {
    const onChange = vi.fn();
    render(<BoardFilters {...baseProps} value={EMPTY_FILTER} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/filter by tag/i), { target: { value: "docs" } });
    expect(onChange).toHaveBeenCalledWith({ tag: "docs", agentTokenId: null, type: null });
  });

  test("selecting an agent emits the token id", () => {
    const onChange = vi.fn();
    render(<BoardFilters {...baseProps} value={EMPTY_FILTER} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/filter by agent/i), { target: { value: "agent-a" } });
    expect(onChange).toHaveBeenCalledWith({ tag: null, agentTokenId: "agent-a", type: null });
  });

  test("shows a clear control only when a filter is active", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <BoardFilters {...baseProps} value={EMPTY_FILTER} onChange={onChange} />,
    );
    expect(screen.queryByRole("button", { name: /clear/i })).toBeNull();

    rerender(
      <BoardFilters {...baseProps} value={{ ...EMPTY_FILTER, tag: "docs" }} onChange={onChange} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /clear/i }));
    expect(onChange).toHaveBeenCalledWith(EMPTY_FILTER);
  });
});
