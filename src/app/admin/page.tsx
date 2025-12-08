import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { prisma } from "@/lib/prisma";
import { Users, TableProperties, ShoppingCart, Calendar, MapPin, Building2, ArrowRight } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";

export default async function AdminDashboard() {
  // Fetch stats, event data, and recent activity
  const [tableCount, guestCount, orderCount, event, recentActivity] = await Promise.all([
    prisma.table.count(),
    prisma.guestAssignment.count(),
    prisma.order.count({ where: { status: "COMPLETED" } }),
    // Fetch the first active event
    prisma.event.findFirst({
      where: { is_active: true },
      include: {
        organization: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { event_date: "desc" },
    }),
    // Fetch recent activity
    prisma.activityLog.findMany({
      take: 10,
      orderBy: { created_at: "desc" },
      include: {
        actor: {
          select: {
            email: true,
            first_name: true,
            last_name: true,
          },
        },
      },
    }),
  ]);

  const stats = [
    {
      title: "Total Tables",
      value: tableCount,
      icon: TableProperties,
      description: "Active event tables",
      href: "/admin/tables",
    },
    {
      title: "Total Guests",
      value: guestCount,
      icon: Users,
      description: "Assigned guests",
      href: "/admin/guests",
    },
    {
      title: "Completed Orders",
      value: orderCount,
      icon: ShoppingCart,
      description: "Successful purchases",
      href: "/admin/orders",
    },
  ];

  // Helper to format action labels
  const formatAction = (action: string) => {
    return action.split('_').map(word =>
      word.charAt(0) + word.slice(1).toLowerCase()
    ).join(' ');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Overview of your gala event management"
      />

      {/* Event Details Card */}
      {event && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Event Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex items-start gap-3">
                <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Organization</p>
                  <p className="text-base font-semibold">{event.organization.name}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Event Name</p>
                  <p className="text-base font-semibold">{event.name}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Date</p>
                  <p className="text-base font-semibold">
                    {format(new Date(event.event_date), "MMMM d, yyyy 'at' h:mm a")}
                  </p>
                </div>
              </div>
              {event.venue_name && (
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Venue</p>
                    <p className="text-base font-semibold">{event.venue_name}</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid - Now Clickable */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <Link key={stat.title} href={stat.href} className="transition-transform hover:scale-105">
            <StatCard
              title={stat.title}
              value={stat.value}
              icon={stat.icon}
              description={stat.description}
              className="h-full cursor-pointer hover:shadow-lg transition-shadow"
            />
          </Link>
        ))}
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>
              Latest actions in the system
            </CardDescription>
          </div>
          <Link
            href="/admin/activity"
            className="text-sm font-medium text-primary hover:underline flex items-center gap-1"
          >
            View All <ArrowRight className="h-4 w-4" />
          </Link>
        </CardHeader>
        <CardContent>
          {recentActivity.length > 0 ? (
            <div className="space-y-4">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start gap-4 pb-4 last:pb-0 border-b last:border-0">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">
                        {formatAction(activity.action)}
                      </p>
                      <span className="text-xs text-muted-foreground">•</span>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(activity.created_at), "MMM d, h:mm a")}
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      by {activity.actor?.first_name
                        ? `${activity.actor.first_name} ${activity.actor.last_name || ''}`
                        : activity.actor?.email || 'System'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">
                No recent activity to display
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
