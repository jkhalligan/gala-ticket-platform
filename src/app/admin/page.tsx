import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { prisma } from "@/lib/prisma";
import { Users, TableProperties, ShoppingCart } from "lucide-react";

export default async function AdminDashboard() {
  // Fetch stats
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
      <PageHeader
        title="Dashboard"
        description="Overview of your gala event management"
      />

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <StatCard
            key={stat.title}
            title={stat.title}
            value={stat.value}
            icon={stat.icon}
            description={stat.description}
          />
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
