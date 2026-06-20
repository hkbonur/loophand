import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type { AgentInfo } from "./AgentChip";

export type AgentDirectory = Map<Id<"apiTokens">, AgentInfo>;

// Token id → agent name + liveness, for board attribution chips. Backed by the
// same apiTokens.list subscription the Agents panel uses; Convex dedupes the
// query, so calling this from many cards costs one live subscription.
export function useAgents(): AgentDirectory {
  const tokens = useQuery(api.apiTokens.list, {});
  return useMemo(() => {
    const map: AgentDirectory = new Map();
    for (const token of tokens ?? []) {
      map.set(token._id, { name: token.name, lastUsedAt: token.lastUsedAt });
    }
    return map;
  }, [tokens]);
}
