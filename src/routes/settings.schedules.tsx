import React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";
import { SchedulesPanel } from "../settings/SchedulesPanel";
import { Spinner } from "../ui/spinner";

export const Route = createFileRoute("/settings/schedules")({ component: SettingsSchedulesRoute });

function GoLogin() {
  const navigate = useNavigate();
  React.useEffect(() => {
    void navigate({ to: "/login" });
  }, [navigate]);
  return null;
}

function SettingsSchedulesRoute() {
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
        <SchedulesPanel />
      </Authenticated>
    </>
  );
}
