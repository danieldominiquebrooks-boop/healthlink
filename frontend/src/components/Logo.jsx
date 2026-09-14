import React from "react";

// Crosses-only mark (transparent). Real brand asset.
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

// Full lockup. `dark` picks the version whose wordmark is legible on the surface:
// light surfaces use the navy wordmark; dark surfaces use the white wordmark.
export function Logo({ dark = true, className = "" }) {
  return (
    <img
      src={dark ? "/logo-dark.png" : "/logo-light.png"}
      alt="My Healthcare Link — Healthcare Closer To You"
      className={className}
      style={{ height: 46, width: "auto" }}
      draggable={false}
    />
  );
}
