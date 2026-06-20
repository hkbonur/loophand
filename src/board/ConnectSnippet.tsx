import { CheckIcon, CopyIcon } from "@phosphor-icons/react";
import React from "react";
import { toast } from "../ui/toaster";

const MCP_URL = `${import.meta.env.VITE_CONVEX_SITE_URL ?? ""}/api/mcp`;

interface Props {
  apiKey?: string;
}

function buildConfig(key: string): string {
  return JSON.stringify(
    {
      mcpServers: {
        loophand: {
          type: "http",
          url: MCP_URL,
          headers: { Authorization: `Bearer ${key}` },
        },
      },
    },
    null,
    2,
  );
}

export function ConnectSnippet(props: Props) {
  const [copied, setCopied] = React.useState(false);
  const config = buildConfig(props.apiKey ?? "<YOUR_API_KEY>");

  const copy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(config);
      setCopied(true);
      toast.success("Copied .mcp.json snippet.");
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Copy failed — select and copy manually.");
    }
  }, [config]);

  return (
    <div className="relative w-full max-w-xl">
      <button
        type="button"
        onClick={copy}
        aria-label="Copy snippet"
        className="absolute right-3 top-3 rounded-lg border border-border bg-card p-1.5 text-muted-foreground shadow-sm transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        {copied ? <CheckIcon className="h-3.5 w-3.5" /> : <CopyIcon className="h-3.5 w-3.5" />}
      </button>
      <pre className="overflow-auto rounded-2xl border border-border bg-muted p-4 text-left font-mono text-xs text-foreground">
        {config}
      </pre>
    </div>
  );
}
