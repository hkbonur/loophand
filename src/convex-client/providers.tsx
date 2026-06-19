import React from "react";
import { ConvexBetterAuthProvider, type AuthClient } from "@convex-dev/better-auth/react";
import { authClient } from "./auth-client";
import { convexClient } from "./convex-client";

interface Props {
  children: React.ReactNode;
}

// Library boundary: better-auth@1.6.19 types `useSession().data` more precisely
// than the provider's `AuthClient` union expects, so the concrete client needs
// an explicit widen. Runtime usage is exactly the documented integration.
const typedAuthClient = authClient as unknown as AuthClient;

export function ConvexAuthProvider(props: Props) {
  return (
    <ConvexBetterAuthProvider client={convexClient} authClient={typedAuthClient}>
      {props.children}
    </ConvexBetterAuthProvider>
  );
}
