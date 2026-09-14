import React from "react";

export function PageHero({ title, subtitle, testid }) {
  return (
    <section className="hl-navy-gradient py-12" data-testid={testid}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-white">{title}</h1>
        {subtitle && <p className="text-slate-300 mt-2 max-w-2xl">{subtitle}</p>}
      </div>
    </section>
  );
}
