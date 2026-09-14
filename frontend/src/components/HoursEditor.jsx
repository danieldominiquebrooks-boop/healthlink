import React from "react";
import { DAYS } from "@/lib/hours";
import { Switch } from "@/components/ui/switch";

export function HoursEditor({ value, onChange, testid = "hours-editor" }) {
  const hours = value && typeof value === "object" ? value : {};

  const update = (key, patch) => {
    const next = { ...hours, [key]: { open: "09:00", close: "17:00", closed: false, ...hours[key], ...patch } };
    onChange(next);
  };

  return (
    <div className="rounded-xl border border-border divide-y divide-border overflow-hidden" data-testid={testid}>
      {DAYS.map((d) => {
        const day = hours[d.key] || {};
        const closed = !!day.closed;
        return (
          <div key={d.key} className="flex items-center gap-3 px-3 py-2 bg-card">
            <span className="w-14 text-sm font-medium text-[#0F172A]">{d.short}</span>
            {closed ? (
              <span className="flex-1 text-sm text-muted-foreground">Closed</span>
            ) : (
              <div className="flex-1 flex items-center gap-2">
                <input
                  type="time"
                  value={day.open || "09:00"}
                  onChange={(e) => update(d.key, { open: e.target.value })}
                  data-testid={`hours-${d.key}-open`}
                  className="rounded-md border border-input bg-background px-2 py-1 text-sm"
                />
                <span className="text-muted-foreground text-xs">to</span>
                <input
                  type="time"
                  value={day.close || "17:00"}
                  onChange={(e) => update(d.key, { close: e.target.value })}
                  data-testid={`hours-${d.key}-close`}
                  className="rounded-md border border-input bg-background px-2 py-1 text-sm"
                />
              </div>
            )}
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
              <Switch checked={closed} onCheckedChange={(v) => update(d.key, { closed: v })} data-testid={`hours-${d.key}-closed`} />
              Closed
            </label>
          </div>
        );
      })}
    </div>
  );
}
