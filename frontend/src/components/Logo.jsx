import React from "react";

// Crosses-only mark (transparent PNG of the brand crosses).
export function LogoMark({ size = 40, className = "" }) {
  return (
    <img
      src="/logo-mark.png"
      alt="My Healthcare Link"
      className={className}
      style={{ height: size, width: "auto" }}
      draggable={false}
    />
  );
}

// Crosses mark + a crisp TEXT wordmark (theme-aware). The wordmark is real text
// so letter rendering stays sharp on every screen.
export function Logo({ dark = true, className = "" }) {
  const word = dark ? "text-white" : "text-[#0F172A]";
  return (
    <div className={`flex items-center gap-2.5 ${className}`} data-testid="brand-logo">
      <LogoMark size={42} />
      <div className="leading-none select-none">
        <div className={`font-display font-semibold text-[12px] ${word}`}>My</div>
        <div className="font-display font-extrabold text-[18px] sm:text-[20px] tracking-tight mt-[1px]">
          <span className={word}>Healthcare</span>
          <span className="text-[#E89D93]"> Link</span>
        </div>
        <div className="text-[7px] font-semibold tracking-[0.22em] text-[#D4AF37] mt-[3px]">
          HEALTHCARE CLOSER TO YOU
        </div>
      </div>
    </div>
  );
}
