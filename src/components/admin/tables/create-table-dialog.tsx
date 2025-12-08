"use client";

import * as React from "react";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

import { useDebounce } from "@/hooks/use-debounce";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Event {
  id: string;
  name: string;
}

interface CreateTableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CreateTableDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateTableDialogProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [events, setEvents] = React.useState<Event[]>([]);
  const [eventsLoading, setEventsLoading] = React.useState(false);

  // Form state
  const [name, setName] = React.useState("");
  const [eventId, setEventId] = React.useState("");
  const [capacity, setCapacity] = React.useState("10");
  const [type, setType] = React.useState<"PREPAID" | "CAPTAIN_PAYG">("CAPTAIN_PAYG");
  const [welcomeMessage, setWelcomeMessage] = React.useState("");
  const [internalName, setInternalName] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [tableNumber, setTableNumber] = React.useState("");

  // Slug validation state
  const [slugStatus, setSlugStatus] = React.useState<"idle" | "checking" | "available" | "taken">("idle");

  // Debounce the slug value for validation (500ms delay)
  const debouncedSlug = useDebounce(slug, 500);

  // Fetch events when dialog opens
  React.useEffect(() => {
    if (open) {
      fetchEvents();
    }
  }, [open]);

  // Auto-generate slug from name
  React.useEffect(() => {
    if (name && !slug) {
      const generatedSlug = name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      setSlug(generatedSlug);
    }
  }, [name, slug]);

  // Show checking state when slug changes but debounced value hasn't caught up
  React.useEffect(() => {
    if (slug && eventId && slug !== debouncedSlug) {
      setSlugStatus("checking");
    }
  }, [slug, eventId, debouncedSlug]);

  // Check slug availability when debounced value changes
  React.useEffect(() => {
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
          // If endpoint returns an error, assume available (API will handle uniqueness on submit)
          setSlugStatus("available");
        }
      } catch {
        // On network error, assume available (API will handle uniqueness on submit)
        setSlugStatus("available");
      }
    }

    validateSlug();
  }, [debouncedSlug, eventId]);

  async function fetchEvents() {
    setEventsLoading(true);
    try {
      const response = await fetch("/api/admin/events");
      if (response.ok) {
        const data = await response.json();
        setEvents(data.events || []);
        // Auto-select first event if only one exists
        if (data.events?.length === 1) {
          setEventId(data.events[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to fetch events:", err);
    } finally {
      setEventsLoading(false);
    }
  }

  function resetForm() {
    setName("");
    setEventId("");
    setCapacity("10");
    setType("CAPTAIN_PAYG");
    setWelcomeMessage("");
    setInternalName("");
    setSlug("");
    setTableNumber("");
    setError(null);
    setSlugStatus("idle");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Validation
    if (!name.trim()) {
      setError("Table name is required");
      return;
    }

    if (!eventId) {
      setError("Please select an event");
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

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/admin/tables", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          eventId,
          capacity: capacityNum,
          type,
          welcomeMessage: welcomeMessage.trim() || undefined,
          internalName: internalName.trim() || undefined,
          slug: slug.trim() || undefined,
          tableNumber: tableNumber.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create table");
      }

      // Success
      resetForm();
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create table");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleOpenChange(newOpen: boolean) {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Table</DialogTitle>
          <DialogDescription>
            Add a new table to an event. Fill in the details below.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-destructive/15 text-destructive text-sm p-3 rounded-md">
              {error}
            </div>
          )}

          {/* Name - Required */}
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">
              Table Name <span className="text-destructive">*</span>
            </label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., VIP Table 1"
              disabled={isSubmitting}
            />
          </div>

          {/* Event - Required */}
          <div className="space-y-2">
            <label htmlFor="event" className="text-sm font-medium">
              Event <span className="text-destructive">*</span>
            </label>
            <Select
              value={eventId}
              onValueChange={setEventId}
              disabled={isSubmitting || eventsLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder={eventsLoading ? "Loading events..." : "Select an event"} />
              </SelectTrigger>
              <SelectContent>
                {events.map((event) => (
                  <SelectItem key={event.id} value={event.id}>
                    {event.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Slug - With availability check */}
          <div className="space-y-2">
            <label htmlFor="slug" className="text-sm font-medium">
              Slug (URL-friendly identifier)
            </label>
            <div className="relative">
              <Input
                id="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                placeholder="auto-generated-from-name"
                disabled={isSubmitting}
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
              disabled={isSubmitting}
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
              disabled={isSubmitting}
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
              disabled={isSubmitting}
            />
          </div>

          {/* Internal Name */}
          <div className="space-y-2">
            <label htmlFor="internalName" className="text-sm font-medium">
              Internal Name (admin only)
            </label>
            <Input
              id="internalName"
              value={internalName}
              onChange={(e) => setInternalName(e.target.value)}
              placeholder="e.g., Sponsor Table - Acme Corp"
              disabled={isSubmitting}
            />
          </div>

          {/* Welcome Message */}
          <div className="space-y-2">
            <label htmlFor="welcomeMessage" className="text-sm font-medium">
              Welcome Message
            </label>
            <textarea
              id="welcomeMessage"
              value={welcomeMessage}
              onChange={(e) => setWelcomeMessage(e.target.value)}
              placeholder="Message shown to guests when they view this table..."
              disabled={isSubmitting}
              rows={3}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || slugStatus === "taken"}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSubmitting ? "Creating..." : "Create Table"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
