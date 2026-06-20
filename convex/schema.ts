import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// =============================================================================
// loophand schema — fresh, no migrations. Two groups:
//   1. Foundation — keyed on `userId` (NO workspace/team tables):
//      apiTokens, oauth*, managedFiles*.
//   2. Domain — the kanban: projects, tasks, taskItems, taskDeps, taskActivity,
//      taskComments, taskAudit, schedules, pushSubscriptions.
//
// Hard security boundary = `userId`. Logical board isolation = `projectId`.
// =============================================================================

// Status = the kanban column axis. NO `in_progress` (review happens in-place).
export const TASK_STATUSES = ["open", "awaiting_agent", "resumed", "done", "blocked"] as const;
const taskStatus = v.union(...TASK_STATUSES.map((s) => v.literal(s)));

// Per-item state inside a multi-item task. `pending` until the human acts;
// `approved`/`changes_requested`/`skipped` are the human verdicts. Drives the
// item loop (ADR-0002): a task auto-completes when no item is `pending` and none
// is `changes_requested`.
export const TASK_ITEM_STATUSES = [
  "pending",
  "approved",
  "changes_requested",
  "skipped",
] as const;
const taskItemStatus = v.union(...TASK_ITEM_STATUSES.map((s) => v.literal(s)));

// Outcome = a separate badge, orthogonal to status.
export const TASK_OUTCOMES = [
  "approved",
  "changes_requested",
  "cancelled",
  "expired",
  "dependency_failed",
] as const;
const taskOutcome = v.union(...TASK_OUTCOMES.map((o) => v.literal(o)));

// visual_review input: the screenshot the human annotates plus which viewports
// to offer. A fixed shape — typed here (not `v.any()`) and reused by the create
// tool. Widen to a discriminated union once a second tool type carries its own
// payload (doc_review / input / …).
export const viewportValidator = v.union(v.literal("desktop"), v.literal("mobile"));
export const toolPayloadValidator = v.object({
  screenshotFileId: v.id("managedFiles"),
  viewports: v.optional(v.array(viewportValidator)),
});

