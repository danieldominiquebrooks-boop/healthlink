import React from "react";
import { Star } from "lucide-react";

export function StarRating({ value = 0, size = 15, showValue = false, count, onSelect, interactive = false }) {
  const stars = [1, 2, 3, 4, 5];
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center">
        {stars.map((s) => {
          const filled = value >= s - 0.25;
          return (
            <button
              key={s}
              type="button"
              disabled={!interactive}
              onClick={() => interactive && onSelect && onSelect(s)}
              className={interactive ? "cursor-pointer transition-transform hover:scale-110" : "cursor-default"}
              data-testid={interactive ? `star-${s}` : undefined}
              aria-label={`${s} star`}
            >
              <Star
                size={size}
                className={filled ? "text-[#D4AF37]" : "text-slate-300"}
                fill={filled ? "#D4AF37" : "none"}
                strokeWidth={2}
              />
            </button>
          );
        })}
      </div>
      {showValue && (
        <span className="text-sm font-semibold text-[#0F172A]">
          {Number(value).toFixed(1)}
          {typeof count === "number" && <span className="text-muted-foreground font-normal"> ({count})</span>}
        </span>
      )}
    </div>
  );
}
