// @vitest-environment jsdom
import { afterEach, describe, expect, test } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { OfflineBanner } from "./OfflineBanner";

afterEach(() => cleanup());

describe("OfflineBanner", () => {
  test("renders nothing when the connection is ok", () => {
    const { container } = render(<OfflineBanner state="ok" />);
    expect(container.firstChild).toBeNull();
  });

  test("shows the offline message", () => {
    render(<OfflineBanner state="offline" />);
    expect(screen.getByText(/you're offline/i)).toBeTruthy();
  });

  test("shows the reconnecting message", () => {
    render(<OfflineBanner state="reconnecting" />);
    expect(screen.getByText(/reconnecting/i)).toBeTruthy();
  });
});