export default defineSchema({
  // ── Foundation ───────────────────────────────────────────────────────────

  // App-level user mirror. Better Auth owns the auth tables inside its
  // component; `ensureUser` upserts this row from the auth identity at sign-in
  // so every domain row can key on a stable `Id<'users'>`.
  users: defineTable({
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    provider: v.optional(v.string()),
    createdAt: v.optional(v.number()),
    // Throttle clock for owner push notifications (see tasks.maybeNotifyOwner).
    lastNotifiedAt: v.optional(v.number()),
    // Running total of referenced output-artifact bytes, for the storage quota
    // (Phase 6). Maintained by files.recordOutput (+) and supersede reclaim (−);
    // absent = 0. Outputs only — screenshot inputs are size-capped + cron-reclaimed.
    storageBytes: v.optional(v.number()),
  }).index("by_email", ["email"]),

  // Bearer credentials, bound to `userId`. `api_key` = user-minted;
  // `oauth_access` = issued by the OAuth server.
  apiTokens: defineTable({
    userId: v.id("users"),
    tokenType: v.union(v.literal("api_key"), v.literal("oauth_access")),
    name: v.string(),
    tokenHash: v.string(),
    tokenPrefix: v.string(),
    // Space-delimited OAuth scope string, e.g. "tasks:read tasks:write".
    scope: v.optional(v.string()),
    clientId: v.optional(v.string()),
    resource: v.optional(v.string()),
    createdAt: v.number(),
    lastUsedAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
    expiresAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_token_hash", ["tokenHash"]),

  // OAuth 2.1 server tables (userId-bound — no workspaceId). Defined from day
  // one for completeness; interactive authorize/token endpoints land later.
  oauthClients: defineTable({
    clientId: v.string(),
    clientSecretHash: v.optional(v.string()),
    name: v.string(),
    redirectUris: v.array(v.string()),
    userId: v.optional(v.id("users")),
    createdAt: v.number(),
  }).index("by_clientId", ["clientId"]),

  oauthAuthCodes: defineTable({
    code: v.string(),
    clientId: v.string(),
    userId: v.id("users"),
    redirectUri: v.string(),
    scope: v.optional(v.string()),
    codeChallenge: v.optional(v.string()),
    codeChallengeMethod: v.optional(v.string()),
    resource: v.optional(v.string()),
    expiresAt: v.number(),
    createdAt: v.number(),
  }).index("by_code", ["code"]),

  oauthRefreshTokens: defineTable({
    tokenHash: v.string(),
    clientId: v.string(),
    userId: v.id("users"),
    scope: v.optional(v.string()),
    expiresAt: v.number(),
    createdAt: v.number(),
    revokedAt: v.optional(v.number()),
  }).index("by_token_hash", ["tokenHash"]),

  // R2-backed files. Owner-agnostic: keyed by random `r2Key`; ownership lives
  // on managedFileReferences so a blob can be referenced by many owners.
  managedFiles: defineTable({
    r2Key: v.string(),
    contentType: v.optional(v.string()),
    size: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_r2Key", ["r2Key"]),

  managedFileReferences: defineTable({
    fileId: v.id("managedFiles"),
    // `task`/`taskItem` present from day one. Ownership lives on the
    // reference, not the file, so one blob can have many owners.
    ownerType: v.union(v.literal("task"), v.literal("taskItem")),
    ownerId: v.string(),
    // Stable, human-meaningful output name (e.g. "item-1.pdf") an agent fetches
    // by via fetch_file(task_id, name). Undefined for inputs (a screenshot the
    // agent already holds the id for). See docs/adr/0001.
    name: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_file", ["fileId"])
    .index("by_owner", ["ownerType", "ownerId"])
    .index("by_owner_name", ["ownerType", "ownerId", "name"]),

  pendingR2Uploads: defineTable({
    r2Key: v.string(),
    userId: v.id("users"),
    contentType: v.optional(v.string()),
    createdAt: v.number(),
    expiresAt: v.number(),
  })
    .index("by_r2Key", ["r2Key"])
    .index("by_expires", ["expiresAt"]),

  // ── Domain ───────────────────────────────────────────────────────────────

  // One isolated kanban board — the unit of tenancy under a user.
  projects: defineTable({
    name: v.string(),
    userId: v.id("users"),
    createdByTokenId: v.optional(v.id("apiTokens")),
    isDefault: v.boolean(),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  // The kanban ticket. `status` = column; `outcome` = badge.
  tasks: defineTable({
    userId: v.id("users"),
    projectId: v.id("projects"),
    createdByTokenId: v.optional(v.id("apiTokens")),
    // Open enum (approval in v1; visual_review/doc_review/input/… later).
    // Validated against the allowed set in the tool layer.
    type: v.string(),
    title: v.string(),
    instructions: v.string(),
    acceptanceCriteria: v.optional(v.string()),
    tags: v.array(v.string()),
    status: taskStatus,
    // Badge — null is represented by omitting the field.
    outcome: v.optional(taskOutcome),
    // Result payload returned to the agent on resolve (arbitrary JSON).
    result: v.optional(v.any()),
    // Tool input the agent supplied at create time (e.g. visual_review carries
    // `{ screenshotFileId, viewports }`). Shape is validated in the tool layer.
    toolPayload: v.optional(v.any()),
    resultVersion: v.number(),
    // Optimistic-concurrency guard against double-resolution.
    revision: v.number(),
    resumedByTokenId: v.optional(v.id("apiTokens")),
    resultConsumedAt: v.optional(v.number()),
    idempotencyKey: v.optional(v.string()),
    // Multi-item bookkeeping (Phase 3, opt-in). Set only when the agent supplied
    // `items[]` at create. `itemsDone` = count of non-pending items; when it
    // reaches `itemCount` the rollup wakes await_task (ADR-0002).
    itemCount: v.optional(v.number()),
    itemsDone: v.optional(v.number()),
    // Earliest time a blocked task may open (Phase 5 `not_before`). A blocked
    // task releases only once every dep is approved AND notBefore has passed.
    notBefore: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project_status", ["projectId", "status"])
    .index("by_user_status", ["userId", "status"])
    .index("by_project", ["projectId"])
    .index("by_token", ["createdByTokenId"])
    .index("by_idempotency", ["userId", "idempotencyKey"])
    .index("by_expires", ["expiresAt"]),

  // Ordered rail items for a multi-item task (Phase 3). `kind` mirrors the task
  // type; `data` carries the per-item surface payload (e.g. a doc render spec or
  // a screenshot id). `status` is the human verdict; `result` is the per-item
  // feedback echoed into the task rollup.
  taskItems: defineTable({
    taskId: v.id("tasks"),
    order: v.number(),
    kind: v.string(),
    title: v.optional(v.string()),
    data: v.optional(v.any()),
    status: taskItemStatus,
    result: v.optional(v.any()),
    updatedAt: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_task_order", ["taskId", "order"]),

  // Dependency DAG (Phase 5).
  taskDeps: defineTable({
    taskId: v.id("tasks"),
    dependsOnTaskId: v.id("tasks"),
    createdAt: v.number(),
  })
    .index("by_task", ["taskId"])
    .index("by_dependsOn", ["dependsOnTaskId"]),

  // Append-only activity stream (glass-box, Phase 6).
  taskActivity: defineTable({
    taskId: v.id("tasks"),
    type: v.string(),
    actorUserId: v.optional(v.id("users")),
    actorTokenId: v.optional(v.id("apiTokens")),
    data: v.optional(v.any()),
    createdAt: v.number(),
  }).index("by_task", ["taskId"]),

  taskComments: defineTable({
    taskId: v.id("tasks"),
    userId: v.optional(v.id("users")),
    tokenId: v.optional(v.id("apiTokens")),
    body: v.string(),
    createdAt: v.number(),
  }).index("by_task", ["taskId"]),

  // Resolution audit — one row per human action.
  taskAudit: defineTable({
    taskId: v.id("tasks"),
    userId: v.id("users"),
    action: v.string(),
    fromStatus: v.optional(taskStatus),
    toStatus: v.optional(taskStatus),
    outcome: v.optional(taskOutcome),
    revision: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_task", ["taskId"]),

  pushSubscriptions: defineTable({
    userId: v.id("users"),
    endpoint: v.string(),
    p256dh: v.string(),
    auth: v.string(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_endpoint", ["endpoint"]),
});
