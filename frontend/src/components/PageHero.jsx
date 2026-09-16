import React from "react";
import { MapPin } from "lucide-react";

export function PageHero({ title, subtitle, testid, note }) {
  return (
    <section className="hl-navy-gradient py-12" data-testid={testid}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-white">{title}</h1>
        {subtitle && <p className="text-slate-300 mt-2 max-w-2xl">{subtitle}</p>}
        {note && (
          <span className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full hl-glass text-sm font-medium text-[#D4AF37]" data-testid="hero-location-note">
            <MapPin size={14} /> Showing: {note}
          </span>
        )}
      </div>
    </section>
  );
}
