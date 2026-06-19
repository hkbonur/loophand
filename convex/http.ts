import { httpRouter } from "convex/server";
import { registerAuthRoutes } from "./http/auth";
import { registerStorageRoutes } from "./http/storage";
import { registerMcpRoutes } from "./http/mcp";

const http = httpRouter();

registerAuthRoutes(http);
registerStorageRoutes(http);
registerMcpRoutes(http);

export default http;
