"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/admin/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Shield, Building2, Activity, Loader2 } from "lucide-react";
import { format } from "date-fns";

type UserProfile = {
  user: {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    sms_opt_in: boolean;
    is_super_admin: boolean;
    created_at: string;
    updated_at: string;
  };
  organizations: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
  recentActivity: Array<{
    id: string;
    action: string;
    entity_type: string;
    entity_id: string;
    created_at: string;
    metadata: any;
  }>;
  stats: {
    totalTables: number;
    totalGuestAssignments: number;
    totalOrders: number;
    isAdmin: boolean;
  };
};

export default function AccountPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [smsOptIn, setSmsOptIn] = useState(false);

  // Load profile data
  useEffect(() => {
    async function loadProfile() {
      try {
        const response = await fetch("/api/users/me");
        if (!response.ok) {
          throw new Error("Failed to load profile");
        }
        const data = await response.json();
        setProfile(data);

        // Populate form fields
        setFirstName(data.user.first_name || "");
        setLastName(data.user.last_name || "");
        setPhone(data.user.phone || "");
        setSmsOptIn(data.user.sms_opt_in || false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load profile");
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, []);

  // Save profile changes
  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch("/api/users/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          first_name: firstName || null,
          last_name: lastName || null,
          phone: phone || null,
          sms_opt_in: smsOptIn,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save changes");
      }

      const data = await response.json();

      // Update profile state
      if (profile) {
        setProfile({
          ...profile,
          user: {
            ...profile.user,
            ...data.user,
          },
        });
      }

      setSuccessMessage("Profile updated successfully!");

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setSaving(false);
    }
  }

  // Format action names for display
  const formatAction = (action: string) => {
    return action
      .split("_")
      .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
      .join(" ");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="space-y-6">
        <PageHeader title="Account" description="Manage your profile and settings" />
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">Failed to load profile data</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Account" description="Manage your profile and settings" />

      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">
          {successMessage}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Profile Information Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Update your personal details</CardDescription>
            </div>
            {profile.user.is_super_admin && (
              <Badge variant="default" className="gap-1">
                <Shield className="h-3 w-3" />
                Super Admin
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* First Name */}
            <div className="space-y-2">
              <label htmlFor="first_name" className="text-sm font-medium">
                First Name
              </label>
              <Input
                id="first_name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Enter your first name"
              />
            </div>

            {/* Last Name */}
            <div className="space-y-2">
              <label htmlFor="last_name" className="text-sm font-medium">
                Last Name
              </label>
              <Input
                id="last_name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Enter your last name"
              />
            </div>
          </div>

          {/* Email (Read-only) */}
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <Input id="email" value={profile.user.email} disabled className="bg-muted" />
          </div>

          {/* Phone Number */}
          <div className="space-y-2">
            <label htmlFor="phone" className="text-sm font-medium">
              Phone Number
            </label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Enter your phone number"
            />
          </div>

          {/* SMS Notifications Toggle */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <label htmlFor="sms_opt_in" className="text-sm font-medium cursor-pointer">
                SMS Notifications
              </label>
              <p className="text-sm text-muted-foreground">
                Receive text message updates about your events
              </p>
            </div>
            <Switch
              id="sms_opt_in"
              checked={smsOptIn}
              onCheckedChange={setSmsOptIn}
            />
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-4">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Organizations Card */}
      {profile.organizations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Organizations
            </CardTitle>
            <CardDescription>Organizations where you have admin privileges</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {profile.organizations.map((org) => (
                <Badge key={org.id} variant="secondary" className="text-sm py-1 px-3">
                  {org.name}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Recent Activity
          </CardTitle>
          <CardDescription>Your last 20 actions in the system</CardDescription>
        </CardHeader>
        <CardContent>
          {profile.recentActivity.length > 0 ? (
            <div className="space-y-4">
              {profile.recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start justify-between pb-4 last:pb-0 border-b last:border-0"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium">{formatAction(activity.action)}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {activity.entity_type} " {format(new Date(activity.created_at), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">No recent activity to display</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
