import type { McpTool } from "../../types";
import { createTaskTool } from "./createTask";
import { getTaskTool } from "./getTask";
import { awaitTaskTool } from "./awaitTask";
import { cancelTaskTool } from "./cancelTask";
import { listTasksTool } from "./listTasks";
import { listProjectsTool } from "./listProjects";
import { createProjectTool } from "./createProject";
import { uploadScreenshotTool } from "./uploadScreenshot";
import { fetchFileTool } from "./fetchFile";
import { resumeItemsTool } from "./resumeItems";

export const taskTools: McpTool[] = [
  createTaskTool,
  getTaskTool,
  awaitTaskTool,
  cancelTaskTool,
  listTasksTool,
  listProjectsTool,
  createProjectTool,
  uploadScreenshotTool,
  fetchFileTool,
  resumeItemsTool,
];
