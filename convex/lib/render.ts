import { ConvexError } from "convex/values";

// A doc_review item's payload: the agent-supplied recipe the client renders to a
// PDF. `react_pdf` is a constrained, serializable node tree (mapped to
// @react-pdf/renderer in the browser — no server render, no eval); the tree's
// node/style whitelist is enforced at render time, client-side. `xsl_fo` is
// reserved but not implemented this phase (it needs a hardened server FOP
// action). See the Phase 3 plan + docs/adr/0001.
export type RenderSpec =
  | { kind: "react_pdf"; tree: unknown }
  | { kind: "xsl_fo"; source: string };

// The shape doc_review items carry in `data`.
export interface DocItemData {
  render: RenderSpec;
}

function fail(code: string, message: string): never {
  throw new ConvexError({ code, message });
}

// Structurally validate a doc_review item's data. Light by design: the deep
// node/style whitelist is the client renderer's job; here we only guarantee a
// well-formed, supported recipe is what gets stored. `label` locates the bad
// item in the error (e.g. "items[2]").
export function assertDocItemData(data: unknown, label: string): void {
  if (typeof data !== "object" || data === null || !("render" in data)) {
    fail("VALIDATION_ERROR", `${label}: doc_review items need a { render } spec.`);
  }
  const render = (data as { render: unknown }).render;
  if (typeof render !== "object" || render === null || !("kind" in render)) {
    fail("VALIDATION_ERROR", `${label}: render must be { kind, … }.`);
  }
  const kind = (render as { kind: unknown }).kind;
  if (kind === "xsl_fo") {
    fail("NOT_IMPLEMENTED", `${label}: xsl_fo rendering is not available yet — use react_pdf.`);
  }
  if (kind !== "react_pdf") {
    fail("VALIDATION_ERROR", `${label}: unsupported render kind "${String(kind)}".`);
  }
  if (!("tree" in render) || typeof (render as { tree: unknown }).tree !== "object") {
    fail("VALIDATION_ERROR", `${label}: react_pdf render needs a "tree" object.`);
  }
}
