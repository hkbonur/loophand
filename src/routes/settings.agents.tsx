import React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";
import { AgentsPanel } from "../settings/AgentsPanel";
import { Spinner } from "../ui/spinner";

export const Route = createFileRoute("/settings/agents")({ component: SettingsAgentsRoute });

function GoLogin() {
  const navigate = useNavigate();
  React.useEffect(() => {
    void navigate({ to: "/login" });
  }, [navigate]);
  return null;
}

function SettingsAgentsRoute() {
  return (
    <>
      <AuthLoading>
        <div className="flex min-h-screen items-center justify-center">
          <Spinner />
        </div>
      </AuthLoading>
      <Unauthenticated>
        <GoLogin />
      </Unauthenticated>
      <Authenticated>
        <AgentsPanel />
      </Authenticated>
    </>
  );
}
