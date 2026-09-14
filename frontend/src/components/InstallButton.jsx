import React from "react";
import { Download } from "lucide-react";
import { useInstall } from "@/context/InstallContext";

export function InstallButton({ variant = "desktop", onNavigate }) {
  const { installed, canPrompt, promptInstall, openHelp } = useInstall();
  if (installed) return null;

  const handleClick = async () => {
    if (onNavigate) onNavigate();
    if (canPrompt) await promptInstall();
    else openHelp();
  };

  if (variant === "mobile") {
    return (
      <button onClick={handleClick} data-testid="install-app-mobile" className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-[#E89D93] text-white text-sm font-semibold">
        <Download size={15} /> Download the app
      </button>
    );
  }
  return (
    <button onClick={handleClick} data-testid="install-app-btn" className="hidden md:flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#E89D93] text-white text-sm font-semibold hover:bg-[#e08b80] transition-colors">
      <Download size={15} /> Get the app
    </button>
  );
}
