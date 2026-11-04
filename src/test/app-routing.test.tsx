import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ getUser: vi.fn(), from: vi.fn(), maybeSingle: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getUser: auth.getUser }, from: auth.from } }));

import { routeTree } from "@/routeTree.gen";
import { Route as AuthenticatedRoute } from "@/routes/_authenticated/route";

// Match routes without running loaders or rendering: loaders may need a server or
// network the test run lacks, and jsdom never loads the stylesheets React waits on.
describe("App routing", () => {
  it("matches a page for / instead of falling back to not found", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const matches = router.matchRoutes("/");

    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });

  it("matches invoice URLs to the authenticated invoice route", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const matches = router.matchRoutes("/invoice/booking-id");

    expect(matches.at(-1)?.routeId).toBe("/_authenticated/invoice/$id");
  });
});

describe("authenticated route guard", () => {
  const beforeLoad = AuthenticatedRoute.options.beforeLoad as (context: { location: { href: string } }) => Promise<void>;
  const context = { location: { href: "/admin" } };

  beforeEach(() => {
    vi.clearAllMocks();
    const query = { select: vi.fn(), eq: vi.fn(), maybeSingle: auth.maybeSingle };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    auth.from.mockReturnValue(query);
  });

  it("redirects missing sessions instead of showing an error page", async () => {
    auth.getUser.mockResolvedValue({ data: { user: null }, error: { name: "AuthSessionMissingError", status: 400 } });
    await expect(beforeLoad(context)).rejects.toMatchObject({ options: { to: "/auth", search: { redirect: "/admin" } } });
    expect(auth.from).not.toHaveBeenCalled();
  });

  it("does not redirect transient auth failures into a login loop", async () => {
    const error = { name: "AuthRetryableFetchError", status: 503 };
    auth.getUser.mockResolvedValue({ data: { user: null }, error });
    await expect(beforeLoad(context)).rejects.toBe(error);
    expect(auth.from).not.toHaveBeenCalled();
  });

  it("keeps pending accounts out of authenticated pages", async () => {
    auth.getUser.mockResolvedValue({ data: { user: { id: "user-id" } }, error: null });
    auth.maybeSingle.mockResolvedValue({ data: { status: "pending" }, error: null });
    await expect(beforeLoad(context)).rejects.toMatchObject({ options: { to: "/" } });
  });

  it("allows an active verified account", async () => {
    auth.getUser.mockResolvedValue({ data: { user: { id: "user-id" } }, error: null });
    auth.maybeSingle.mockResolvedValue({ data: { status: "active" }, error: null });
    await expect(beforeLoad(context)).resolves.toBeUndefined();
  });
});
