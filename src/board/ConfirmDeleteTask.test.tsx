// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ConfirmDeleteTask } from "./ConfirmDeleteTask";

afterEach(() => cleanup());

const deleteButton = () =>
  screen.getAllByRole("button", { name: /^delete$/i })[0] as HTMLButtonElement;

describe("ConfirmDeleteTask", () => {
  test("starts collapsed as a trigger", () => {
    render(<ConfirmDeleteTask taskTitle="Ship it" onConfirm={() => {}} deleting={false} />);
    expect(screen.getByText(/delete task/i)).toBeTruthy();
    expect(screen.queryByLabelText("Confirm task title")).toBeNull();
  });

  test("reveals a disabled confirm until the title is typed exactly", () => {
    render(<ConfirmDeleteTask taskTitle="Ship it" onConfirm={() => {}} deleting={false} />);
    fireEvent.click(screen.getByText(/delete task/i));
    expect(deleteButton().disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("Confirm task title"), { target: { value: "wrong" } });
    expect(deleteButton().disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("Confirm task title"), { target: { value: "Ship it" } });
    expect(deleteButton().disabled).toBe(false);
  });

  test("fires onConfirm when confirmed", () => {
    const onConfirm = vi.fn();
    render(<ConfirmDeleteTask taskTitle="Ship it" onConfirm={onConfirm} deleting={false} />);
    fireEvent.click(screen.getByText(/delete task/i));
    fireEvent.change(screen.getByLabelText("Confirm task title"), { target: { value: "Ship it" } });
    fireEvent.click(deleteButton());
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  test("keeps the confirm disabled while deleting", () => {
    render(<ConfirmDeleteTask taskTitle="Ship it" onConfirm={() => {}} deleting />);
    fireEvent.click(screen.getByText(/delete task/i));
    fireEvent.change(screen.getByLabelText("Confirm task title"), { target: { value: "Ship it" } });
    expect(deleteButton().disabled).toBe(true);
  });
});
