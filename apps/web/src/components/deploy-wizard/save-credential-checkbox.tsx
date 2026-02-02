"use client";

import { Input } from "@/components/ui/input";

interface SaveCredentialCheckboxProps {
  value: { save: boolean; name: string };
  onChange: (value: { save: boolean; name: string }) => void;
}

export function SaveCredentialCheckbox({
  value,
  onChange,
}: SaveCredentialCheckboxProps) {
  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={value.save}
          onChange={(e) =>
            onChange({ ...value, save: e.target.checked })
          }
          className="h-4 w-4 rounded border-border text-primary focus:ring-primary/50 accent-primary"
        />
        <span className="text-sm text-foreground">Save for future use</span>
      </label>
      {value.save && (
        <Input
          placeholder="e.g., My AWS Production"
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
        />
      )}
    </div>
  );
}
