import { useEffect } from "react";
import { useAuth } from "@clerk/tanstack-react-start";
import { Outlet, createFileRoute, useLocation, useNavigate } from "@tanstack/react-router";
import { SpinnerIcon } from "@phosphor-icons/react";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedRoute,
});

function AuthenticatedRoute() {
  const { isLoaded, isSignedIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!isLoaded || isSignedIn) {
      return;
    }

    void navigate({
      to: "/",
      search: {
        auth: "sign-in",
        redirect: location.href,
      },
      replace: true,
    });
  }, [isLoaded, isSignedIn, location.href, navigate]);

  if (!isLoaded || !isSignedIn) {
    return (
      <div className="flex h-svh items-center justify-center bg-background text-muted-foreground">
        <SpinnerIcon className="size-5 animate-spin" />
      </div>
    );
  }

  return <Outlet />;
}
