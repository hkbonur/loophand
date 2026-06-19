import React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";
import { AuthLoginPage } from "../auth-ui/auth-login-page";
import { Spinner } from "../ui/spinner";

export const Route = createFileRoute("/login")({ component: LoginRoute });

function GoBoard() {
  const navigate = useNavigate();
  React.useEffect(() => {
    void navigate({ to: "/" });
  }, [navigate]);
  return null;
}

function LoginRoute() {
  return (
    <>
      <AuthLoading>
        <div className="flex min-h-screen items-center justify-center">
          <Spinner />
        </div>
      </AuthLoading>
      <Authenticated>
        <GoBoard />
      </Authenticated>
      <Unauthenticated>
        <AuthLoginPage />
      </Unauthenticated>
    </>
  );
}
