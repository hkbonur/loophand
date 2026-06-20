import { createRootRoute, Outlet } from "@tanstack/react-router";
import { ConvexAuthProvider } from "../convex-client";
import { Toaster } from "../ui/toaster";
import { ServiceWorker } from "../pwa/ServiceWorker";
import { ConnectionBanner } from "../pwa/OfflineBanner";
import { AccountMenu } from "../components/AccountMenu";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <ConvexAuthProvider>
      <ConnectionBanner />
      <div className="fixed right-4 top-4 z-40">
        <AccountMenu />
      </div>
      <Outlet />
      <Toaster />
      <ServiceWorker />
    </ConvexAuthProvider>
  );
}
