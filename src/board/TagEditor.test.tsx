// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { TagEditor } from "./TagEditor";

afterEach(() => cleanup());

describe("TagEditor", () => {
  test("renders a chip per tag", () => {
    render(<TagEditor tags={["docs", "feature"]} onChange={() => {}} />);
    expect(screen.getByText("docs")).toBeTruthy();
    expect(screen.getByText("feature")).toBeTruthy();
  });

  test("adds a tag on Enter and clears the input", () => {
    const onChange = vi.fn();
    render(<TagEditor tags={["docs"]} onChange={onChange} />);
    const input = screen.getByPlaceholderText(/add a tag/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "feature" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(["docs", "feature"]);
    expect(input.value).toBe("");
  });

  test("does not fire onChange for a duplicate", () => {
    const onChange = vi.fn();
    render(<TagEditor tags={["docs"]} onChange={onChange} />);
    const input = screen.getByPlaceholderText(/add a tag/i);
    fireEvent.change(input, { target: { value: "Docs" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).not.toHaveBeenCalled();
  });

  test("removes a tag when its remove control is clicked", () => {
    const onChange = vi.fn();
    render(<TagEditor tags={["docs", "feature"]} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("Remove docs"));
    expect(onChange).toHaveBeenCalledWith(["feature"]);
  });
});
