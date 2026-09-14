import React from "react";

// Two interlocking medical crosses (gold + blush) matching the brand logo.
export function LogoMark({ size = 34 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="hlGold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F2D98D" />
          <stop offset="0.55" stopColor="#D4AF37" />
          <stop offset="1" stopColor="#B8912B" />
        </linearGradient>
        <linearGradient id="hlBlush" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F3B8AF" />
          <stop offset="1" stopColor="#E0837A" />
        </linearGradient>
      </defs>
      <path fill="url(#hlGold)" d="M20 4h10a4 4 0 0 1 4 4v8h8a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4h-8v8a4 4 0 0 1-4 4H20a4 4 0 0 1-4-4v-8H8a4 4 0 0 1-4-4V20a4 4 0 0 1 4-4h8V8a4 4 0 0 1 4-4Z" transform="translate(-1 0)" />
      <path fill="url(#hlBlush)" opacity="0.95" d="M34 22h10a4 4 0 0 1 4 4v8h8a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4h-8v8a4 4 0 0 1-4 4H34a4 4 0 0 1-4-4v-8h-8a4 4 0 0 1-4-4V38a4 4 0 0 1 4-4h8v-8a4 4 0 0 1 4-4Z" transform="translate(-4 -2) scale(0.92)" />
    </svg>
  );
}

export function Logo({ dark = true, className = "" }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <LogoMark size={38} />
      <div className="leading-none">
        <div className="font-display font-extrabold text-[15px] sm:text-[17px] tracking-tight">
          <span className={dark ? "text-white" : "text-[#0F172A]"}>My </span>
          <span className={dark ? "text-white" : "text-[#0F172A]"}>Healthcare</span>
          <span className="text-[#E89D93]">Link</span>
        </div>
        <div className="text-[8px] sm:text-[9px] font-semibold tracking-[0.28em] mt-0.5 text-[#D4AF37]">
          HEALTHCARE CLOSER TO YOU
        </div>
      </div>
    </div>
  );
}
