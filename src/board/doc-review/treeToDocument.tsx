import { Document, Page, View, Text, Image, Link } from "@react-pdf/renderer";
import type { ComponentProps, ReactElement } from "react";

type DocumentElement = ReactElement<ComponentProps<typeof Document>>;

// A node in the agent-supplied react_pdf render tree. Serializable (it crosses
// the MCP wire as plain JSON) and deliberately small: the only node types the
// client will instantiate are the whitelist below. An unknown `type` is dropped,
// never executed — there is no code path from agent input to a React component
// outside this map, so a hostile tree can't do more than draw boxes and text.
export interface DocNode {
  type: string;
  style?: Record<string, unknown>;
  text?: string;
  src?: string;
  children?: DocNode[];
}

// The allowed components. Mapping by name (not by evaluating anything) is what
// keeps this safe — see the note above.
const COMPONENTS = { Document, Page, View, Text, Image, Link } as const;
type NodeType = keyof typeof COMPONENTS;

const MAX_DEPTH = 50;

function isNodeType(type: string): type is NodeType {
  return type in COMPONENTS;
}

function renderChildren(children: DocNode[] | undefined, depth: number): ReactElement[] {
  if (!children || depth >= MAX_DEPTH) return [];
  const out: ReactElement[] = [];
  children.forEach((child, i) => {
    const el = renderNode(child, depth + 1, String(i));
    if (el) out.push(el);
  });
  return out;
}

function renderNode(node: DocNode, depth: number, key: string): ReactElement | null {
  if (depth >= MAX_DEPTH || !isNodeType(node.type)) return null;
  const style = node.style as never;

  switch (node.type) {
    case "Text":
      // A Text node is a leaf when it carries `text`; otherwise it wraps inline
      // children (e.g. a Link inside a paragraph).
      return (
        <Text key={key} style={style}>
          {node.text ?? renderChildren(node.children, depth)}
        </Text>
      );
    case "Image":
      return typeof node.src === "string" ? <Image key={key} style={style} src={node.src} /> : null;
    case "Link":
      return (
        <Link key={key} style={style} src={typeof node.src === "string" ? node.src : ""}>
          {node.text ?? renderChildren(node.children, depth)}
        </Link>
      );
    case "Document":
      // A nested Document is invalid — only the root may be one.
      return null;
    case "Page":
      return (
        <Page key={key} style={style}>
          {renderChildren(node.children, depth)}
        </Page>
      );
    case "View":
      return (
        <View key={key} style={style}>
          {renderChildren(node.children, depth)}
        </View>
      );
  }
}

// Map a render tree to a react-pdf <Document>. Throws on a non-Document root so
// the caller can show the render-error fallback rather than a blank PDF.
export function treeToDocument(tree: DocNode): DocumentElement {
  if (!tree || tree.type !== "Document") {
    throw new Error("Render tree root must be a Document node.");
  }
  return <Document>{renderChildren(tree.children, 0)}</Document>;
}
