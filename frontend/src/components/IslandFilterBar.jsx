import React from "react";
import { ISLANDS } from "@/lib/constants";
import { useIsland } from "@/context/IslandContext";
import { MapPin } from "lucide-react";

export function IslandFilterBar() {
  const { island, setIsland } = useIsland();
  const options = ["All Islands", ...ISLANDS];
  return (
    <div className="bg-white border-b border-[#E89D93]/15 sticky top-16 lg:top-[72px] z-40" data-testid="island-filter-bar">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 py-3 overflow-x-auto hl-scrollbar-hide">
          <span className="hidden sm:flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground shrink-0 mr-1">
            <MapPin size={14} className="text-[#E89D93]" /> Island
          </span>
          {options.map((opt) => {
            const active = island === opt;
            return (
              <button
                key={opt}
                data-testid={`island-pill-${opt.replace(/\s|&/g, "-")}`}
                onClick={() => setIsland(opt)}
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all border ${
                  active
                    ? "bg-[#D4AF37] text-white border-[#D4AF37] shadow-sm"
                    : "bg-[#FAF7F2] text-[#0F172A] border-transparent hover:border-[#D4AF37]/40"
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
