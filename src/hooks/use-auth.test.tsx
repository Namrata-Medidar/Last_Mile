import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import type { Session } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
  getUser: vi.fn(),
  unsubscribe: vi.fn(),
  cancelQueries: vi.fn(),
  clear: vi.fn(),
  listener: null as ((event: string, session: Session | null) => void) | null,
}));

const queryClient = { cancelQueries: auth.cancelQueries, clear: auth.clear };

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: {
    getSession: auth.getSession,
    getUser: auth.getUser,
    onAuthStateChange: (listener: typeof auth.listener) => {
      auth.listener = listener;
      return { data: { subscription: { unsubscribe: auth.unsubscribe } } };
    },
  } },
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: undefined, isLoading: false, error: null }),
  useQueryClient: () => queryClient,
}));
vi.mock("@/services/authService", () => ({ authService: { signOut: vi.fn() }, isStaff: () => false }));
vi.mock("@/services/userService", () => ({ userService: {} }));

import { AuthProvider, useAuth } from "./use-auth";

const user = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "private@example.test",
  aud: "authenticated",
  app_metadata: {},
  user_metadata: {},
  created_at: "2026-01-01T00:00:00Z",
};
const session: Session = {
  access_token: "test-access-token",
  refresh_token: "test-refresh-token",
  expires_in: 3600,
  token_type: "bearer",
  user,
};
const unavailableSession: Session = {
  ...session,
  user: new Proxy(user, { get() { throw new Error("User unavailable"); } }),
};

function Probe() {
  const { ready, userId } = useAuth();
  return <div>{ready ? userId ?? "signed-out" : "loading"}</div>;
}

describe("auth provider recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.listener = null;
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
  });
  afterEach(cleanup);

  it("restores a user missing from persisted storage", async () => {
    auth.getSession.mockResolvedValue({ data: { session: unavailableSession }, error: null });
    auth.getUser.mockResolvedValue({ data: { user }, error: null });
    render(<AuthProvider><Probe /></AuthProvider>);
    await screen.findByText(user.id);
    expect(auth.getUser).toHaveBeenCalledWith(session.access_token);
  });

  it("fails closed without rendering an unavailable user", async () => {
    auth.getSession.mockResolvedValue({ data: { session: unavailableSession }, error: null });
    auth.getUser.mockRejectedValue(new Error("Offline"));
    render(<AuthProvider><Probe /></AuthProvider>);
    await screen.findByText("signed-out");
  });

  it("does not let a pending user lookup undo sign-out", async () => {
    let finish!: (value: { data: { user: typeof user }; error: null }) => void;
    auth.getUser.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    render(<AuthProvider><Probe /></AuthProvider>);
    await screen.findByText("signed-out");
    act(() => auth.listener!("SIGNED_IN", unavailableSession));
    await waitFor(() => expect(auth.getUser).toHaveBeenCalled());
    act(() => auth.listener!("SIGNED_OUT", null));
    await act(async () => { finish({ data: { user }, error: null }); });
    expect(screen.getByText("signed-out")).toBeInTheDocument();
  });

  it("unsubscribes on unmount", () => {
    const view = render(<AuthProvider><Probe /></AuthProvider>);
    view.unmount();
    expect(auth.unsubscribe).toHaveBeenCalledOnce();
  });

  it("clears account data and cancels queries when switching users", async () => {
    auth.getSession.mockResolvedValue({ data: { session }, error: null });
    render(<AuthProvider><Probe /></AuthProvider>);
    await screen.findByText(user.id);
    auth.clear.mockClear();
    auth.cancelQueries.mockClear();
    const nextUser = { ...user, id: "00000000-0000-4000-8000-000000000002" };
    act(() => auth.listener!("SIGNED_IN", { ...session, user: nextUser }));
    await screen.findByText(nextUser.id);
    expect(auth.cancelQueries).toHaveBeenCalledOnce();
    expect(auth.clear).toHaveBeenCalledOnce();
  });

  it("clears account data on sign-out, but not on same-user refresh", async () => {
    auth.getSession.mockResolvedValue({ data: { session }, error: null });
    render(<AuthProvider><Probe /></AuthProvider>);
    await screen.findByText(user.id);
    auth.clear.mockClear();
    auth.cancelQueries.mockClear();
    act(() => auth.listener!("TOKEN_REFRESHED", { ...session, access_token: "new-token" }));
    await screen.findByText(user.id);
    expect(auth.clear).not.toHaveBeenCalled();
    act(() => auth.listener!("SIGNED_OUT", null));
    expect(screen.getByText("signed-out")).toBeInTheDocument();
    expect(auth.cancelQueries).toHaveBeenCalledOnce();
    expect(auth.clear).toHaveBeenCalledOnce();
  });
});