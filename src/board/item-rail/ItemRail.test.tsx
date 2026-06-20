// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ItemRail } from "./ItemRail";
import type { RailItem } from "./types";

afterEach(() => cleanup());

const items: RailItem[] = [
  { order: 0, title: "NDA", status: "approved" },
  { order: 1, title: "MSA", status: "changes_requested" },
  { order: 2, title: "SOW", status: "pending" },
];

describe("ItemRail", () => {
  test("shows the progress chip and one cell per item", () => {
    render(
      <ItemRail items={items} selectedOrder={0} onSelect={() => {}} itemsDone={2} itemCount={3} />,
    );
    expect(screen.getByText("2/3")).toBeTruthy();
    expect(screen.getByText("NDA")).toBeTruthy();
    expect(screen.getByText("SOW")).toBeTruthy();
  });

  test("clicking a cell selects that item", () => {
    const onSelect = vi.fn();
    render(
      <ItemRail items={items} selectedOrder={0} onSelect={onSelect} itemsDone={2} itemCount={3} />,
    );
    fireEvent.click(screen.getByText("SOW"));
    expect(onSelect).toHaveBeenCalledWith(2);
  });

  test("] steps to the next item, [ steps back", () => {
    const onSelect = vi.fn();
    render(
      <ItemRail items={items} selectedOrder={1} onSelect={onSelect} itemsDone={2} itemCount={3} />,
    );
    const rail = screen.getByRole("listbox");
    fireEvent.keyDown(rail, { key: "]" });
    expect(onSelect).toHaveBeenLastCalledWith(2);
    fireEvent.keyDown(rail, { key: "[" });
    expect(onSelect).toHaveBeenLastCalledWith(0);
  });

  test("Submit batch is disabled until every item is settled", () => {
    const onSubmit = vi.fn();
    const { rerender } = render(
      <ItemRail
        items={items}
        selectedOrder={0}
        onSelect={() => {}}
        itemsDone={2}
        itemCount={3}
        onSubmit={onSubmit}
      />,
    );
    const submit = screen.getByRole("button", { name: /submit batch/i });
    expect(submit).toHaveProperty("disabled", true);

    rerender(
      <ItemRail
        items={items}
        selectedOrder={0}
        onSelect={() => {}}
        itemsDone={3}
        itemCount={3}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /submit batch/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
