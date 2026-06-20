// @vitest-environment jsdom
import { afterEach, describe, expect, test } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { BlockedLane } from "./BlockedLane";
import type { TaskView } from "./types";
import type { AgentDirectory } from "./useAgents";

afterEach(() => cleanup());

const agents: AgentDirectory = new Map();

function blocked(id: string, title: string, depCount: number): TaskView {
  return {
    _id: id,
    title,
    type: "approval",
    status: "blocked",
    outcome: null,
    depCount,
    createdByTokenId: null,
    createdAt: 0,
  } as unknown as TaskView;
}

describe("BlockedLane", () => {
  test("renders nothing when there are no blocked tasks", () => {
    const { container } = render(
      <BlockedLane tasks={[]} now={0} agents={agents} onOpen={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  test("shows a header with the blocked count and reveals cards on expand", () => {
    render(
      <BlockedLane
        tasks={[blocked("a", "First", 1), blocked("b", "Second", 2)]}
        now={0}
        agents={agents}
        onOpen={() => {}}
      />,
    );
    // Count in the header.
    expect(screen.getByText("2")).toBeTruthy();
    // Collapsed by default — card titles hidden.
    expect(screen.queryByText("First")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /blocked/i }));
    expect(screen.getByText("First")).toBeTruthy();
    expect(screen.getByText("Second")).toBeTruthy();
  });
});
