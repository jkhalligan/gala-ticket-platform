"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Loader2, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";

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

interface BulkAssignGuestsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedGuestIds: string[];
  selectedGuestNames: string[];
  eventId: string;
  onSuccess?: () => void;
}

export function BulkAssignGuestsDialog({
  open,
  onOpenChange,
  selectedGuestIds,
  selectedGuestNames,
  eventId,
  onSuccess,
}: BulkAssignGuestsDialogProps) {
  const [tables, setTables] = React.useState<Table[]>([]);
  const [isLoadingTables, setIsLoadingTables] = React.useState(false);
  const [isAssigning, setIsAssigning] = React.useState(false);
  const [selectedTableId, setSelectedTableId] = React.useState<string | null>(null);
  const [comboboxOpen, setComboboxOpen] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState("");
  const [showCapacityWarning, setShowCapacityWarning] = React.useState(false);

  const { toast } = useToast();

  // Fetch tables when dialog opens
  React.useEffect(() => {
    if (open) {
      fetchTables();
    } else {
      // Reset state when dialog closes
      setSelectedTableId(null);
      setShowCapacityWarning(false);
      setSearchValue("");
    }
  }, [open]);

  // Check capacity when table is selected
  React.useEffect(() => {
    if (selectedTableId) {
      const table = tables.find(t => t.id === selectedTableId);
      if (table) {
        const newOccupancy = table.filled_seats + selectedGuestIds.length;
        setShowCapacityWarning(newOccupancy > table.capacity);
      }
    } else {
      setShowCapacityWarning(false);
    }
  }, [selectedTableId, tables, selectedGuestIds.length]);

  async function fetchTables() {
    setIsLoadingTables(true);
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
      setIsLoadingTables(false);
    }
  }

  async function handleBulkAssign() {
    if (!selectedTableId) {
      toast({
        title: "Error",
        description: "Please select a table",
        variant: "destructive",
      });
      return;
    }

    setIsAssigning(true);

    try {
      const response = await fetch("/api/admin/guests/bulk-assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guest_ids: selectedGuestIds,
          table_id: selectedTableId,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        const table = tables.find(t => t.id === selectedTableId);

        if (data.capacity_exceeded) {
          // Show capacity warning from API
          toast({
            title: "Capacity Warning",
            description: data.warning,
            variant: "default",
          });
        } else {
          toast({
            title: "Success",
            description: `${selectedGuestIds.length} guest(s) assigned to ${table?.name}`,
          });

          onSuccess?.();
          onOpenChange(false);
        }
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to assign guests",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to bulk assign guests:", error);
      toast({
        title: "Error",
        description: "Failed to assign guests",
        variant: "destructive",
      });
    } finally {
      setIsAssigning(false);
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

  const selectedTable = tables.find(t => t.id === selectedTableId);
  const filteredTables = tables.filter(table =>
    table.name.toLowerCase().includes(searchValue.toLowerCase())
  );

  const newOccupancy = selectedTable ? selectedTable.filled_seats + selectedGuestIds.length : 0;
  const newPercentage = selectedTable && selectedTable.capacity > 0
    ? Math.round((newOccupancy / selectedTable.capacity) * 100)
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Bulk Assign Guests</DialogTitle>
          <DialogDescription>
            Assign {selectedGuestIds.length} selected guest(s) to a table
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Selected Guests Summary */}
          <div className="rounded-lg border p-3 bg-muted/50">
            <div className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Selected guests ({selectedGuestIds.length}):</span>
            </div>
            <div className="mt-2 max-h-32 overflow-y-auto">
              <ul className="text-sm text-muted-foreground space-y-1">
                {selectedGuestNames.slice(0, 10).map((name, idx) => (
                  <li key={idx}>• {name}</li>
                ))}
                {selectedGuestNames.length > 10 && (
                  <li className="italic">... and {selectedGuestNames.length - 10} more</li>
                )}
              </ul>
            </div>
          </div>

          {/* Table Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Assign to table</label>
            <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={comboboxOpen}
                  className="w-full justify-between"
                  disabled={isLoadingTables || isAssigning}
                >
                  {isLoadingTables ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading tables...
                    </>
                  ) : selectedTable ? (
                    selectedTable.name
                  ) : (
                    <span className="text-muted-foreground">Select a table...</span>
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[460px] p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Search tables..."
                    value={searchValue}
                    onValueChange={setSearchValue}
                  />
                  <CommandList>
                    {filteredTables.length === 0 ? (
                      <CommandEmpty>No tables found.</CommandEmpty>
                    ) : (
                      <CommandGroup>
                        {filteredTables.map((table) => (
                          <CommandItem
                            key={table.id}
                            value={table.id}
                            onSelect={() => {
                              setSelectedTableId(table.id);
                              setComboboxOpen(false);
                            }}
                            className="flex items-center justify-between gap-2"
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <Check
                                className={cn(
                                  "h-4 w-4 shrink-0",
                                  selectedTableId === table.id ? "opacity-100" : "opacity-0"
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
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Capacity Preview */}
          {selectedTable && (
            <div className="rounded-lg border p-3 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Capacity Preview</span>
                <span className="text-muted-foreground">
                  {newOccupancy} / {selectedTable.capacity} seats
                </span>
              </div>
              <Progress value={Math.min(newPercentage, 100)} className="h-2" />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Current: {selectedTable.filled_seats}</span>
                <span>After: {newOccupancy} ({newPercentage}%)</span>
              </div>

              {showCapacityWarning && (
                <div className="rounded-md bg-yellow-50 border border-yellow-200 p-3">
                  <p className="text-sm text-yellow-800">
                    <strong>Warning:</strong> This assignment will exceed table capacity by{" "}
                    {newOccupancy - selectedTable.capacity} seat(s).
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isAssigning}
          >
            Cancel
          </Button>
          <Button
            onClick={handleBulkAssign}
            disabled={!selectedTableId || isAssigning}
          >
            {isAssigning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Assigning...
              </>
            ) : (
              `Assign ${selectedGuestIds.length} Guest(s)`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
