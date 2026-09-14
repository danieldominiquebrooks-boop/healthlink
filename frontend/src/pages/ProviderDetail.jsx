import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  MapPin, Phone, Mail, Globe, BadgeCheck, ShieldCheck, ArrowLeft,
  CalendarPlus, MessageSquarePlus, UserCheck, Heart,
} from "lucide-react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StarRating } from "@/components/StarRating";
import { ReviewModal } from "@/components/ReviewModal";
import { useSaved } from "@/context/SavedContext";
import api from "@/lib/api";

const FALLBACK = "https://images.unsplash.com/photo-1622253692010-333f2da6031d?crop=entropy&cs=srgb&fm=jpg&q=85&w=800";

export default function ProviderDetail() {
  const { id } = useParams();
  const [provider, setProvider] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const { isSaved, toggle } = useSaved();

  const loadReviews = () => api.get("/reviews", { params: { provider_id: id } }).then((r) => setReviews(r.data)).catch(() => {});

  useEffect(() => {
    api.get(`/providers/${id}`).then((r) => setProvider(r.data)).catch(() => setProvider(false));
    loadReviews();
  }, [id]);

  if (provider === false) return <Layout><div className="max-w-3xl mx-auto px-4 py-24 text-center text-muted-foreground">Provider not found. <Link to="/directory" className="text-[#E89D93] font-semibold">Back to directory</Link></div></Layout>;
  if (!provider) return <Layout><div className="py-40 text-center text-muted-foreground">Loading...</div></Layout>;

  return (
    <Layout>
      {/* HEADER */}
      <section className="hl-navy-gradient pt-8 pb-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link to="/directory" className="inline-flex items-center gap-1.5 text-slate-300 hover:text-white text-sm mb-6" data-testid="back-to-directory">
            <ArrowLeft size={16} /> Back to directory
          </Link>
          <div className="flex flex-col sm:flex-row gap-6 items-start">
            <img src={provider.image_url || FALLBACK} alt={provider.name} className="w-28 h-28 rounded-2xl object-cover border-2 border-[#D4AF37]/40 shrink-0" onError={(e) => { e.currentTarget.src = FALLBACK; }} />
            <div className="flex-1">
              {provider.in_network && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/90 text-white text-xs font-semibold mb-2">
                  <ShieldCheck size={12} /> In-Network Provider
                </span>
              )}
              <h1 className="font-display text-3xl sm:text-4xl font-bold text-white flex items-center gap-2">
                {provider.name}
                {provider.verified && <BadgeCheck size={24} className="text-[#D4AF37]" />}
              </h1>
              <p className="text-[#E89D93] font-semibold text-lg mt-1">{provider.specialty}</p>
              <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-slate-300">
                {provider.review_count > 0 && <StarRating value={provider.rating} showValue count={provider.review_count} />}
                {provider.island && <span className="flex items-center gap-1"><MapPin size={14} className="text-[#D4AF37]" /> {provider.island}</span>}
                {provider.accepting_new_patients && <span className="flex items-center gap-1"><UserCheck size={14} className="text-emerald-400" /> Accepting new patients</span>}
              </div>
            </div>
            <button
              onClick={() => toggle(provider.id)}
              data-testid="save-provider-detail"
              className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl hl-glass text-white text-sm font-medium hover:border-[#D4AF37]/60 transition-colors"
            >
              <Heart size={16} className={isSaved(provider.id) ? "text-[#E89D93]" : "text-slate-300"} fill={isSaved(provider.id) ? "#E89D93" : "none"} />
              {isSaved(provider.id) ? "Saved" : "Save"}
            </button>
          </div>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 -mt-14 relative z-10 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
          {/* MAIN */}
          <div className="hl-card p-6">
            <Tabs defaultValue="overview">
              <TabsList className="mb-5">
                <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
                <TabsTrigger value="services" data-testid="tab-services">Services</TabsTrigger>
                <TabsTrigger value="reviews" data-testid="tab-reviews">Reviews ({reviews.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="overview">
                <h3 className="font-display font-bold text-[#0F172A] mb-2">About</h3>
                <p className="text-muted-foreground leading-relaxed">{provider.description || "No description provided."}</p>
                {provider.niches?.length > 0 && (
                  <div className="mt-5">
                    <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Niches & Focus</h4>
                    <div className="flex flex-wrap gap-2">
                      {provider.niches.map((n) => <span key={n} className="px-3 py-1 rounded-full bg-[#FDF0EE] text-[#d47f74] text-sm font-medium">{n}</span>)}
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="services">
                {provider.services?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {provider.services.map((s) => <span key={s} className="px-3 py-1.5 rounded-lg bg-[#FDF7E7] text-[#B8912B] text-sm font-medium border border-[#D4AF37]/20">{s}</span>)}
                  </div>
                ) : <p className="text-muted-foreground">No services listed.</p>}
              </TabsContent>

              <TabsContent value="reviews">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display font-bold text-[#0F172A]">Patient Reviews</h3>
                  <Button size="sm" onClick={() => setModalOpen(true)} data-testid="write-review-btn" className="bg-[#E89D93] hover:bg-[#e08b80] text-white">
                    <MessageSquarePlus size={15} className="mr-1.5" /> Write a review
                  </Button>
                </div>
                {reviews.length ? (
                  <div className="space-y-4">
                    {reviews.map((r) => (
                      <div key={r.id} className="border-b border-slate-100 pb-4 last:border-0">
                        <div className="flex items-center justify-between">
                          <StarRating value={r.rating} size={14} />
                          {r.verified_patient && <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1"><UserCheck size={12} /> Verified patient</span>}
                        </div>
                        {r.title && <h4 className="font-semibold text-[#0F172A] mt-2">{r.title}</h4>}
                        <p className="text-sm text-muted-foreground mt-1">{r.comment}</p>
                        <p className="text-xs text-muted-foreground mt-2">— {r.author_name}</p>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-muted-foreground">No reviews yet. Be the first to share your experience.</p>}
              </TabsContent>
            </Tabs>
          </div>

          {/* SIDEBAR */}
          <div className="space-y-4">
            <div className="hl-card p-5">
              <h3 className="font-display font-bold text-[#0F172A] mb-3">Contact & Location</h3>
              <ul className="space-y-3 text-sm">
                {provider.address && <li className="flex gap-2.5"><MapPin size={16} className="text-[#E89D93] shrink-0 mt-0.5" /><span>{provider.address}</span></li>}
                {provider.phone && <li className="flex gap-2.5"><Phone size={16} className="text-[#E89D93] shrink-0 mt-0.5" /><a href={`tel:${provider.phone}`} className="hover:text-[#E89D93]">{provider.phone}</a></li>}
                {provider.email && <li className="flex gap-2.5"><Mail size={16} className="text-[#E89D93] shrink-0 mt-0.5" /><a href={`mailto:${provider.email}`} className="hover:text-[#E89D93] break-all">{provider.email}</a></li>}
                {provider.website && <li className="flex gap-2.5"><Globe size={16} className="text-[#E89D93] shrink-0 mt-0.5" /><a href={provider.website} target="_blank" rel="noreferrer" className="hover:text-[#E89D93] break-all">Website</a></li>}
              </ul>
              {provider.phone && (
                <a href={`tel:${provider.phone}`}>
                  <Button className="w-full mt-4 bg-[#0B132B] hover:bg-[#1C2541] text-white" data-testid="call-office-btn">
                    <Phone size={15} className="mr-1.5" /> Call office
                  </Button>
                </a>
              )}
              <Button onClick={() => setModalOpen(true)} variant="outline" className="w-full mt-2 border-[#E89D93] text-[#d47f74] hover:bg-[#FDF0EE]" data-testid="sidebar-review-btn">
                <CalendarPlus size={15} className="mr-1.5" /> Leave a review
              </Button>
            </div>
          </div>
        </div>
      </div>

      <ReviewModal open={modalOpen} onOpenChange={(v) => { setModalOpen(v); if (!v) loadReviews(); }} provider={provider} />
    </Layout>
  );
}
