import React from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, Key, Trash } from "@phosphor-icons/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Spinner } from "../ui/spinner";
import { Empty } from "../ui/empty";
import { ConnectSnippet } from "../board/ConnectSnippet";
import { toast } from "../ui/toaster";

export function AgentsPanel() {
  const tokens = useQuery(api.apiTokens.list, {});
  const createToken = useMutation(api.apiTokens.create);
  const revokeToken = useMutation(api.apiTokens.revoke);
  const [name, setName] = React.useState("");
  const [minting, setMinting] = React.useState(false);
  const [freshKey, setFreshKey] = React.useState<string | null>(null);

  const mint = React.useCallback(async () => {
    setMinting(true);
    try {
      const result = await createToken({ name: name.trim() || undefined });
      setFreshKey(result.token);
      setName("");
      toast.success("API key minted — copy it now, it won't be shown again.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not mint a key.");
    } finally {
      setMinting(false);
    }
  }, [createToken, name]);

  const revoke = React.useCallback(
    async (id: Id<"apiTokens">) => {
      try {
        await revokeToken({ id });
        toast.success("Key revoked.");
      } catch {
        toast.error("Could not revoke the key.");
      }
    },
    [revokeToken],
  );

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <Link
        to="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground no-underline hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to board
      </Link>

      <h1 className="mb-1 text-2xl font-bold text-foreground">Agents</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Mint an API key, then drop it into your agent's <code>.mcp.json</code>. Keys carry full task
        access.
      </p>

      <section className="mb-8 rounded-3xl border border-border bg-muted p-5">
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Key name
            </label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. laptop / claude-code"
              className="h-10 w-full rounded-full border border-border bg-card px-4 text-sm text-foreground focus:border-primary focus:outline-none"
            />
          </div>
          <Button disabled={minting} onClick={mint}>
            {minting ? <Spinner className="text-white" /> : <Key className="h-4 w-4" />}
            Mint key
          </Button>
        </div>

        {freshKey ? (
          <div className="mt-4">
            <p className="mb-2 text-sm font-medium text-foreground">
              Your new key (shown once):
            </p>
            <ConnectSnippet apiKey={freshKey} />
          </div>
        ) : null}
      </section>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Existing keys
      </h2>
      {tokens === undefined ? (
        <Spinner />
      ) : tokens.length === 0 ? (
        <Empty title="No keys yet" description="Mint one above to connect your first agent." />
      ) : (
        <ul className="flex flex-col gap-2">
          {tokens.map((token) => (
            <li
              key={token._id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{token.name}</p>
                <p className="font-mono text-xs text-muted-foreground">{token.tokenPrefix}…</p>
              </div>
              <div className="flex items-center gap-2">
                {token.isRevoked ? (
                  <Badge tone="danger">Revoked</Badge>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => revoke(token._id)}>
                    <Trash className="h-3.5 w-3.5" />
                    Revoke
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
