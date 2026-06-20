// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { DepMiniView } from "./DepMiniView";
import type { DepEntry } from "./types";

afterEach(() => cleanup());

const entry = (id: string, title: string, over: Partial<DepEntry> = {}): DepEntry =>
  ({ _id: id, title, status: "open", outcome: null, ...over }) as DepEntry;

describe("DepMiniView", () => {
  test("renders nothing when there are no neighbours", () => {
    const { container } = render(<DepMiniView blockedBy={[]} blocks={[]} />);
    expect(container.firstChild).toBeNull();
  });

  test("lists blockers and blocked tasks", () => {
    render(
      <DepMiniView
        blockedBy={[entry("a", "Design doc", { status: "done", outcome: "approved" })]}
        blocks={[entry("b", "Ship it")]}
      />,
    );
    expect(screen.getByText("Design doc")).toBeTruthy();
    expect(screen.getByText("Ship it")).toBeTruthy();
  });

  test("clicking a neighbour calls onOpen with its id", () => {
    const onOpen = vi.fn();
    render(<DepMiniView blockedBy={[entry("a", "Design doc")]} blocks={[]} onOpen={onOpen} />);
    fireEvent.click(screen.getByText("Design doc"));
    expect(onOpen).toHaveBeenCalledWith("a");
  });
});
