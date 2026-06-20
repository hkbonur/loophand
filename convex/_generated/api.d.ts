/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as apiTokens from "../apiTokens.js";
import type * as crons from "../crons.js";
import type * as deps from "../deps.js";
import type * as files from "../files.js";
import type * as http from "../http.js";
import type * as http_auth from "../http/auth.js";
import type * as http_mcp from "../http/mcp.js";
import type * as http_mcp_lib_convexErrors from "../http/mcp/lib/convexErrors.js";
import type * as http_mcp_lib_defineTool from "../http/mcp/lib/defineTool.js";
import type * as http_mcp_lib_descriptionLint from "../http/mcp/lib/descriptionLint.js";
import type * as http_mcp_lib_inputValidation from "../http/mcp/lib/inputValidation.js";
import type * as http_mcp_lib_jsonSchema from "../http/mcp/lib/jsonSchema.js";
import type * as http_mcp_lib_normalizeToolError from "../http/mcp/lib/normalizeToolError.js";
import type * as http_mcp_lib_responses from "../http/mcp/lib/responses.js";
import type * as http_mcp_lib_toolNameLint from "../http/mcp/lib/toolNameLint.js";
import type * as http_mcp_prompts_identity from "../http/mcp/prompts/identity.js";
import type * as http_mcp_server from "../http/mcp/server.js";
import type * as http_mcp_tools_index from "../http/mcp/tools/index.js";
import type * as http_mcp_tools_lib_scope from "../http/mcp/tools/lib/scope.js";
import type * as http_mcp_tools_tasks_awaitTask from "../http/mcp/tools/tasks/awaitTask.js";
import type * as http_mcp_tools_tasks_cancelTask from "../http/mcp/tools/tasks/cancelTask.js";
import type * as http_mcp_tools_tasks_createProject from "../http/mcp/tools/tasks/createProject.js";
import type * as http_mcp_tools_tasks_createTask from "../http/mcp/tools/tasks/createTask.js";
import type * as http_mcp_tools_tasks_fetchFile from "../http/mcp/tools/tasks/fetchFile.js";
import type * as http_mcp_tools_tasks_getTask from "../http/mcp/tools/tasks/getTask.js";
import type * as http_mcp_tools_tasks_index from "../http/mcp/tools/tasks/index.js";
import type * as http_mcp_tools_tasks_listProjects from "../http/mcp/tools/tasks/listProjects.js";
import type * as http_mcp_tools_tasks_listTasks from "../http/mcp/tools/tasks/listTasks.js";
import type * as http_mcp_tools_tasks_resumeItems from "../http/mcp/tools/tasks/resumeItems.js";
import type * as http_mcp_tools_tasks_roundTripShapes from "../http/mcp/tools/tasks/roundTripShapes.js";
import type * as http_mcp_tools_tasks_uploadScreenshot from "../http/mcp/tools/tasks/uploadScreenshot.js";
import type * as http_mcp_types from "../http/mcp/types.js";
import type * as http_storage from "../http/storage.js";
import type * as items from "../items.js";
import type * as lib_apiTokenAuth from "../lib/apiTokenAuth.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_clientIp from "../lib/clientIp.js";
import type * as lib_comments from "../lib/comments.js";
import type * as lib_cors from "../lib/cors.js";
import type * as lib_cron from "../lib/cron.js";
import type * as lib_deps from "../lib/deps.js";
import type * as lib_email from "../lib/email.js";
import type * as lib_items from "../lib/items.js";
import type * as lib_logger from "../lib/logger.js";
import type * as lib_notifyOwner from "../lib/notifyOwner.js";
import type * as lib_ownership from "../lib/ownership.js";
import type * as lib_preferences from "../lib/preferences.js";
import type * as lib_projectHelpers from "../lib/projectHelpers.js";
import type * as lib_pushPayload from "../lib/pushPayload.js";
import type * as lib_r2 from "../lib/r2.js";
import type * as lib_rateLimitGuard from "../lib/rateLimitGuard.js";
import type * as lib_render from "../lib/render.js";
import type * as lib_screenshots from "../lib/screenshots.js";
import type * as lib_tags from "../lib/tags.js";
import type * as lib_taskConstants from "../lib/taskConstants.js";
import type * as lib_taskInsert from "../lib/taskInsert.js";
import type * as lib_taskViews from "../lib/taskViews.js";
import type * as notify from "../notify.js";
import type * as preferences from "../preferences.js";
import type * as projects from "../projects.js";
import type * as push from "../push.js";
import type * as rateLimit from "../rateLimit.js";
import type * as reconcile from "../reconcile.js";
import type * as schedules from "../schedules.js";
import type * as seed from "../seed.js";
import type * as tasks from "../tasks.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  apiTokens: typeof apiTokens;
  crons: typeof crons;
  deps: typeof deps;
  files: typeof files;
  http: typeof http;
  "http/auth": typeof http_auth;
  "http/mcp": typeof http_mcp;
  "http/mcp/lib/convexErrors": typeof http_mcp_lib_convexErrors;
  "http/mcp/lib/defineTool": typeof http_mcp_lib_defineTool;
  "http/mcp/lib/descriptionLint": typeof http_mcp_lib_descriptionLint;
  "http/mcp/lib/inputValidation": typeof http_mcp_lib_inputValidation;
  "http/mcp/lib/jsonSchema": typeof http_mcp_lib_jsonSchema;
  "http/mcp/lib/normalizeToolError": typeof http_mcp_lib_normalizeToolError;
  "http/mcp/lib/responses": typeof http_mcp_lib_responses;
  "http/mcp/lib/toolNameLint": typeof http_mcp_lib_toolNameLint;
  "http/mcp/prompts/identity": typeof http_mcp_prompts_identity;
  "http/mcp/server": typeof http_mcp_server;
  "http/mcp/tools/index": typeof http_mcp_tools_index;
  "http/mcp/tools/lib/scope": typeof http_mcp_tools_lib_scope;
  "http/mcp/tools/tasks/awaitTask": typeof http_mcp_tools_tasks_awaitTask;
  "http/mcp/tools/tasks/cancelTask": typeof http_mcp_tools_tasks_cancelTask;
  "http/mcp/tools/tasks/createProject": typeof http_mcp_tools_tasks_createProject;
  "http/mcp/tools/tasks/createTask": typeof http_mcp_tools_tasks_createTask;
  "http/mcp/tools/tasks/fetchFile": typeof http_mcp_tools_tasks_fetchFile;
  "http/mcp/tools/tasks/getTask": typeof http_mcp_tools_tasks_getTask;
  "http/mcp/tools/tasks/index": typeof http_mcp_tools_tasks_index;
  "http/mcp/tools/tasks/listProjects": typeof http_mcp_tools_tasks_listProjects;
  "http/mcp/tools/tasks/listTasks": typeof http_mcp_tools_tasks_listTasks;
  "http/mcp/tools/tasks/resumeItems": typeof http_mcp_tools_tasks_resumeItems;
  "http/mcp/tools/tasks/roundTripShapes": typeof http_mcp_tools_tasks_roundTripShapes;
  "http/mcp/tools/tasks/uploadScreenshot": typeof http_mcp_tools_tasks_uploadScreenshot;
  "http/mcp/types": typeof http_mcp_types;
  "http/storage": typeof http_storage;
  items: typeof items;
  "lib/apiTokenAuth": typeof lib_apiTokenAuth;
  "lib/auth": typeof lib_auth;
  "lib/clientIp": typeof lib_clientIp;
  "lib/comments": typeof lib_comments;
  "lib/cors": typeof lib_cors;
  "lib/cron": typeof lib_cron;
  "lib/deps": typeof lib_deps;
  "lib/email": typeof lib_email;
  "lib/items": typeof lib_items;
  "lib/logger": typeof lib_logger;
  "lib/notifyOwner": typeof lib_notifyOwner;
  "lib/ownership": typeof lib_ownership;
  "lib/preferences": typeof lib_preferences;
  "lib/projectHelpers": typeof lib_projectHelpers;
  "lib/pushPayload": typeof lib_pushPayload;
  "lib/r2": typeof lib_r2;
  "lib/rateLimitGuard": typeof lib_rateLimitGuard;
  "lib/render": typeof lib_render;
  "lib/screenshots": typeof lib_screenshots;
  "lib/tags": typeof lib_tags;
  "lib/taskConstants": typeof lib_taskConstants;
  "lib/taskInsert": typeof lib_taskInsert;
  "lib/taskViews": typeof lib_taskViews;
  notify: typeof notify;
  preferences: typeof preferences;
  projects: typeof projects;
  push: typeof push;
  rateLimit: typeof rateLimit;
  reconcile: typeof reconcile;
  schedules: typeof schedules;
  seed: typeof seed;
  tasks: typeof tasks;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
  r2: import("@convex-dev/r2/_generated/component.js").ComponentApi<"r2">;
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
};
