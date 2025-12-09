"use client";

import * as React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EditGuestDialog } from "@/components/dashboard/EditGuestDialog";
import { Pencil } from "lucide-react";

interface Table {
  id: string;
  name: string;
  slug: string;
  type: string;
  capacity: number;
  filled_seats: number;
  event: {
    name: string;
    event_date: Date | string | null;
  };
  role: string;
}

interface GuestAssignment {
  id: string;
  table: {
    name: string;
    slug: string;
  } | null;
  event: {
    name: string;
    event_date: Date | string | null;
  };
  tier: string;
  checked_in: boolean;
  display_name?: string | null;
  dietary_restrictions?: string | null;
  user_email: string;
}

interface DashboardClientProps {
  userName: string;
  tables: Table[];
  guestAssignments: GuestAssignment[];
  isAdmin: boolean;
}

export function DashboardClient({
  userName,
  tables,
  guestAssignments,
  isAdmin,
}: DashboardClientProps) {
  const [editGuestId, setEditGuestId] = React.useState<string | null>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);

  const selectedGuest = guestAssignments.find(g => g.id === editGuestId);

  function handleRefresh() {
    setRefreshKey(prev => prev + 1);
    // Trigger page refresh
    window.location.reload();
  }

  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-3xl font-bold text-primary">
              {tables.length}
            </CardTitle>
            <CardDescription>Tables</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-3xl font-bold text-primary">
              {guestAssignments.length}
            </CardTitle>
            <CardDescription>Event Tickets</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-3xl font-bold text-primary">
              {isAdmin ? '✓' : '—'}
            </CardTitle>
            <CardDescription>
              {isAdmin ? 'Admin Access' : 'Guest Access'}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* My Tables */}
      <section className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold">My Tables</h3>
          {isAdmin && (
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/tables">Manage Tables</Link>
            </Button>
          )}
        </div>

        {tables.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              You don&apos;t have any tables yet.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {tables.map((table) => (
              <Card key={table.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{table.name}</CardTitle>
                      <CardDescription>{table.event.name}</CardDescription>
                    </div>
                    <div className="text-right space-y-2">
                      <Badge variant={table.type === 'PREPAID' ? 'default' : 'secondary'}>
                        {table.type === 'PREPAID' ? 'Host Table' : 'Captain Table'}
                      </Badge>
                      <p className="text-sm text-muted-foreground">
                        {table.filled_seats} / {table.capacity} seats
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Role: {table.role}</span>
                    {table.event.event_date && (
                      <span>
                        {new Date(table.event.event_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  {isAdmin && (
                    <div className="mt-4">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/admin/tables/${table.slug}`}>
                          Manage Table
                        </Link>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* My Tickets */}
      <section>
        <h3 className="text-xl font-semibold mb-4">My Tickets</h3>

        {guestAssignments.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              You don&apos;t have any event tickets yet.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {guestAssignments.map((assignment) => (
              <Card key={assignment.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{assignment.event.name}</CardTitle>
                      {assignment.table && (
                        <CardDescription>Table: {assignment.table.name}</CardDescription>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge variant={assignment.checked_in ? 'default' : 'secondary'}>
                        {assignment.checked_in ? 'Checked In' : 'Not Checked In'}
                      </Badge>
                      {assignment.event.event_date && (
                        <span className="text-sm text-muted-foreground">
                          {new Date(assignment.event.event_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="text-sm">
                      <span className="text-muted-foreground">Name: </span>
                      <span>{assignment.display_name || userName}</span>
                    </div>
                    {assignment.dietary_restrictions && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Dietary: </span>
                        <span>{assignment.dietary_restrictions}</span>
                      </div>
                    )}
                    <div className="pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditGuestId(assignment.id)}
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit Details
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Edit Guest Dialog */}
      {selectedGuest && (
        <EditGuestDialog
          open={!!editGuestId}
          onOpenChange={(open) => !open && setEditGuestId(null)}
          guestId={selectedGuest.id}
          guestName={selectedGuest.display_name || userName}
          guestEmail={selectedGuest.user_email}
          dietaryRestrictions={selectedGuest.dietary_restrictions || undefined}
          onSuccess={handleRefresh}
        />
      )}
    </>
  );
}
