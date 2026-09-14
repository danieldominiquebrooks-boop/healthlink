import React, { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { LogoMark } from "@/components/Logo";
import { useInstall } from "@/context/InstallContext";

const KEY = "hl_nudge_dismissed";

export function InstallNudge() {
  const { installed, canPrompt, promptInstall, openHelp } = useInstall();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (installed) return;
    if (localStorage.getItem(KEY)) return;
    if (window.innerWidth >= 768) return; // mobile visitors only
    const t = setTimeout(() => setShow(true), 2500);
    return () => clearTimeout(t);
  }, [installed]);

  if (!show || installed) return null;

  const dismiss = () => {
    localStorage.setItem(KEY, "1");
    setShow(false);
  };
  const install = async () => {
    if (canPrompt) await promptInstall();
    else openHelp();
    dismiss();
  };

  return (
    <div
      data-testid="install-nudge"
      className="fixed inset-x-3 bottom-3 z-[70] rounded-2xl hl-glass shadow-2xl p-3 flex items-center gap-3 animate-in slide-in-from-bottom-4 md:hidden"
    >
      <div className="w-11 h-11 rounded-xl bg-[#0B132B] flex items-center justify-center shrink-0">
        <LogoMark size={30} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white leading-tight">Add to your home screen</p>
        <p className="text-xs text-slate-300">Get quicker, full-screen access to My Healthcare Link.</p>
      </div>
      <button onClick={install} data-testid="nudge-install-btn" className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#E89D93] text-white text-sm font-semibold">
        <Download size={15} /> Add
      </button>
      <button onClick={dismiss} data-testid="nudge-dismiss-btn" aria-label="Dismiss" className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:bg-white/10">
        <X size={17} />
      </button>
    </div>
  );
}
