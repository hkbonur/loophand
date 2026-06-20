// @vitest-environment node
import { describe, expect, test } from "vitest";
import { Document, Page, View, Text } from "@react-pdf/renderer";
import { isValidElement } from "react";
import { treeToDocument, type DocNode } from "./treeToDocument";

// React stores a single child as the value and multiple children as an array;
// normalize so assertions don't care which.
function childrenOf(el: unknown): unknown[] {
  if (!isValidElement(el)) return [];
  const kids = (el.props as { children?: unknown }).children;
  return Array.isArray(kids) ? kids : kids == null ? [] : [kids];
}

describe("treeToDocument", () => {
  test("throws when the root is not a Document", () => {
    expect(() => treeToDocument({ type: "Page" })).toThrow(/Document/);
  });

  test("maps the whitelist Document > Page > Text and keeps the text leaf", () => {
    const tree: DocNode = {
      type: "Document",
      children: [{ type: "Page", children: [{ type: "Text", text: "hello" }] }],
    };
    const doc = treeToDocument(tree);
    expect(doc.type).toBe(Document);

    const page = childrenOf(doc)[0];
    expect(isValidElement(page) && page.type).toBe(Page);

    const text = childrenOf(page)[0];
    expect(isValidElement(text) && text.type).toBe(Text);
    expect((text as { props: { children: unknown } }).props.children).toBe("hello");
  });

  test("drops unknown node types instead of rendering them", () => {
    const tree: DocNode = {
      type: "Document",
      children: [
        {
          type: "Page",
          children: [
            { type: "View", children: [] },
            { type: "Script", text: "evil()" } as DocNode, // not in the whitelist
          ],
        },
      ],
    };
    const page = childrenOf(treeToDocument(tree))[0];
    const kids = childrenOf(page);
    expect(kids).toHaveLength(1);
    expect(isValidElement(kids[0]) && kids[0].type).toBe(View);
  });
});
