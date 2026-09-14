import React from "react";
import { Link } from "react-router-dom";
import { MapPin, BadgeCheck, ShieldCheck } from "lucide-react";
import { StarRating } from "@/components/StarRating";

const FALLBACK = "https://images.unsplash.com/photo-1631217868264-e5b90bb7e133?crop=entropy&cs=srgb&fm=jpg&q=85&w=400";

export function ProviderCard({ provider, index = 0 }) {
  return (
    <Link
      to={`/provider/${provider.id}`}
      data-testid={`provider-card-${index}`}
      className="hl-card overflow-hidden group flex flex-col"
    >
      <div className="relative h-44 overflow-hidden bg-slate-100">
        <img
          src={provider.image_url || FALLBACK}
          alt={provider.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          onError={(e) => { e.currentTarget.src = FALLBACK; }}
        />
        <div className="absolute top-3 left-3 flex gap-1.5">
          {provider.in_network && (
            <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/90 text-white text-[10px] font-semibold backdrop-blur-sm">
              <ShieldCheck size={11} /> In-Network
            </span>
          )}
        </div>
        {provider.island && (
          <span className="absolute bottom-3 left-3 flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#0B132B]/80 text-[#E89D93] text-[10px] font-semibold backdrop-blur-sm">
            <MapPin size={10} /> {provider.island}
          </span>
        )}
      </div>
      <div className="p-4 flex flex-col flex-1">
        <div className="flex items-start gap-1.5">
          <h3 className="font-display font-bold text-[#0F172A] leading-tight text-base">{provider.name}</h3>
          {provider.verified && <BadgeCheck size={16} className="text-[#D4AF37] shrink-0 mt-0.5" />}
        </div>
        <p className="text-sm text-[#E89D93] font-semibold mt-0.5">{provider.specialty}</p>
        {provider.category && (
          <span className="mt-2 self-start px-2.5 py-0.5 rounded-full bg-[#FDF7E7] text-[#B8912B] text-[11px] font-semibold border border-[#D4AF37]/20">
            {provider.category}
          </span>
        )}
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
          {provider.review_count > 0 ? (
            <StarRating value={provider.rating} showValue count={provider.review_count} size={14} />
          ) : (
            <span className="text-xs text-muted-foreground">No reviews yet</span>
          )}
        </div>
      </div>
    </Link>
  );
}
