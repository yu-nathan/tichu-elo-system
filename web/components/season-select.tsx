"use client";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import type { Season } from "@/lib/seasons";

export const SeasonSelect = ({
  seasons,
  value,
  onChange,
  label,
  allowAll = false,
}: {
  seasons: Season[];
  value: number | null;
  onChange: (id: number | null) => void;
  label: string;
  allowAll?: boolean;
}) => {
  const items = [
    ...(allowAll ? [{ value: "all", label: "All seasons" }] : []),
    ...seasons.map((season) => ({
      value: String(season.id),
      label: `${season.label}${season.status === "current" ? " · Current season" : ""}`,
    })),
  ];
  const selectedValue = value === null ? "all" : String(value);
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        aria-label={label}
        render={<Button variant="outline" className="w-full justify-between" />}
      >
        <span className="truncate">
          {items.find((item) => item.value === selectedValue)?.label}
        </span>
        <ChevronDown className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuRadioGroup
          value={selectedValue}
          onValueChange={(id) => onChange(id === "all" ? null : Number(id))}
        >
          {items.map((item) => (
            <DropdownMenuRadioItem
              key={item.value}
              value={item.value}
              closeOnClick
            >
              {item.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
