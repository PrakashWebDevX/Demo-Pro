import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

function RouteErrorFallback({ error, reset }: { error: unknown; reset: () => void }) {
  const message = error instanceof Error ? error.message : "This page could not be loaded.";
  return (
    <div role="alert" className="mx-auto max-w-md space-y-4 p-6 text-center">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="break-words text-sm text-muted-foreground">{message}</p>
      <div className="flex flex-col justify-center gap-2 sm:flex-row">
        <button
          type="button"
          onClick={reset}
          className="min-h-11 rounded-md border px-4 text-sm font-medium"
        >
          Try again
        </button>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="min-h-11 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          Reload page
        </button>
      </div>
    </div>
  );
}

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: RouteErrorFallback,
  });

  return router;
};
