import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { type ReactNode } from "react";

import appCss from "../styles.css?url";
import icareerIcon from "../assets/icareer-icon.png";

function NotFoundComponent() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-60" />
      <div className="pointer-events-none absolute inset-0 bg-radial-fade" />
      <div className="relative max-w-md rounded-2xl border border-border bg-surface p-8 text-center shadow-card">
        <Link to="/" className="font-display text-2xl font-bold tracking-tight text-ink">
          <span className="text-accent">i</span>Career
        </Link>
        <h1 className="mt-6 font-display text-6xl font-semibold text-accent">404</h1>
        <h2 className="mt-2 font-display text-lg font-semibold text-ink">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90"
        >
          Go home
        </Link>
      </div>
    </main>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-60" />
      <div className="pointer-events-none absolute inset-0 bg-radial-fade" />
      <div className="relative max-w-md rounded-2xl border border-border bg-surface p-8 text-center shadow-card">
        <Link to="/" className="font-display text-2xl font-bold tracking-tight text-ink">
          <span className="text-accent">i</span>Career
        </Link>
        <h1 className="mt-6 font-display text-lg font-semibold text-ink">This page didn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90"
          >
            Try again
          </button>
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-muted"
          >
            Go home
          </Link>
        </div>
      </div>
    </main>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "iCareer — AI-powered job matching" },
      {
        name: "description",
        content:
          "iCareer matches Egyptian talent to the right roles using AI. Submit your CV once, skip the calls, and get placed faster.",
      },
      { name: "author", content: "iCareer" },
      { property: "og:title", content: "iCareer — AI-powered job matching" },
      {
        property: "og:description",
        content: "Submit your CV once and let our AI match you with the role that fits best.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      {
        rel: "icon",
        type: "image/png",
        href: icareerIcon,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
    </QueryClientProvider>
  );
}
