// @vitest-environment jsdom
import { afterEach, describe, expect, test } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { AgentChip } from "./AgentChip";
import { DARK_AFTER_MS } from "../lib/agentActivity";

const NOW = 1_000_000_000_000;

afterEach(() => cleanup());

describe("AgentChip", () => {
  test("renders the agent name and a monogram", () => {
    render(<AgentChip agent={{ name: "claude-code", lastUsedAt: NOW }} now={NOW} />);
    expect(screen.getByText("claude-code")).toBeTruthy();
    expect(screen.getByText("CC")).toBeTruthy();
  });

  test("renders an unknown-agent fallback when there is no agent", () => {
    render(<AgentChip agent={null} now={NOW} />);
    expect(screen.getByText("Unknown agent")).toBeTruthy();
  });

  test("shows an idle indicator when the agent has gone dark", () => {
    render(
      <AgentChip
        agent={{ name: "worker", lastUsedAt: NOW - (DARK_AFTER_MS + 60_000) }}
        now={NOW}
      />,
    );
    expect(screen.getByTitle(/idle/i)).toBeTruthy();
  });

  test("does not show an idle indicator for an active agent", () => {
    render(<AgentChip agent={{ name: "worker", lastUsedAt: NOW }} now={NOW} />);
    expect(screen.queryByTitle(/idle/i)).toBeNull();
  });

  test("renders a caption before the name when provided", () => {
    render(<AgentChip agent={{ name: "worker", lastUsedAt: NOW }} now={NOW} caption="resumed by" />);
    expect(screen.getByText("resumed by")).toBeTruthy();
  });
});
