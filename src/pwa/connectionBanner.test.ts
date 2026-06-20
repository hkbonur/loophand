import { describe, it, expect } from "vitest";
import { bannerState } from "./connectionBanner";

describe("bannerState", () => {
  it("is offline when the browser is offline, regardless of the socket", () => {
    expect(bannerState(false, { isWebSocketConnected: true, hasEverConnected: true })).toBe(
      "offline",
    );
  });

  it("is reconnecting when a previously-connected socket drops", () => {
    expect(bannerState(true, { isWebSocketConnected: false, hasEverConnected: true })).toBe(
      "reconnecting",
    );
  });

  it("is ok during the initial connect (never connected yet, online)", () => {
    expect(bannerState(true, { isWebSocketConnected: false, hasEverConnected: false })).toBe("ok");
  });

  it("is ok when online and connected", () => {
    expect(bannerState(true, { isWebSocketConnected: true, hasEverConnected: true })).toBe("ok");
  });
});
