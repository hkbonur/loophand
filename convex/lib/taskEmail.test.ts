import { describe, it, expect } from "vitest";
import { buildTaskEmail } from "./taskEmail";

describe("buildTaskEmail", () => {
  it("puts the title in the subject", () => {
    const { subject } = buildTaskEmail({ title: "Ship the README", type: "approval", url: null });
    expect(subject).toBe("Review needed: Ship the README");
  });

  it("escapes HTML in the title to prevent injection", () => {
    const { html } = buildTaskEmail({
      title: '<img src=x onerror=alert(1)>',
      type: "approval",
      url: null,
    });
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });

  it("includes an Open-the-card button when a url is given", () => {
    const { html } = buildTaskEmail({
      title: "T",
      type: "approval",
      url: "https://app.example.com/?task=abc",
    });
    expect(html).toContain("https://app.example.com/?task=abc");
    expect(html).toContain("Open the card");
  });

  it("omits the button when url is null", () => {
    const { html } = buildTaskEmail({ title: "T", type: "approval", url: null });
    expect(html).not.toContain("Open the card");
  });

  it("collapses whitespace and caps the subject length", () => {
    const { subject } = buildTaskEmail({ title: "a".repeat(200), type: "approval", url: null });
    expect(subject.length).toBeLessThanOrEqual("Review needed: ".length + 120);
  });
});
