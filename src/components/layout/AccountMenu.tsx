import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { HardHat, LayoutDashboard, LogOut, UserRound, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { authService, ROLE_LABELS } from "@/services/authService";

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "U";
}

export function AccountMenu() {
  const { ready, userId, profile, email, roles, isStaff } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  if (!ready) return <div className="h-8 w-8 animate-pulse rounded-full bg-surface" />;
  if (!userId)
    return (
      <Button asChild size="sm">
        <Link to="/auth">Sign in</Link>
      </Button>
    );

  const name = profile?.full_name || email || "User";
  const topRole = roles.find((r) => r !== "customer") ?? "customer";

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await authService.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-md pl-1 outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="hidden text-right sm:block">
          <span className="block text-xs font-semibold leading-tight">{name}</span>
          <span className="block text-[10px] leading-tight text-muted-foreground">
            {profile?.company || ROLE_LABELS[topRole]}
          </span>
        </span>
        <span className="grid h-8 w-8 place-items-center rounded-full bg-surface text-xs font-semibold">{initials(name)}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs">
          {email}
          <span className="mt-1 block font-normal text-muted-foreground">{roles.map((r) => ROLE_LABELS[r]).join(" · ")}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/profile"><UserRound />Profile & security</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/engineer"><HardHat />Engineer portal</Link>
        </DropdownMenuItem>
        {isStaff && (
          <DropdownMenuItem asChild>
            <Link to="/ops/engineers"><Users />Engineers & dispatch</Link>
          </DropdownMenuItem>
        )}
        {isStaff && (
          <DropdownMenuItem asChild>
            <Link to="/admin"><LayoutDashboard />Admin & operations</Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={signOut}><LogOut />Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
