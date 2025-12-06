import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
