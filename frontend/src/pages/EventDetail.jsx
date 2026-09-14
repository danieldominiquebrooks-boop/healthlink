import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Calendar, Clock, MapPin, User, Ticket, ExternalLink } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";

const FALLBACK = "https://images.unsplash.com/photo-1603478804503-dc909c7f5ce5?w=1200&q=80";

export default function EventDetail() {
  const { id } = useParams();
  const [ev, setEv] = useState(null);

  useEffect(() => {
    api.get(`/events/${id}`).then((r) => setEv(r.data)).catch(() => setEv(false));
  }, [id]);

  if (ev === false) return <Layout><div className="py-24 text-center text-muted-foreground">Event not found. <Link to="/events" className="text-[#E89D93] font-semibold">Back to events</Link></div></Layout>;
  if (!ev) return <Layout><div className="py-40 text-center text-muted-foreground">Loading...</div></Layout>;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Link to="/events" className="inline-flex items-center gap-1.5 text-[#E89D93] hover:text-[#d47f74] text-sm mb-6"><ArrowLeft size={16} /> Back to events</Link>
        <img src={ev.image_url || FALLBACK} alt={ev.name} className="w-full h-64 sm:h-80 object-cover rounded-2xl" onError={(e) => { e.currentTarget.src = FALLBACK; }} />
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6 mt-8">
          <div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#0F172A]">{ev.name}</h1>
            <p className="mt-5 text-[#334155] leading-relaxed whitespace-pre-wrap">{ev.description}</p>
            {ev.external_links?.filter(Boolean).length > 0 && (
              <div className="mt-6">
                <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Related Links</h4>
                <div className="space-y-1.5">
                  {ev.external_links.filter(Boolean).map((l, i) => (
                    <a key={i} href={l} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-[#E89D93] hover:underline text-sm break-all"><ExternalLink size={13} /> {l}</a>
                  ))}
                </div>
              </div>
            )}
          </div>
          <aside className="hl-card p-5 h-fit space-y-3.5 text-sm">
            {ev.date && <Detail icon={Calendar} label="Date" value={ev.date} />}
            {ev.time && <Detail icon={Clock} label="Time" value={ev.time} />}
            {(ev.location || ev.island) && <Detail icon={MapPin} label="Location" value={`${ev.location || ""}${ev.island ? (ev.location ? ", " : "") + ev.island : ""}`} />}
            {ev.organizer && <Detail icon={User} label="Organizer" value={ev.organizer} />}
            {ev.registration_info && <Detail icon={Ticket} label="Registration" value={ev.registration_info} />}
            {ev.registration_url && (
              <a href={ev.registration_url} target="_blank" rel="noreferrer">
                <Button className="w-full bg-[#E89D93] hover:bg-[#e08b80] text-white mt-2" data-testid="event-register-btn">Register now</Button>
              </a>
            )}
          </aside>
        </div>
      </div>
    </Layout>
  );
}

function Detail({ icon: Icon, label, value }) {
  return (
    <div className="flex gap-2.5">
      <Icon size={16} className="text-[#E89D93] shrink-0 mt-0.5" />
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-[#0F172A] font-medium">{value}</p>
      </div>
    </div>
  );
}
