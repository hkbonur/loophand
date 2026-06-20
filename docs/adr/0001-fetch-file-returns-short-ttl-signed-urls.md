# fetch_file returns short-TTL signed URLs, not the public storage proxy

The board's storage proxy (`/api/storage/<r2Key>`) is intentionally public and
unauthenticated — it serves `<img>` embeds the browser can't bearer-authenticate, and
is safe only because R2 keys are random UUIDs. The agent fetch path has different
needs: it must be owner-scoped, not merely unguessable.

So `fetch_file(task_id, name)` does **not** reuse the proxy and does **not** return the
raw R2 key. It resolves the **output name** to a `managedFileReferences` row, asserts the
caller owns the task (`userId` + the task's project, via `tasks:read`), then mints a
*fresh* signed R2 URL with a short TTL (`SIGNED_URL_TTL_SECONDS`, ~15 min) and returns
that. Ownership is checked at mint time; the URL self-expires.

**Considered and rejected:**
- *Reuse the permanent public proxy URL* — leaves a non-expiring, publicly resolvable
  URL after the call; owner-scoping would be unguessability only.
- *Return raw bytes base64 in the MCP envelope* — symmetric with `upload_screenshot`,
  but bloats large/many-page PDFs through the response and any token limits.

**Consequences:** the stable-name → reference → signed-URL chain (plus a random UUID R2
key) closes the stable-key IDOR: there is no guessable cross-user/project key, and a
foreign `task_id`/`name` resolves to the same NOT_FOUND the rest of the system uses. The
agent must GET the URL within the TTL; an expired URL means calling `fetch_file` again.
