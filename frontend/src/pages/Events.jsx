import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Calendar, MapPin, User } from "lucide-react";
import { Layout } from "@/components/Layout";
import { PageHero } from "@/components/PageHero";
import { NewsletterModal } from "@/components/NewsletterModal";
import api from "@/lib/api";
import { useLocation } from "@/context/LocationContext";

const FALLBACK = "https://images.unsplash.com/photo-1603478804503-dc909c7f5ce5?w=800&q=80";

export default function Events() {
  const { country, region } = useLocation();
  const [events, setEvents] = useState([]);

  useEffect(() => {
    const p = {};
    if (country && country !== "All Countries") p.country = country;
    if (region && region !== "All Parishes/Islands") p.region = region;
    api.get("/events", { params: p }).then((r) => setEvents(r.data)).catch(() => setEvents([]));
  }, [country, region]);

  return (
    <Layout>
      <NewsletterModal context="events" />
      <PageHero title="Healthcare Events" subtitle="Health fairs, workshops, screenings and community events across the Caribbean." testid="events-hero" note={country !== "All Countries" ? (region !== "All Parishes/Islands" ? `${region}, ${country}` : country) : null} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {events.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((ev, i) => (
              <Link key={ev.id} to={`/events/${ev.id}`} data-testid={`event-card-${i}`} className="hl-card overflow-hidden group">
                <div className="h-44 bg-slate-100 overflow-hidden relative">
                  <img src={ev.image_url || FALLBACK} alt={ev.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" onError={(e) => { e.currentTarget.src = FALLBACK; }} />
                  <span className="absolute top-3 left-3 px-3 py-1.5 rounded-lg bg-[#0B132B]/85 text-[#D4AF37] text-xs font-bold backdrop-blur-sm flex items-center gap-1.5"><Calendar size={12} /> {ev.date}</span>
                </div>
                <div className="p-5">
                  <h3 className="font-display font-bold text-[#0F172A] leading-snug">{ev.name}</h3>
                  <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {ev.location && <p className="flex items-center gap-1.5"><MapPin size={13} className="text-[#E89D93]" /> {ev.location}{ev.country ? `, ${ev.country}` : ""}</p>}
                    {!ev.region && ev.country && <p className="flex items-center gap-1.5 text-[#B8912B] font-semibold" data-testid={`event-countrywide-${i}`}><MapPin size={13} className="text-[#B8912B]" /> Country-wide · {ev.country}</p>}
                    {ev.organizer && <p className="flex items-center gap-1.5"><User size={13} className="text-[#E89D93]" /> {ev.organizer}</p>}
                  </div>
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{ev.description}</p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border-2 border-dashed border-[#E89D93]/25 py-20 text-center">
            <Calendar size={30} className="mx-auto text-[#E89D93]/60" />
            <p className="mt-3 text-muted-foreground">No events scheduled yet.</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
