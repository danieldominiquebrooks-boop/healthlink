import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, X, ChevronDown, MapPin, Search } from "lucide-react";
import { Logo } from "@/components/Logo";
import { NAV_LINKS, ISLANDS } from "@/lib/constants";
import { useIsland } from "@/context/IslandContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Header() {
  const [open, setOpen] = useState(false);
  const { island, setIsland } = useIsland();
  const location = useLocation();
  const navigate = useNavigate();
  const islandOptions = ["All Islands", ...ISLANDS];

  return (
    <header
      data-testid="main-header"
      className="sticky top-0 z-50 bg-[#0B132B]/95 backdrop-blur-md border-b border-[#D4AF37]/25"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-[72px]">
          <Link to="/" data-testid="logo-link" className="shrink-0">
            <Logo dark />
          </Link>

          <nav className="hidden lg:flex items-center gap-1">
            {NAV_LINKS.map((l) => {
              const active = location.pathname.startsWith(l.to);
              return (
                <Link
                  key={l.to}
                  to={l.to}
                  data-testid={`nav-${l.label.toLowerCase().replace(/\s/g, "-")}`}
                  className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                    active ? "text-[#D4AF37]" : "text-slate-200 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  data-testid="island-selector-trigger"
                  className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/8 border border-white/10 text-slate-100 text-sm font-medium hover:border-[#D4AF37]/50 transition-colors"
                >
                  <MapPin size={15} className="text-[#E89D93]" />
                  <span className="max-w-[130px] truncate">{island}</span>
                  <ChevronDown size={14} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
                {islandOptions.map((opt) => (
                  <DropdownMenuItem
                    key={opt}
                    data-testid={`island-option-${opt.replace(/\s|&/g, "-")}`}
                    onClick={() => setIsland(opt)}
                    className={island === opt ? "bg-[#FDF0EE] text-[#0F172A] font-semibold" : ""}
                  >
                    {opt}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <button
              data-testid="header-search-btn"
              onClick={() => navigate("/directory")}
              className="hidden sm:flex items-center justify-center w-9 h-9 rounded-lg bg-[#E89D93] text-white hover:bg-[#e08b80] transition-colors"
              aria-label="Search"
            >
              <Search size={17} />
            </button>

            <button
              data-testid="mobile-menu-btn"
              onClick={() => setOpen((v) => !v)}
              className="lg:hidden flex items-center justify-center w-9 h-9 rounded-lg bg-white/8 text-white"
              aria-label="Menu"
            >
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {open && (
        <div className="lg:hidden bg-[#0B132B] border-t border-white/10 px-4 py-3 space-y-1" data-testid="mobile-menu">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              onClick={() => setOpen(false)}
              className="block px-3 py-2.5 rounded-lg text-slate-200 hover:bg-white/5 text-sm font-medium"
            >
              {l.label}
            </Link>
          ))}
          <div className="pt-2 border-t border-white/10">
            <p className="px-3 pt-2 pb-1 text-xs uppercase tracking-widest text-[#D4AF37]">Island</p>
            <div className="grid grid-cols-2 gap-1">
              {["All Islands", ...ISLANDS].map((opt) => (
                <button
                  key={opt}
                  onClick={() => { setIsland(opt); setOpen(false); }}
                  className={`text-left px-3 py-2 rounded-lg text-sm ${island === opt ? "bg-[#E89D93] text-white" : "text-slate-200"}`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
