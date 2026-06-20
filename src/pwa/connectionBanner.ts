// Pure mapping from browser + Convex connection signals to the banner state.
// Kept separate from the hook/component so the precedence rules are unit-testable.

export type BannerState = "ok" | "offline" | "reconnecting";

export interface ConvexConnection {
  isWebSocketConnected: boolean;
  // True once the client has ever reached a ready WebSocket — lets us tell a
  // genuine drop ("reconnecting") from the brief initial connect on first load.
  hasEverConnected: boolean;
}

// Browser-offline wins (nothing will reach the server). Otherwise, a dropped
// socket after a prior successful connect is a reconnect. A first-load connect
// in progress reads as "ok" so the banner doesn't flash on every page open.
export function bannerState(online: boolean, conn: ConvexConnection): BannerState {
  if (!online) return "offline";
  if (conn.hasEverConnected && !conn.isWebSocketConnected) return "reconnecting";
  return "ok";
}
