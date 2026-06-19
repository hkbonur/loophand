// The Web Push payload carries IDs ONLY — never task content (title,
// instructions, comments). The push service and the OS see nothing sensitive;
// the service worker shows a generic notification and deep-links by id, and the
// app fetches the real task (behind auth) when the human opens it.
export function buildPushPayload(taskId: string, projectId: string): string {
  return JSON.stringify({ type: "task_created", taskId, projectId });
}

// 404 Not Found / 410 Gone from the push service mean the browser dropped this
// subscription — it should be pruned. Other errors (timeouts, 5xx) are transient.
export function isDeadPushError(statusCode: number | undefined): boolean {
  return statusCode === 404 || statusCode === 410;
}
