// src/app/dashboard/page.tsx
// User dashboard - shows tables and tickets

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';

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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-pink-600">Pink Gala</h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-600">
              {user.first_name || user.email}
            </span>
            <form action="/api/auth/logout" method="POST">
              <button
                type="submit"
                className="text-gray-500 hover:text-gray-700 text-sm"
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
          <h2 className="text-3xl font-bold text-gray-900">
            Welcome{user.first_name ? `, ${user.first_name}` : ''}!
          </h2>
          <p className="text-gray-600 mt-1">
            Manage your tables and event tickets
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="text-3xl font-bold text-pink-600">
              {allTables.length}
            </div>
            <div className="text-gray-600">Tables</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="text-3xl font-bold text-pink-600">
              {guestAssignments.length}
            </div>
            <div className="text-gray-600">Event Tickets</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="text-3xl font-bold text-pink-600">
              {user.isAdmin ? '✓' : '—'}
            </div>
            <div className="text-gray-600">
              {user.isAdmin ? 'Admin Access' : 'Guest Access'}
            </div>
          </div>
        </div>

        {/* My Tables */}
        <section className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold text-gray-900">My Tables</h3>
            {user.isAdmin && (
              <Link
                href="/admin/tables/new"
                className="text-pink-600 hover:text-pink-700 text-sm font-medium"
              >
                + Create Table
              </Link>
            )}
          </div>

          {allTables.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm p-8 text-center">
              <p className="text-gray-500">
                You don&apos;t have any tables yet.
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {allTables.map((table) => (
                <Link
                  key={table.id}
                  href={`/table/${table.slug}?event_id=${table.event_id}`}
                  className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-semibold text-gray-900">{table.name}</h4>
                      <p className="text-sm text-gray-500 mt-1">
                        {table.event?.name}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                        table.type === 'PREPAID' 
                          ? 'bg-green-100 text-green-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {table.type === 'PREPAID' ? 'Host Table' : 'Captain Table'}
                      </span>
                      <p className="text-sm text-gray-500 mt-2">
                        {table._count?.guest_assignments || 0} / {table.capacity} seats
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center text-sm text-gray-500">
                    <span className="mr-4">Role: {table.role}</span>
                    {table.event?.event_date && (
                      <span>
                        {new Date(table.event.event_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* My Tickets */}
        <section>
          <h3 className="text-xl font-semibold text-gray-900 mb-4">My Tickets</h3>

          {guestAssignments.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm p-8 text-center">
              <p className="text-gray-500">
                You don&apos;t have any event tickets yet.
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {guestAssignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className="bg-white rounded-xl shadow-sm p-6"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-semibold text-gray-900">
                        {assignment.event?.name}
                      </h4>
                      {assignment.table && (
                        <p className="text-sm text-gray-500 mt-1">
                          Table: {assignment.table.name}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      {assignment.checked_in_at ? (
                        <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-700">
                          Checked In
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700">
                          Not Checked In
                        </span>
                      )}
                      {assignment.event?.event_date && (
                        <p className="text-sm text-gray-500 mt-2">
                          {new Date(assignment.event.event_date).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
