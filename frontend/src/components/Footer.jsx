import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { NAV_LINKS, COUNTRY_NAMES } from "@/lib/constants";
import { Mail, Phone, MapPin, Heart, Facebook, Instagram } from "lucide-react";
import api from "@/lib/api";

function TikTokIcon({ size = 15, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M16.5 3c.3 2.1 1.5 3.6 3.5 3.8v2.4c-1.2.1-2.3-.2-3.5-.8v5.9c0 3.3-2.4 5.7-5.6 5.7-3 0-5.4-2.3-5.4-5.3 0-3.1 2.6-5.4 6-5v2.5c-.4-.1-.8-.2-1.2-.2-1.5 0-2.5 1-2.5 2.5s1.1 2.6 2.5 2.6c1.5 0 2.6-1.1 2.6-2.9V3h3.1z" />
    </svg>
  );
}

export function Footer() {
  const [s, setS] = useState({});
  useEffect(() => {
    api.get("/settings").then((r) => setS(r.data || {})).catch(() => {});
  }, []);

  const email = s.contact_email || "hello@myhealthcarelink.com";
  const phone = s.contact_phone || "+1 (246) 000-0000";
  const socials = [
    { url: s.facebook_url, icon: Facebook, label: "Facebook", testid: "footer-facebook" },
    { url: s.instagram_url, icon: Instagram, label: "Instagram", testid: "footer-instagram" },
    { url: s.tiktok_url, icon: TikTokIcon, label: "TikTok", testid: "footer-tiktok" },
  ].filter((x) => x.url);

  return (
    <footer className="hl-navy-gradient text-slate-300 mt-20" data-testid="main-footer">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          <div className="md:col-span-1">
            <Logo dark />
            <p className="mt-4 text-sm text-slate-400 leading-relaxed">
              {s.about_text || "Connecting Caribbean communities with trusted healthcare providers, services and information."}
            </p>
            {socials.length > 0 && (
              <div className="mt-5 flex items-center gap-3" data-testid="footer-socials">
                {socials.map((soc) => (
                  <a key={soc.label} href={soc.url} target="_blank" rel="noopener noreferrer" data-testid={soc.testid} aria-label={soc.label}
                    className="w-9 h-9 rounded-full bg-white/10 hover:bg-[#D4AF37] hover:text-[#0B132B] text-slate-200 flex items-center justify-center transition-colors">
                    <soc.icon size={16} />
                  </a>
                ))}
              </div>
            )}
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
            <h4 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Countries</h4>
            <ul className="space-y-2 text-sm grid grid-cols-1">
              {COUNTRY_NAMES.slice(0, 6).map((i) => (
                <li key={i} className="text-slate-400">{i}</li>
              ))}
              <li className="text-[#E89D93]">+ {COUNTRY_NAMES.length - 6} more countries</li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Contact</h4>
            <ul className="space-y-3 text-sm">
              <li className="flex items-center gap-2"><Mail size={15} className="text-[#D4AF37] shrink-0" /> <a href={`mailto:${email}`} className="hover:text-[#D4AF37] transition-colors break-all">{email}</a></li>
              <li className="flex items-center gap-2"><Phone size={15} className="text-[#D4AF37] shrink-0" /> <a href={`tel:${phone}`} className="hover:text-[#D4AF37] transition-colors">{phone}</a></li>
              {s.contact_address && <li className="flex items-start gap-2"><MapPin size={15} className="text-[#D4AF37] shrink-0 mt-0.5" /> <span className="text-slate-400">{s.contact_address}</span></li>}
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
          <p>(c) {new Date().getFullYear()} {s.site_title || "My Healthcare Link"} - Horizon Health. All rights reserved.</p>
          <p className="flex items-center gap-1.5">Built with <Heart size={12} className="text-[#E89D93]" fill="#E89D93" /> for the Caribbean</p>
        </div>
      </div>
    </footer>
  );
}
