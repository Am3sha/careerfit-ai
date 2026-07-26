import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/" });
    return { user: data.user };
  },
  component: () => <Outlet />,
  errorComponent: ({ error }) => (
    <div className="flex min-h-screen items-center justify-center bg-background p-6 text-center">
      <p className="text-sm text-muted-foreground">{error.message}</p>
    </div>
  ),
});
