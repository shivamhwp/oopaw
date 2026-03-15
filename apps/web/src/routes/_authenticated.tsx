import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: ({ context, location }) => {
    if (context.auth.isSignedIn) {
      return;
    }

    throw redirect({
      to: "/",
      search: {
        auth: "sign-in",
        redirect: location.href,
      },
    });
  },
  component: Outlet,
});
