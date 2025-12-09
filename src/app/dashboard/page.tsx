// src/app/dashboard/page.tsx
// User dashboard - shows tables and tickets

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { DashboardClient } from './DashboardClient';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login?redirect=/dashboard');
  }

  // Fetch user's tables and assignments
  const [ownedTables, tableRoles, guestAssignments] = await Promise.all([
    prisma.table.findMany({
      where: { primary_owner_id: user.id },
      include: {
        event: { select: { name: true, event_date: true } },
        _count: { select: { guest_assignments: true } },
      },
      orderBy: { created_at: 'desc' },
    }),
    prisma.tableUserRole.findMany({
      where: { user_id: user.id },
      include: {
        table: {
          include: {
            event: { select: { name: true, event_date: true } },
            _count: { select: { guest_assignments: true } },
          },
        },
      },
      orderBy: { created_at: 'desc' },
    }),
    prisma.guestAssignment.findMany({
      where: { user_id: user.id },
      include: {
        table: { select: { name: true, slug: true } },
        event: { select: { name: true, event_date: true } },
        user: { select: { email: true } },
      },
      orderBy: { created_at: 'desc' },
    }),
  ]);

  // Combine and dedupe tables
  const tablesMap = new Map();
  ownedTables.forEach(t => tablesMap.set(t.id, { ...t, role: 'OWNER' }));
  tableRoles.forEach(r => {
    if (!tablesMap.has(r.table.id)) {
      tablesMap.set(r.table.id, { ...r.table, role: r.role });
    }
  });
  const allTables = Array.from(tablesMap.values());

  // Format guest assignments for client
  const formattedAssignments = guestAssignments.map(a => ({
    id: a.id,
    table: a.table,
    event: a.event,
    tier: a.tier,
    checked_in: a.checked_in_at !== null,
    display_name: a.display_name,
    dietary_restrictions: a.dietary_restrictions as string | null,
    user_email: a.user.email,
  }));

  const userName = user.first_name || user.email;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {user.first_name || user.email}
            </span>
            <form action="/api/auth/logout" method="POST">
              <button
                type="submit"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold">
            Welcome{user.first_name ? `, ${user.first_name}` : ''}!
          </h2>
          <p className="text-muted-foreground mt-1">
            Manage your tables and event tickets
          </p>
        </div>

        {/* Client Component with all interactive features */}
        <DashboardClient
          userName={userName}
          tables={allTables.map(t => ({
            id: t.id,
            name: t.name,
            slug: t.slug,
            type: t.type,
            capacity: t.capacity,
            filled_seats: t._count?.guest_assignments || 0,
            event: t.event,
            role: t.role as string,
          }))}
          guestAssignments={formattedAssignments}
          isAdmin={user.isAdmin}
        />
      </main>
    </div>
  );
}
