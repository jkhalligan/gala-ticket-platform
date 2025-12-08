"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, CheckCircle, XCircle } from "lucide-react";

import { useDebounce } from "@/hooks/use-debounce";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TableDetail {
  id: string;
  name: string;
  slug: string;
  type: "PREPAID" | "CAPTAIN_PAYG";
  status: "ACTIVE" | "CLOSED" | "ARCHIVED";
  capacity: number;
  tableNumber: string | null;
  internalName: string | null;
  welcomeMessage: string | null;
  eventId: string;
}

export default function TableEditPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [originalSlug, setOriginalSlug] = React.useState("");

  // Form state
  const [name, setName] = React.useState("");
  const [formSlug, setFormSlug] = React.useState("");
  const [type, setType] = React.useState<"PREPAID" | "CAPTAIN_PAYG">("CAPTAIN_PAYG");
  const [status, setStatus] = React.useState<"ACTIVE" | "CLOSED" | "ARCHIVED">("ACTIVE");
  const [capacity, setCapacity] = React.useState("10");
  const [tableNumber, setTableNumber] = React.useState("");
  const [internalName, setInternalName] = React.useState("");
  const [welcomeMessage, setWelcomeMessage] = React.useState("");
  const [eventId, setEventId] = React.useState("");

  // Slug validation state
  const [slugStatus, setSlugStatus] = React.useState<"idle" | "checking" | "available" | "taken">("idle");
  const debouncedSlug = useDebounce(formSlug, 500);

  // Fetch table data
  React.useEffect(() => {
    async function fetchTable() {
      try {
        const response = await fetch(`/api/admin/tables/${slug}`);
        if (response.ok) {
          const data = await response.json();
          const table = data.table as TableDetail;

          setName(table.name);
          setFormSlug(table.slug);
          setOriginalSlug(table.slug);
          setType(table.type);
          setStatus(table.status);
          setCapacity(String(table.capacity));
          setTableNumber(table.tableNumber || "");
          setInternalName(table.internalName || "");
          setWelcomeMessage(table.welcomeMessage || "");
          setEventId(table.eventId);
        } else if (response.status === 404) {
          setError("Table not found");
        } else {
          setError("Failed to load table");
        }
      } catch (err) {
        console.error("Failed to fetch table:", err);
        setError("Failed to load table");
      } finally {
        setIsLoading(false);
      }
    }

    if (slug) {
      fetchTable();
    }
  }, [slug]);

  // Show checking state when slug changes
  React.useEffect(() => {
    if (formSlug && eventId && formSlug !== debouncedSlug && formSlug !== originalSlug) {
      setSlugStatus("checking");
    }
  }, [formSlug, eventId, debouncedSlug, originalSlug]);

  // Validate slug uniqueness
  React.useEffect(() => {
    // Skip validation if slug hasn't changed from original
    if (debouncedSlug === originalSlug) {
      setSlugStatus("available");
      return;
    }

    if (!debouncedSlug || !eventId) {
      setSlugStatus("idle");
      return;
    }

    async function validateSlug() {
      setSlugStatus("checking");
      try {
        const response = await fetch(
          `/api/admin/tables/validate-slug?slug=${encodeURIComponent(debouncedSlug)}&eventId=${encodeURIComponent(eventId)}`
        );
        if (response.ok) {
          const data = await response.json();
          setSlugStatus(data.isUnique ? "available" : "taken");
        } else {
          setSlugStatus("available");
        }
      } catch {
        setSlugStatus("available");
      }
    }

    validateSlug();
  }, [debouncedSlug, eventId, originalSlug]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Table name is required");
      return;
    }

    if (slugStatus === "taken") {
      setError("This slug is already in use. Please choose a different one.");
      return;
    }

    const capacityNum = parseInt(capacity, 10);
    if (isNaN(capacityNum) || capacityNum < 1) {
      setError("Capacity must be at least 1");
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(`/api/admin/tables/${slug}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          slug: formSlug.trim(),
          type,
          status,
          capacity: capacityNum,
          tableNumber: tableNumber.trim() || null,
          internalName: internalName.trim() || null,
          welcomeMessage: welcomeMessage.trim() || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update table");
      }

      const data = await response.json();
      // Navigate to the new slug if it changed
      router.push(`/admin/tables/${data.table.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update table");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error && !name) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/admin/tables">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Tables
            </Link>
          </Button>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/admin/tables/${slug}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Table
          </Link>
        </Button>
      </div>

      <PageHeader
        title="Edit Table"
        description={`Editing: ${name}`}
      />

      <Card>
        <CardHeader>
          <CardTitle>Table Details</CardTitle>
          <CardDescription>
            Update the table information below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-destructive/15 text-destructive text-sm p-3 rounded-md">
                {error}
              </div>
            )}

            <div className="grid gap-6 md:grid-cols-2">
              {/* Name */}
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium">
                  Table Name <span className="text-destructive">*</span>
                </label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., VIP Table 1"
                  disabled={isSaving}
                />
              </div>

              {/* Slug */}
              <div className="space-y-2">
                <label htmlFor="slug" className="text-sm font-medium">
                  Slug (URL-friendly identifier)
                </label>
                <div className="relative">
                  <Input
                    id="slug"
                    value={formSlug}
                    onChange={(e) => setFormSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                    placeholder="table-slug"
                    disabled={isSaving}
                    className="pr-10"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {slugStatus === "checking" && (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                    {slugStatus === "available" && (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    )}
                    {slugStatus === "taken" && (
                      <XCircle className="h-4 w-4 text-destructive" />
                    )}
                  </div>
                </div>
                {slugStatus === "taken" && (
                  <p className="text-xs text-destructive">This slug is already in use</p>
                )}
              </div>

              {/* Type */}
              <div className="space-y-2">
                <label htmlFor="type" className="text-sm font-medium">
                  Table Type
                </label>
                <Select
                  value={type}
                  onValueChange={(value) => setType(value as "PREPAID" | "CAPTAIN_PAYG")}
                  disabled={isSaving}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CAPTAIN_PAYG">Captain PAYG (guests pay individually)</SelectItem>
                    <SelectItem value="PREPAID">Prepaid (host pays upfront)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Status */}
              <div className="space-y-2">
                <label htmlFor="status" className="text-sm font-medium">
                  Status
                </label>
                <Select
                  value={status}
                  onValueChange={(value) => setStatus(value as "ACTIVE" | "CLOSED" | "ARCHIVED")}
                  disabled={isSaving}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="CLOSED">Closed</SelectItem>
                    <SelectItem value="ARCHIVED">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Capacity */}
              <div className="space-y-2">
                <label htmlFor="capacity" className="text-sm font-medium">
                  Capacity
                </label>
                <Input
                  id="capacity"
                  type="number"
                  min="1"
                  max="100"
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  disabled={isSaving}
                />
              </div>

              {/* Table Number */}
              <div className="space-y-2">
                <label htmlFor="tableNumber" className="text-sm font-medium">
                  Table Number
                </label>
                <Input
                  id="tableNumber"
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  placeholder="e.g., T-001"
                  disabled={isSaving}
                />
              </div>
            </div>

            {/* Internal Name - Full width */}
            <div className="space-y-2">
              <label htmlFor="internalName" className="text-sm font-medium">
                Internal Name (admin only)
              </label>
              <Input
                id="internalName"
                value={internalName}
                onChange={(e) => setInternalName(e.target.value)}
                placeholder="e.g., Sponsor Table - Acme Corp"
                disabled={isSaving}
              />
            </div>

            {/* Welcome Message - Full width */}
            <div className="space-y-2">
              <label htmlFor="welcomeMessage" className="text-sm font-medium">
                Welcome Message
              </label>
              <textarea
                id="welcomeMessage"
                value={welcomeMessage}
                onChange={(e) => setWelcomeMessage(e.target.value)}
                placeholder="Message shown to guests when they view this table..."
                disabled={isSaving}
                rows={4}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            {/* Form Actions */}
            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(`/admin/tables/${slug}`)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving || slugStatus === "taken"}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
