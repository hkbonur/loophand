import { z } from "zod";
import { internal } from "../../../../_generated/api";
import type { Id } from "../../../../_generated/dataModel";
import { defineTool } from "../../lib/defineTool";
import { mcpSuccess, mcpEnvelope } from "../../lib/responses";
import { requireTaskScope } from "../lib/scope";

interface ProjectRow {
  _id: Id<"projects">;
  name: string;
  isDefault: boolean;
  createdAt: number;
}

const schema = z.object({});

export const listProjectsTool = defineTool({
  name: "list_projects",
  description:
    "Lists your projects (isolated boards). Returns each project's id, name, and whether it is your default board.",
  schema,
  responseShape: mcpEnvelope({ projects: z.array(z.unknown()), count: z.number() }),
  execute: async (mcpCtx) => {
    requireTaskScope(mcpCtx, "read");
    const rows: ProjectRow[] = await mcpCtx.ctx.runQuery(internal.projects.listForUser, {
      userId: mcpCtx.userId,
    });
    const projects = rows.map((p) => ({
      project_id: p._id,
      name: p.name,
      is_default: p.isDefault,
    }));
    return mcpSuccess({ projects, count: projects.length });
  },
});
