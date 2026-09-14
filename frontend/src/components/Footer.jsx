import React from "react";
import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { NAV_LINKS, ISLANDS } from "@/lib/constants";
import { Mail, Phone, Heart } from "lucide-react";

export function Footer() {
  return (
    <footer className="hl-navy-gradient text-slate-300 mt-20" data-testid="main-footer">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          <div className="md:col-span-1">
            <Logo dark />
            <p className="mt-4 text-sm text-slate-400 leading-relaxed">
              Connecting Caribbean communities with trusted healthcare providers, services and information.
            </p>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Explore</h4>
            <ul className="space-y-2.5 text-sm">
              {NAV_LINKS.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="hover:text-[#D4AF37] transition-colors">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Islands</h4>
            <ul className="space-y-2 text-sm grid grid-cols-1">
              {ISLANDS.slice(0, 6).map((i) => (
                <li key={i} className="text-slate-400">{i}</li>
              ))}
              <li className="text-[#E89D93]">+ {ISLANDS.length - 6} more territories</li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Contact</h4>
            <ul className="space-y-3 text-sm">
              <li className="flex items-center gap-2"><Mail size={15} className="text-[#D4AF37]" /> hello@myhealthcarelink.com</li>
              <li className="flex items-center gap-2"><Phone size={15} className="text-[#D4AF37]" /> +1 (246) 000-0000</li>
            </ul>
            <Link
              to="/admin"
              data-testid="footer-admin-link"
              className="inline-block mt-5 text-xs text-slate-500 hover:text-[#D4AF37] transition-colors"
            >
              Admin Login
            </Link>
          </div>
        </div>
        <div className="mt-12 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} My Healthcare Link · Horizon Health. All rights reserved.</p>
          <p className="flex items-center gap-1.5">Built with <Heart size={12} className="text-[#E89D93]" fill="#E89D93" /> for the Caribbean</p>
        </div>
      </div>
    </footer>
  );
}
