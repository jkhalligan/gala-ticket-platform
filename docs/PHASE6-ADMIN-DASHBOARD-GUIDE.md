# Phase 6 - Admin Dashboard Implementation Guide

**Target:** Build a complete admin dashboard with 9 pages for event management
**Stack:** Next.js 16 App Router + React 19 + shadcn/ui + Tailwind 4

---

## Table of Contents

1. [Phase Overview](#phase-overview)
2. [Phase 6.1 - Setup](#phase-61---setup)
   - [shadcn/ui Installation](#shadcnui-installation)
   - [Geist Font Configuration](#geist-font-configuration)
   - [Neutral Theme Variables](#neutral-theme-variables)
   - [Admin Layout Shell](#admin-layout-shell)
3. [Phase 6.2 - Core Components](#phase-62---core-components)
4. [Phase 6.3-6.5 - Page Implementation](#phase-63-65---page-implementation)
5. [File Structure](#file-structure)

---

## Phase Overview

### Why Admin Dashboard Before Frontend?

- Simpler scope with no complex technical dependencies
- Provides operational tools immediately for event staff
- API routes (Phase 1-5) are already complete and tested

### 9 Admin Pages

| Page | Route | Purpose |
|------|-------|---------|
| Dashboard Overview | `/admin` | KPIs, quick stats, recent activity |
| Tables Management | `/admin/tables` | CRUD tables, view guests per table |
| Guests Management | `/admin/guests` | Search/filter all guests, bulk actions |
| Orders Management | `/admin/orders` | View orders, refunds, status |
| Ticket Invitations | `/admin/invitations` | Create/manage payment link invitations |
| Google Sheets Sync | `/admin/sync` | Trigger sync, view status, logs |
| Activity Log | `/admin/activity` | Audit trail, filterable history |
| Waitlist Management | `/admin/waitlist` | View/convert waitlist entries |
| Authentication | middleware | Protect admin routes |

### Design Principles

- **Neutral theme**: Multi-tenant ready, no brand colors
- **shadcn/ui**: Copy-paste components, full ownership
- **Geist font**: Modern, clean typography (sans + mono)
- **Mobile-responsive**: Collapsible sidebar

---

## Phase 6.1 - Setup

### shadcn/ui Installation

#### Step 1: Install Dependencies

```bash
# Core dependencies (already have most)
npm install clsx tailwind-merge class-variance-authority

# Radix UI primitives (install as needed per component)
npm install @radix-ui/react-slot
npm install @radix-ui/react-dialog
npm install @radix-ui/react-dropdown-menu
npm install @radix-ui/react-separator
npm install @radix-ui/react-tooltip
npm install @radix-ui/react-select
npm install @radix-ui/react-checkbox
npm install @radix-ui/react-label
npm install @radix-ui/react-tabs
npm install @radix-ui/react-avatar
npm install @radix-ui/react-popover
npm install @radix-ui/react-scroll-area

# Icons
npm install lucide-react

# Date picker (if needed)
npm install date-fns
npm install react-day-picker
```

#### Step 2: Create Utility Function

Create `src/lib/utils.ts`:

```typescript
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

#### Step 3: Configure components.json

Create `components.json` in project root:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

> **Note:** With Tailwind 4, we don't use a `tailwind.config.js`. CSS variables are defined directly in `globals.css`.

#### Step 4: Add Components via CLI (Optional)

```bash
# If you want to use the CLI (may need adjustments for Tailwind 4)
npx shadcn@latest add button
npx shadcn@latest add card
npx shadcn@latest add table
npx shadcn@latest add input
npx shadcn@latest add badge
npx shadcn@latest add dialog
npx shadcn@latest add dropdown-menu
npx shadcn@latest add select
npx shadcn@latest add tabs
npx shadcn@latest add avatar
npx shadcn@latest add separator
npx shadcn@latest add scroll-area
npx shadcn@latest add skeleton
npx shadcn@latest add toast
npx shadcn@latest add sheet
```

> **Recommended:** Copy components manually from [ui.shadcn.com](https://ui.shadcn.com) and adjust for Tailwind 4 syntax if CLI has issues.

---

### Geist Font Configuration

**Already configured** in this project. For reference:

`src/app/layout.tsx`:
```typescript
import { Geist, Geist_Mono } from "next/font/google";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// In body:
<body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
```

`src/app/globals.css`:
```css
@theme inline {
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}
```

---

### Neutral Theme Variables

Replace `src/app/globals.css` with full shadcn/ui theme variables:

```css
@import "tailwindcss";

/* ============================================
   shadcn/ui Theme Variables - Neutral Palette
   ============================================ */

:root {
  /* Base */
  --background: 0 0% 100%;
  --foreground: 0 0% 3.9%;

  /* Card */
  --card: 0 0% 100%;
  --card-foreground: 0 0% 3.9%;

  /* Popover */
  --popover: 0 0% 100%;
  --popover-foreground: 0 0% 3.9%;

  /* Primary - Neutral gray for multi-tenant */
  --primary: 0 0% 9%;
  --primary-foreground: 0 0% 98%;

  /* Secondary */
  --secondary: 0 0% 96.1%;
  --secondary-foreground: 0 0% 9%;

  /* Muted */
  --muted: 0 0% 96.1%;
  --muted-foreground: 0 0% 45.1%;

  /* Accent */
  --accent: 0 0% 96.1%;
  --accent-foreground: 0 0% 9%;

  /* Destructive */
  --destructive: 0 84.2% 60.2%;
  --destructive-foreground: 0 0% 98%;

  /* Border & Input */
  --border: 0 0% 89.8%;
  --input: 0 0% 89.8%;
  --ring: 0 0% 3.9%;

  /* Chart colors (for dashboard) */
  --chart-1: 220 70% 50%;
  --chart-2: 160 60% 45%;
  --chart-3: 30 80% 55%;
  --chart-4: 280 65% 60%;
  --chart-5: 340 75% 55%;

  /* Radius */
  --radius: 0.5rem;

  /* Sidebar (for admin layout) */
  --sidebar-background: 0 0% 98%;
  --sidebar-foreground: 0 0% 3.9%;
  --sidebar-primary: 0 0% 9%;
  --sidebar-primary-foreground: 0 0% 98%;
  --sidebar-accent: 0 0% 96.1%;
  --sidebar-accent-foreground: 0 0% 9%;
  --sidebar-border: 0 0% 89.8%;
  --sidebar-ring: 0 0% 3.9%;
}

.dark {
  /* Base */
  --background: 0 0% 3.9%;
  --foreground: 0 0% 98%;

  /* Card */
  --card: 0 0% 3.9%;
  --card-foreground: 0 0% 98%;

  /* Popover */
  --popover: 0 0% 3.9%;
  --popover-foreground: 0 0% 98%;

  /* Primary */
  --primary: 0 0% 98%;
  --primary-foreground: 0 0% 9%;

  /* Secondary */
  --secondary: 0 0% 14.9%;
  --secondary-foreground: 0 0% 98%;

  /* Muted */
  --muted: 0 0% 14.9%;
  --muted-foreground: 0 0% 63.9%;

  /* Accent */
  --accent: 0 0% 14.9%;
  --accent-foreground: 0 0% 98%;

  /* Destructive */
  --destructive: 0 62.8% 30.6%;
  --destructive-foreground: 0 0% 98%;

  /* Border & Input */
  --border: 0 0% 14.9%;
  --input: 0 0% 14.9%;
  --ring: 0 0% 83.1%;

  /* Sidebar */
  --sidebar-background: 0 0% 5.9%;
  --sidebar-foreground: 0 0% 98%;
  --sidebar-primary: 0 0% 98%;
  --sidebar-primary-foreground: 0 0% 9%;
  --sidebar-accent: 0 0% 14.9%;
  --sidebar-accent-foreground: 0 0% 98%;
  --sidebar-border: 0 0% 14.9%;
  --sidebar-ring: 0 0% 83.1%;
}

/* ============================================
   Tailwind 4 Theme Integration
   ============================================ */

@theme inline {
  /* Colors mapped to CSS variables */
  --color-background: hsl(var(--background));
  --color-foreground: hsl(var(--foreground));
  --color-card: hsl(var(--card));
  --color-card-foreground: hsl(var(--card-foreground));
  --color-popover: hsl(var(--popover));
  --color-popover-foreground: hsl(var(--popover-foreground));
  --color-primary: hsl(var(--primary));
  --color-primary-foreground: hsl(var(--primary-foreground));
  --color-secondary: hsl(var(--secondary));
  --color-secondary-foreground: hsl(var(--secondary-foreground));
  --color-muted: hsl(var(--muted));
  --color-muted-foreground: hsl(var(--muted-foreground));
  --color-accent: hsl(var(--accent));
  --color-accent-foreground: hsl(var(--accent-foreground));
  --color-destructive: hsl(var(--destructive));
  --color-destructive-foreground: hsl(var(--destructive-foreground));
  --color-border: hsl(var(--border));
  --color-input: hsl(var(--input));
  --color-ring: hsl(var(--ring));

  /* Chart colors */
  --color-chart-1: hsl(var(--chart-1));
  --color-chart-2: hsl(var(--chart-2));
  --color-chart-3: hsl(var(--chart-3));
  --color-chart-4: hsl(var(--chart-4));
  --color-chart-5: hsl(var(--chart-5));

  /* Sidebar colors */
  --color-sidebar-background: hsl(var(--sidebar-background));
  --color-sidebar-foreground: hsl(var(--sidebar-foreground));
  --color-sidebar-primary: hsl(var(--sidebar-primary));
  --color-sidebar-primary-foreground: hsl(var(--sidebar-primary-foreground));
  --color-sidebar-accent: hsl(var(--sidebar-accent));
  --color-sidebar-accent-foreground: hsl(var(--sidebar-accent-foreground));
  --color-sidebar-border: hsl(var(--sidebar-border));
  --color-sidebar-ring: hsl(var(--sidebar-ring));

  /* Fonts */
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);

  /* Border radius */
  --radius-lg: var(--radius);
  --radius-md: calc(var(--radius) - 2px);
  --radius-sm: calc(var(--radius) - 4px);
}

/* ============================================
   Base Styles
   ============================================ */

* {
  border-color: hsl(var(--border));
}

body {
  background-color: hsl(var(--background));
  color: hsl(var(--foreground));
  font-family: var(--font-sans), system-ui, sans-serif;
}

/* Scrollbar styling (optional) */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: hsl(var(--muted));
}

::-webkit-scrollbar-thumb {
  background: hsl(var(--muted-foreground) / 0.3);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: hsl(var(--muted-foreground) / 0.5);
}
```

---

### Admin Layout Shell

#### Directory Structure

```
src/
├── app/
│   ├── admin/
│   │   ├── layout.tsx          # Admin layout with sidebar
│   │   ├── page.tsx            # Dashboard overview
│   │   ├── tables/
│   │   │   └── page.tsx
│   │   ├── guests/
│   │   │   └── page.tsx
│   │   ├── orders/
│   │   │   └── page.tsx
│   │   ├── invitations/
│   │   │   └── page.tsx
│   │   ├── sync/
│   │   │   └── page.tsx
│   │   ├── activity/
│   │   │   └── page.tsx
│   │   └── waitlist/
│   │       └── page.tsx
│   └── ...
├── components/
│   ├── ui/                     # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── table.tsx
│   │   └── ...
│   └── admin/                  # Admin-specific components
│       ├── sidebar.tsx
│       ├── header.tsx
│       ├── nav-item.tsx
│       └── ...
└── ...
```

#### Admin Layout (`src/app/admin/layout.tsx`)

```typescript
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AdminSidebar } from "@/components/admin/sidebar";
import { AdminHeader } from "@/components/admin/header";

export const metadata = {
  title: "Admin Dashboard | Gala Platform",
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-side auth check
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?redirect=/admin");
  }

  if (!user.isAdmin) {
    redirect("/dashboard?error=unauthorized");
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <AdminSidebar user={user} />

      {/* Main Content */}
      <div className="flex flex-1 flex-col lg:pl-64">
        <AdminHeader user={user} />
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
```

#### Sidebar Component (`src/components/admin/sidebar.tsx`)

```typescript
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
  Settings,
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
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            G
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
```

#### Header Component (`src/components/admin/header.tsx`)

```typescript
"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, Bell, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AuthUser } from "@/lib/auth";

// Mobile sidebar (sheet) - implement with shadcn Sheet component
import { AdminMobileSidebar } from "./mobile-sidebar";

interface AdminHeaderProps {
  user: AuthUser;
}

export function AdminHeader({ user }: AdminHeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-background px-6">
      {/* Mobile menu button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden p-2 rounded-md hover:bg-accent"
      >
        <Menu className="h-5 w-5" />
        <span className="sr-only">Open menu</span>
      </button>

      {/* Search (optional) */}
      <div className="flex-1">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search..."
            className="w-full rounded-md border bg-background pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button className="p-2 rounded-md hover:bg-accent relative">
          <Bell className="h-5 w-5" />
          <span className="sr-only">Notifications</span>
        </button>
      </div>

      {/* Mobile Sidebar */}
      <AdminMobileSidebar
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        user={user}
      />
    </header>
  );
}
```

#### Placeholder Dashboard Page (`src/app/admin/page.tsx`)

```typescript
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { Users, TableProperties, ShoppingCart, DollarSign } from "lucide-react";

export default async function AdminDashboard() {
  // Fetch stats (example queries)
  const [tableCount, guestCount, orderCount] = await Promise.all([
    prisma.table.count(),
    prisma.guestAssignment.count(),
    prisma.order.count({ where: { status: "COMPLETED" } }),
  ]);

  const stats = [
    {
      title: "Total Tables",
      value: tableCount,
      icon: TableProperties,
      description: "Active event tables"
    },
    {
      title: "Total Guests",
      value: guestCount,
      icon: Users,
      description: "Assigned guests"
    },
    {
      title: "Completed Orders",
      value: orderCount,
      icon: ShoppingCart,
      description: "Successful purchases"
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your gala event management
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Activity placeholder */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>
            Latest actions in the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Activity feed will be implemented in Phase 6.5
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## Phase 6.2 - Core Components

### Essential shadcn/ui Components to Add

| Component | Usage |
|-----------|-------|
| `button` | Actions, form submissions |
| `card` | Content containers |
| `table` | Data tables for lists |
| `input` | Form inputs |
| `select` | Dropdowns |
| `badge` | Status indicators |
| `dialog` | Modals for create/edit |
| `dropdown-menu` | Action menus |
| `tabs` | Page sections |
| `skeleton` | Loading states |
| `toast` / `sonner` | Notifications |
| `sheet` | Mobile sidebar |
| `separator` | Visual dividers |
| `scroll-area` | Scrollable containers |
| `avatar` | User avatars |
| `pagination` | Table pagination |

### Custom Admin Components to Build

```
src/components/admin/
├── data-table.tsx       # Reusable data table with sorting, filtering
├── page-header.tsx      # Consistent page headers
├── stat-card.tsx        # Dashboard stat cards
├── status-badge.tsx     # Order/table status badges
├── empty-state.tsx      # Empty list placeholders
├── confirm-dialog.tsx   # Delete confirmations
├── search-input.tsx     # Debounced search
└── pagination.tsx       # Table pagination controls
```

---

## Phase 6.3-6.5 - Page Implementation

### Phase 6.3: Tables & Guests

**Tables Page (`/admin/tables`)**
- List all tables with search/filter
- Show: name, type, capacity, filled seats, status
- Actions: view details, edit, delete
- Click row → table detail view with guest list

**Guests Page (`/admin/guests`)**
- List all guests across all tables
- Search by name, email, table
- Filter by: checked-in status, tier, table
- Actions: view details, edit, transfer

### Phase 6.4: Orders, Invitations, Sync

**Orders Page (`/admin/orders`)**
- List orders with status badges
- Filter by: status, date range, product type
- Actions: view details, refund
- Show: buyer, amount, product, date

**Invitations Page (`/admin/invitations`)**
- Create new payment link invitations
- List pending invitations
- Show: email, amount, expires, status
- Actions: resend, cancel, copy link

**Sync Page (`/admin/sync`)**
- Show sync configuration status
- Last sync timestamp
- Manual sync trigger button
- Sync history/logs

### Phase 6.5: Dashboard, Activity, Polish

**Dashboard Overview (`/admin`)**
- KPI cards: tables, guests, revenue, orders
- Charts: registrations over time, table fill rates
- Recent activity feed
- Quick actions

**Activity Log (`/admin/activity`)**
- Filterable audit trail
- Filter by: action type, user, date range
- Show: actor, action, entity, timestamp
- Expandable details

**Waitlist Page (`/admin/waitlist`)**
- List waitlist entries
- Filter by: status, event, table
- Actions: convert to order, cancel
- Show: email, requested seats, date

---

## File Structure

### After Phase 6 Complete

```
src/
├── app/
│   ├── admin/
│   │   ├── layout.tsx
│   │   ├── page.tsx              # Dashboard
│   │   ├── tables/
│   │   │   ├── page.tsx          # Tables list
│   │   │   └── [slug]/
│   │   │       └── page.tsx      # Table detail
│   │   ├── guests/
│   │   │   ├── page.tsx          # Guests list
│   │   │   └── [id]/
│   │   │       └── page.tsx      # Guest detail
│   │   ├── orders/
│   │   │   ├── page.tsx          # Orders list
│   │   │   └── [id]/
│   │   │       └── page.tsx      # Order detail
│   │   ├── invitations/
│   │   │   └── page.tsx
│   │   ├── sync/
│   │   │   └── page.tsx
│   │   ├── activity/
│   │   │   └── page.tsx
│   │   └── waitlist/
│   │       └── page.tsx
│   └── ...
├── components/
│   ├── ui/                       # 15-20 shadcn components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── table.tsx
│   │   ├── input.tsx
│   │   ├── select.tsx
│   │   ├── badge.tsx
│   │   ├── dialog.tsx
│   │   ├── dropdown-menu.tsx
│   │   ├── tabs.tsx
│   │   ├── skeleton.tsx
│   │   ├── sheet.tsx
│   │   ├── separator.tsx
│   │   ├── scroll-area.tsx
│   │   ├── avatar.tsx
│   │   ├── toast.tsx
│   │   └── ...
│   └── admin/                    # Admin-specific
│       ├── sidebar.tsx
│       ├── mobile-sidebar.tsx
│       ├── header.tsx
│       ├── data-table.tsx
│       ├── page-header.tsx
│       ├── stat-card.tsx
│       ├── status-badge.tsx
│       ├── empty-state.tsx
│       ├── confirm-dialog.tsx
│       └── ...
├── hooks/
│   ├── use-debounce.ts
│   └── use-pagination.ts
└── lib/
    ├── utils.ts                  # cn() utility
    └── ...
```

---

## Checklist: Phase 6.1 Setup

- [ ] Install dependencies (`clsx`, `tailwind-merge`, `class-variance-authority`, `lucide-react`)
- [ ] Install Radix UI primitives (as needed)
- [ ] Create `src/lib/utils.ts` with `cn()` function
- [ ] Create `components.json` for shadcn CLI
- [ ] Update `src/app/globals.css` with full theme variables
- [ ] Create `src/components/ui/` directory
- [ ] Add initial shadcn components (button, card, at minimum)
- [ ] Create `src/components/admin/` directory
- [ ] Create admin layout (`src/app/admin/layout.tsx`)
- [ ] Create sidebar component
- [ ] Create header component
- [ ] Create placeholder dashboard page
- [ ] Test admin route protection (redirect non-admins)
- [ ] Verify dark mode works

---

*Document created: December 2025*
*Phase 6.1 Target: Setup complete, layout functional*
