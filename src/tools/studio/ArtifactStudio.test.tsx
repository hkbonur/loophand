// @vitest-environment jsdom
import { afterEach, describe, expect, test } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ArtifactStudio } from "./ArtifactStudio";

afterEach(() => cleanup());

describe("ArtifactStudio", () => {
  test("renders the artifact preview (children)", () => {
    render(
      <ArtifactStudio>
        <div>preview</div>
      </ArtifactStudio>,
    );
    expect(screen.getByText("preview")).toBeTruthy();
  });

  test("renders the toolbar, aside, and actions slots when given", () => {
    render(
      <ArtifactStudio
        toolbar={<button>crop</button>}
        aside={<div>comments</div>}
        actions={<button>export</button>}
      >
        <div>preview</div>
      </ArtifactStudio>,
    );
    expect(screen.getByRole("button", { name: "crop" })).toBeTruthy();
    expect(screen.getByText("comments")).toBeTruthy();
    expect(screen.getByRole("button", { name: "export" })).toBeTruthy();
  });

  test("omits optional slots when not provided", () => {
    render(
      <ArtifactStudio>
        <div>preview</div>
      </ArtifactStudio>,
    );
    expect(screen.queryByRole("group", { name: "Tools" })).toBeNull();
  });
});
