"use client";

import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/src/components/ui/select";

export interface SelectFieldOption {
  value: string;
  label: string;
}

export function SelectField({
  name,
  defaultValue,
  placeholder,
  options,
  className,
  ariaLabel,
}: {
  name: string;
  defaultValue?: string;
  placeholder: string;
  options: SelectFieldOption[];
  className?: string;
  ariaLabel?: string;
}) {
  const emptyValue = "__empty__";
  const initialValue = defaultValue && defaultValue.length > 0 ? defaultValue : emptyValue;
  const [value, setValue] = useState(initialValue);
  const submittedValue = value === emptyValue ? "" : value;

  return (
    <>
    <input type="hidden" name={name} value={submittedValue} />
    <Select value={value} onValueChange={setValue}>
      <SelectTrigger className={className} aria-label={ariaLabel ?? placeholder}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={`${name}-${option.value || "empty"}`} value={option.value || emptyValue}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
    </>
  );
}
