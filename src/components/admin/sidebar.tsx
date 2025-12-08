"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  TableProperties,
  ShoppingCart,
  Mail,
  RefreshCw,
  Activity,
  Clock,
  LogOut,
} from "lucide-react";
import type { AuthUser } from "@/lib/auth";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/tables", label: "Tables", icon: TableProperties },
  { href: "/admin/guests", label: "Guests", icon: Users },
  { href: "/admin/orders", label: "Orders", icon: ShoppingCart },
  { href: "/admin/invitations", label: "Invitations", icon: Mail },
  { href: "/admin/sync", label: "Sheets Sync", icon: RefreshCw },
  { href: "/admin/activity", label: "Activity Log", icon: Activity },
  { href: "/admin/waitlist", label: "Waitlist", icon: Clock },
];

interface AdminSidebarProps {
  user: AuthUser;
}

export function AdminSidebar({ user }: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-50 hidden w-64 flex-col border-r bg-sidebar-background lg:flex">
      {/* Logo / Brand */}
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/admin" className="flex items-center gap-2 font-semibold">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xl">
            🎉
          </div>
          <span>Gala Admin</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== "/admin" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User Section */}
      <div className="border-t p-4">
        <div className="flex items-center gap-3 rounded-lg px-3 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-medium">
            {user.first_name?.[0] || user.email[0].toUpperCase()}
          </div>
          <div className="flex-1 truncate">
            <p className="text-sm font-medium truncate">
              {user.first_name ? `${user.first_name} ${user.last_name || ""}` : user.email}
            </p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
        </div>
        <Link
          href="/api/auth/logout"
          className="mt-2 flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Link>
      </div>
    </aside>
  );
}
