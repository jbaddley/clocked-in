"use client";

import { DynamicIcon, type IconName } from "lucide-react/dynamic";
import { cn } from "cn";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type Option = { value: string; label: string; group?: string; swatch?: string; icon?: string };

export function SelectField({
  id,
  value,
  onValueChange,
  options,
  placeholder = "Select",
  disabled,
  className,
  size,
  "aria-label": ariaLabel,
}: {
  id?: string;
  value: string;
  onValueChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  size?: "sm" | "default";
  "aria-label"?: string;
}) {
  const selected = options.find((option) => option.value === value);

  return (
    <Select
      items={options}
      value={value || null}
      onValueChange={(next) => onValueChange((next as string | null) ?? "")}
      disabled={disabled}
    >
      <SelectTrigger id={id} size={size} aria-label={ariaLabel} className={cn("w-full min-w-0", className)}>
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <OptionMark option={selected} />
          <SelectValue placeholder={placeholder} />
        </span>
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            <OptionMark option={option} />
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function OptionMark({ option }: { option?: Option }) {
  if (!option) return null;
  if (option.swatch) return <span className={cn("size-3 shrink-0 rounded-full", option.swatch)} />;
  if (option.icon) return <DynamicIcon name={option.icon as IconName} className="size-4 shrink-0" />;
  return null;
}
