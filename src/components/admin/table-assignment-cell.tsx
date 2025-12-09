"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface Table {
  id: string;
  name: string;
  slug: string;
  capacity: number;
  filled_seats: number;
  availability: "available" | "almost_full" | "at_capacity";
  percentage_filled: number;
  eventId: string;
}

interface TableAssignmentCellProps {
  guestId: string;
  guestName: string;
  currentTableId: string | null;
  currentTableName: string | null;
  eventId: string;
  onAssignmentChange?: () => void;
}

export function TableAssignmentCell({
  guestId,
  guestName,
  currentTableId,
  currentTableName,
  eventId,
  onAssignmentChange,
}: TableAssignmentCellProps) {
  const [open, setOpen] = React.useState(false);
  const [tables, setTables] = React.useState<Table[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState("");

  // Confirmation dialog state
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [pendingTableId, setPendingTableId] = React.useState<string | null>(null);
  const [pendingTableName, setPendingTableName] = React.useState<string | null>(null);

  const { toast } = useToast();

  // Fetch tables when popover opens
  React.useEffect(() => {
    if (open && tables.length === 0) {
      fetchTables();
    }
  }, [open]);

  async function fetchTables() {
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/tables?include_capacity=true");
      if (response.ok) {
        const data = await response.json();
        // Filter to only tables from the same event
        const filteredTables = data.tables.filter((t: Table) => t.eventId === eventId);
        setTables(filteredTables);
      } else {
        toast({
          title: "Error",
          description: "Failed to load tables",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to fetch tables:", error);
      toast({
        title: "Error",
        description: "Failed to load tables",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAssignment(tableId: string | null, tableName: string | null) {
    // If guest is already assigned, show confirmation dialog
    if (currentTableId && tableId !== currentTableId) {
      setPendingTableId(tableId);
      setPendingTableName(tableName);
      setShowConfirm(true);
      return;
    }

    // Otherwise, proceed with assignment
    await performAssignment(tableId);
  }

  async function performAssignment(tableId: string | null) {
    setIsSaving(true);
    setShowConfirm(false);

    try {
      const response = await fetch(`/api/admin/guests/${guestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table_id: tableId }),
      });

      if (response.ok) {
        const tableName = tableId
          ? tables.find(t => t.id === tableId)?.name || "Unknown"
          : "Unassigned";

        toast({
          title: "Success",
          description: `${guestName} assigned to ${tableName}`,
        });

        // Refresh tables to update capacity
        await fetchTables();

        // Notify parent component
        onAssignmentChange?.();

        setOpen(false);
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to update assignment",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to assign guest:", error);
      toast({
        title: "Error",
        description: "Failed to update assignment",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
      setPendingTableId(null);
      setPendingTableName(null);
    }
  }

  function getAvailabilityBadge(availability: "available" | "almost_full" | "at_capacity") {
    switch (availability) {
      case "available":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Available</Badge>;
      case "almost_full":
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Almost Full</Badge>;
      case "at_capacity":
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">At Capacity</Badge>;
    }
  }

  // Filter tables based on search
  const filteredTables = tables.filter(table =>
    table.name.toLowerCase().includes(searchValue.toLowerCase())
  );

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : currentTableName ? (
              currentTableName
            ) : (
              <span className="text-muted-foreground italic">Unassigned</span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search tables..."
              value={searchValue}
              onValueChange={setSearchValue}
            />
            <CommandList>
              {isLoading ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                  Loading tables...
                </div>
              ) : filteredTables.length === 0 ? (
                <CommandEmpty>No tables found.</CommandEmpty>
              ) : (
                <>
                  <CommandGroup heading="Tables">
                    {filteredTables.map((table) => (
                      <CommandItem
                        key={table.id}
                        value={table.id}
                        onSelect={() => {
                          handleAssignment(table.id, table.name);
                        }}
                        className="flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <Check
                            className={cn(
                              "h-4 w-4 shrink-0",
                              currentTableId === table.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <span className="truncate">{table.name}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-muted-foreground">
                            {table.filled_seats}/{table.capacity}
                          </span>
                          {getAvailabilityBadge(table.availability)}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>

                  {currentTableId && (
                    <>
                      <div className="border-t" />
                      <CommandGroup>
                        <CommandItem
                          value="unassign"
                          onSelect={() => {
                            handleAssignment(null, null);
                          }}
                          className="text-destructive"
                        >
                          <Check className="mr-2 h-4 w-4 opacity-0" />
                          Remove from table
                        </CommandItem>
                      </CommandGroup>
                    </>
                  )}
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reassign Guest?</AlertDialogTitle>
            <AlertDialogDescription>
              {guestName} is currently assigned to {currentTableName}.
              {pendingTableId ? (
                <> Are you sure you want to reassign them to {pendingTableName}?</>
              ) : (
                <> Are you sure you want to remove them from this table?</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => performAssignment(pendingTableId)}
            >
              {pendingTableId ? "Reassign" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
