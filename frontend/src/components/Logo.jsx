import React from "react";

// Two interlocking glossy medical crosses (gold top-left, blush pink bottom-right).
// Transparent background so it sits on light or dark surfaces.
export function LogoMark({ size = 38, className = "" }) {
  const cross = (tx, ty) => (
    <g transform={`translate(${tx} ${ty})`}>
      <rect x="34" y="4" width="26" height="70" rx="9" />
      <rect x="12" y="26" width="70" height="26" rx="9" />
    </g>
  );
  return (
    <svg
      width={size}
      height={size * 0.82}
      viewBox="0 0 132 104"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id="hlGold" x1="0.1" y1="0.05" x2="0.9" y2="0.95">
          <stop offset="0" stopColor="#F7E39B" />
          <stop offset="0.5" stopColor="#D4AF37" />
          <stop offset="1" stopColor="#A87E23" />
        </linearGradient>
        <linearGradient id="hlPink" x1="0.1" y1="0.05" x2="0.9" y2="0.95">
          <stop offset="0" stopColor="#F9CFC8" />
          <stop offset="0.55" stopColor="#E89D93" />
          <stop offset="1" stopColor="#D0776D" />
        </linearGradient>
        <linearGradient id="hlGloss" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="0.45" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Gold cross — upper left */}
      <g fill="url(#hlGold)" stroke="#8f6c1d" strokeWidth="1.5">{cross(0, 0)}</g>
      <g fill="url(#hlGloss)">{cross(0, 0)}</g>

      {/* Pink cross — lower right, overlapping, with light rim for separation */}
      <g fill="url(#hlPink)" stroke="#ffffff" strokeWidth="2.5">{cross(42, 28)}</g>
      <g fill="url(#hlGloss)">{cross(42, 28)}</g>
    </svg>
  );
}

export function Logo({ dark = true, className = "" }) {
  const wordColor = dark ? "text-white" : "text-[#0F172A]";
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <LogoMark size={42} />
      <div className="leading-none">
        <div className={`font-display font-medium text-[11px] sm:text-[12px] ${wordColor}`}>My</div>
        <div className="font-display font-extrabold text-[16px] sm:text-[19px] tracking-tight mt-0.5">
          <span className={wordColor}>Healthcare</span>
          <span className="text-[#E89D93]"> Link</span>
        </div>
        <div className="text-[7.5px] sm:text-[8.5px] font-semibold tracking-[0.24em] mt-1 text-[#D4AF37]">
          HEALTHCARE CLOSER TO YOU
        </div>
      </div>
    </div>
  );
}
