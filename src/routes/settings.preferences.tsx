import React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";
import { PreferencesPanel } from "../settings/PreferencesPanel";
import { Spinner } from "../ui/spinner";

export const Route = createFileRoute("/settings/preferences")({ component: SettingsPreferencesRoute });

function GoLogin() {
  const navigate = useNavigate();
  React.useEffect(() => {
    void navigate({ to: "/login" });
  }, [navigate]);
  return null;
}

function SettingsPreferencesRoute() {
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
        <PreferencesPanel />
      </Authenticated>
    </>
  );
}
