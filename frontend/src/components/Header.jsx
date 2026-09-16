import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, X, ChevronDown, MapPin, Search, Heart, Sun, Moon } from "lucide-react";
import { Logo } from "@/components/Logo";
import { InstallButton } from "@/components/InstallButton";
import { NAV_LINKS, COUNTRY_NAMES, regionsFor, ALL_COUNTRIES, ALL_REGIONS } from "@/lib/constants";
import { useLocation as useAppLocation } from "@/context/LocationContext";
import { useSaved } from "@/context/SavedContext";
import { useTheme } from "@/context/ThemeContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Header() {
  const [open, setOpen] = useState(false);
  const { country, setCountry, region, setRegion } = useAppLocation();
  const { count } = useSaved();
  const { theme, toggle } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const countryOptions = [ALL_COUNTRIES, ...COUNTRY_NAMES];
  const regionOptions = [ALL_REGIONS, ...regionsFor(country)];

  const dark = theme === "dark";
  const iconBtn = dark
    ? "bg-white/8 border-white/10 text-slate-100 hover:border-[#D4AF37]/50"
    : "bg-black/[0.04] border-black/10 text-[#0F172A] hover:border-[#D4AF37]/60";
  const navInactive = dark
    ? "text-slate-200 hover:text-white hover:bg-white/5"
    : "text-slate-600 hover:text-[#0F172A] hover:bg-black/[0.04]";

  return (
    <header
      data-testid="main-header"
      className={`sticky top-0 z-50 backdrop-blur-md border-b transition-colors ${dark ? "bg-[#0B132B]/95 border-[#D4AF37]/25" : "bg-white/95 border-[#E89D93]/25"}`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-[72px]">
          <Link to="/" data-testid="logo-link" className="shrink-0">
            <Logo dark={dark} />
          </Link>

          <nav className="hidden lg:flex items-center gap-1">
            {NAV_LINKS.map((l) => {
              const active = location.pathname.startsWith(l.to);
              return (
                <Link
                  key={l.to}
                  to={l.to}
                  data-testid={`nav-${l.label.toLowerCase().replace(/\s/g, "-")}`}
                  className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${active ? "text-[#D4AF37]" : navInactive}`}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <InstallButton variant="desktop" />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  data-testid="country-selector-trigger"
                  className={`hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${iconBtn}`}
                >
                  <MapPin size={15} className="text-[#E89D93]" />
                  <span className="max-w-[130px] truncate">{country}</span>
                  <ChevronDown size={14} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
                {countryOptions.map((opt) => (
                  <DropdownMenuItem
                    key={opt}
                    data-testid={`country-option-${opt.replace(/\s|&/g, "-")}`}
                    onClick={() => setCountry(opt)}
                    className={country === opt ? "bg-[#FDF0EE] text-[#0F172A] font-semibold" : ""}
                  >
                    {opt}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {country !== ALL_COUNTRIES && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    data-testid="region-selector-trigger"
                    className={`hidden md:flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${iconBtn}`}
                  >
                    <span className="max-w-[130px] truncate">{region}</span>
                    <ChevronDown size={14} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
                  {regionOptions.map((opt) => (
                    <DropdownMenuItem
                      key={opt}
                      data-testid={`region-option-${opt.replace(/\s|&|\/|\./g, "-")}`}
                      onClick={() => setRegion(opt)}
                      className={region === opt ? "bg-[#FDF0EE] text-[#0F172A] font-semibold" : ""}
                    >
                      {opt}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <button
              data-testid="header-search-btn"
              onClick={() => navigate("/directory")}
              className="hidden sm:flex items-center justify-center w-9 h-9 rounded-lg bg-[#E89D93] text-white hover:bg-[#e08b80] transition-colors"
              aria-label="Search"
            >
              <Search size={17} />
            </button>

            <button
              onClick={toggle}
              data-testid="theme-toggle"
              className={`flex items-center justify-center w-9 h-9 rounded-lg border transition-colors ${iconBtn}`}
              aria-label="Toggle light and dark mode"
            >
              {dark ? <Sun size={17} className="text-[#D4AF37]" /> : <Moon size={17} />}
            </button>

            <Link
              to="/saved"
              data-testid="header-saved-link"
              className={`hidden sm:flex relative items-center justify-center w-9 h-9 rounded-lg border transition-colors ${iconBtn}`}
              aria-label="Saved providers"
            >
              <Heart size={17} className={count > 0 ? "text-[#E89D93]" : ""} fill={count > 0 ? "#E89D93" : "none"} />
              {count > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[17px] h-[17px] px-1 rounded-full bg-[#D4AF37] text-[#0B132B] text-[10px] font-bold flex items-center justify-center" data-testid="saved-count">
                  {count}
                </span>
              )}
            </Link>

            <button
              data-testid="mobile-menu-btn"
              onClick={() => setOpen((v) => !v)}
              className={`lg:hidden flex items-center justify-center w-9 h-9 rounded-lg border ${iconBtn}`}
              aria-label="Menu"
            >
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {open && (
        <div className={`lg:hidden border-t px-4 py-3 space-y-1 ${dark ? "bg-[#0B132B] border-white/10" : "bg-white border-black/10"}`} data-testid="mobile-menu">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              onClick={() => setOpen(false)}
              className={`block px-3 py-2.5 rounded-lg text-sm font-medium ${navInactive}`}
            >
              {l.label}
            </Link>
          ))}
          <div className="py-1"><InstallButton variant="mobile" onNavigate={() => setOpen(false)} /></div>
          <Link
            to="/saved"
            onClick={() => setOpen(false)}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium ${navInactive}`}
          >
            <Heart size={15} className={count > 0 ? "text-[#E89D93]" : ""} fill={count > 0 ? "#E89D93" : "none"} /> Saved{count > 0 ? ` (${count})` : ""}
          </Link>
          <button
            onClick={toggle}
            data-testid="theme-toggle-mobile"
            className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium ${navInactive}`}
          >
            {dark ? <Sun size={15} className="text-[#D4AF37]" /> : <Moon size={15} />} {dark ? "Light mode" : "Dark mode"}
          </button>
          <div className={`pt-2 border-t ${dark ? "border-white/10" : "border-black/10"}`}>
            <p className="px-3 pt-2 pb-1 text-xs uppercase tracking-widest text-[#D4AF37]">Country</p>
            <div className="grid grid-cols-2 gap-1">
              {[ALL_COUNTRIES, ...COUNTRY_NAMES].map((opt) => (
                <button
                  key={opt}
                  onClick={() => { setCountry(opt); }}
                  className={`text-left px-3 py-2 rounded-lg text-sm ${country === opt ? "bg-[#E89D93] text-white" : navInactive}`}
                >
                  {opt}
                </button>
              ))}
            </div>
            {country !== ALL_COUNTRIES && (
              <>
                <p className="px-3 pt-3 pb-1 text-xs uppercase tracking-widest text-[#D4AF37]">Parish / Island</p>
                <div className="grid grid-cols-2 gap-1">
                  {[ALL_REGIONS, ...regionsFor(country)].map((opt) => (
                    <button
                      key={opt}
                      onClick={() => { setRegion(opt); setOpen(false); }}
                      className={`text-left px-3 py-2 rounded-lg text-sm ${region === opt ? "bg-[#D4AF37] text-[#0B132B]" : navInactive}`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
