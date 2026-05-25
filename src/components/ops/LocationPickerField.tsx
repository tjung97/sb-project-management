"use client";

import { SidebarListPicker } from "@/src/components/ops/SidebarListPicker";

export function LocationPickerField({
  locations,
  name = "location_ids",
  defaultCheckedIds = [],
}: {
  locations: Array<{ id: string; name: string }>;
  name?: string;
  defaultCheckedIds?: string[];
}) {
  return (
    <SidebarListPicker
      name={name}
      mode="multiple"
      display="embedded"
      fieldLabel="Locations"
      dialogTitle="Set locations"
      filterPlaceholder="Filter locations"
      noneLabel="Company-wide"
      options={locations.map((location) => ({ value: location.id, label: location.name }))}
      selected={defaultCheckedIds}
    />
  );
}
