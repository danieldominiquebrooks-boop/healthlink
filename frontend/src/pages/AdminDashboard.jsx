import React, { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users, Activity, Tags, BookOpen, Calendar, MessageSquare, Settings as SettingsIcon,
  Plus, Pencil, Trash2, LogOut, Check, X, Eye, ExternalLink, ShieldCheck,
  Upload, Download, Image as ImageIcon, Star, BarChart3, Mail, Megaphone, ClipboardList, Search as SearchIcon,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { StarRating } from "@/components/StarRating";
import { RichTextEditor } from "@/components/RichTextEditor";
import { HoursEditor } from "@/components/HoursEditor";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import { COUNTRY_NAMES, regionsFor } from "@/lib/constants";
import api, { formatApiError } from "@/lib/api";
import { toast } from "sonner";

const PROVIDER_TEMPLATE = `name,specialty,category,country,region,description,phone,email,website,address,niches,services,featured,verified,accepting_new_patients,image_url
Dr. Jane Doe,Cardiology,Doctors,Barbados,Christ Church,Experienced cardiologist serving the community,+1246555000,jane@example.com,https://example.com,Bridgetown,Heart Health;Preventive Care,Consultation;ECG;Stress Test,true,true,true,
Sunrise Wellness Clinic,General Practice,Clinics,Jamaica,Kingston,Full-service family clinic,+1876555111,info@sunrise.com,,Kingston,Family Medicine;Pediatrics,General Consultation;Vaccinations,false,true,true,
`;

// Field schemas per entity
const SCHEMAS = {
  providers: [
    { key: "name", label: "Name", req: true },
    { key: "specialty", label: "Specialty" },
    { key: "category", label: "Category", type: "category-select" },
    { key: "country", label: "Country", type: "country" },
    { key: "region", label: "Parish / Island", type: "region" },
    { key: "image_url", label: "Image", type: "image", full: true },
    { key: "description", label: "Description", type: "textarea", full: true },
    { key: "niches", label: "Niches (comma separated)", type: "list", full: true },
    { key: "services", label: "Services (comma separated)", type: "list", full: true },
    { key: "phone", label: "Phone" },
    { key: "email", label: "Email" },
    { key: "website", label: "Website", full: true },
    { key: "address", label: "Address", full: true },
    { key: "latitude", label: "Latitude (optional · for map)", type: "number" },
    { key: "longitude", label: "Longitude (optional · for map)", type: "number" },
    { key: "hours", label: "Opening hours", type: "hours", full: true },
    { key: "accepting_new_patients", label: "Accepting new patients", type: "switch" },
    { key: "verified", label: "Verified", type: "switch" },
    { key: "featured", label: "Featured on homepage", type: "switch" },
    { key: "active", label: "Active (visible)", type: "switch" },
  ],
  services: [
    { key: "name", label: "Name", req: true },
    { key: "category", label: "Category" },
    { key: "country", label: "Country", type: "country" },
    { key: "region", label: "Parish / Island", type: "region" },
    { key: "icon", label: "Icon", type: "select", options: ["activity", "heart", "stethoscope", "microscope", "video"] },
    { key: "description", label: "Description", type: "textarea", full: true },
    { key: "active", label: "Active", type: "switch" },
  ],
  categories: [
    { key: "name", label: "Category name", req: true },
    { key: "type", label: "Used for", type: "select", options: ["category", "article"], optionLabels: { category: "Providers", article: "Articles / Blog" } },
  ],
  articles: [
    { key: "title", label: "Title", req: true, full: true },
    { key: "category", label: "Category", type: "article-category" },
    { key: "country", label: "Country", type: "country" },
    { key: "region", label: "Parish / Island", type: "region" },
    { key: "author", label: "Author" },
    { key: "image_url", label: "Image", type: "image", full: true },
    { key: "excerpt", label: "Excerpt", type: "textarea", full: true },
    { key: "content", label: "Content", type: "richtext", full: true },
    { key: "featured", label: "Featured (pin to top of blog)", type: "switch" },
    { key: "published", label: "Published", type: "switch" },
  ],
  events: [
    { key: "name", label: "Name", req: true, full: true },
    { key: "date", label: "Date (e.g. Apr 18, 2026)" },
    { key: "time", label: "Time (e.g. 9:00 AM - 4:00 PM)" },
    { key: "location", label: "Location" },
    { key: "country", label: "Country", type: "country" },
    { key: "region", label: "Parish / Island", type: "region" },
    { key: "organizer", label: "Organizer" },
    { key: "image_url", label: "Image", type: "image", full: true },
    { key: "description", label: "Description", type: "textarea", full: true },
    { key: "registration_info", label: "Registration info" },
    { key: "registration_url", label: "Registration URL" },
    { key: "external_links", label: "External links (comma separated)", type: "list", full: true },
    { key: "published", label: "Published", type: "switch" },
  ],
};

const DEFAULTS = {
  providers: { accepting_new_patients: true, verified: false, featured: false, active: true, niches: [], services: [] },
  services: { active: true, icon: "activity" },
  categories: { type: "category" },
  articles: { published: true, author: "My Healthcare Link" },
  events: { published: true, external_links: [] },
};

const TABS = [
  { key: "providers", label: "Providers", icon: Users },
  { key: "categories", label: "Categories", icon: Tags },
  { key: "articles", label: "Articles", icon: BookOpen },
  { key: "events", label: "Events", icon: Calendar },
  { key: "reviews", label: "Reviews", icon: MessageSquare },
  { key: "subscribers", label: "Subscribers", icon: Mail },
  { key: "quizzes", label: "Quizzes", icon: ClipboardList },
  { key: "campaigns", label: "Campaigns", icon: Megaphone },
  { key: "analytics", label: "Analytics", icon: BarChart3 },
  { key: "searches", label: "Search Gaps", icon: SearchIcon },
  { key: "settings", label: "Settings", icon: SettingsIcon },
];

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("providers");

  const doLogout = () => { logout(); navigate("/admin"); };

  return (
    <div className="min-h-screen bg-[#FAF7F2]">
      {/* Top bar */}
      <header className="bg-[#0B132B] border-b border-[#D4AF37]/25 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <Logo dark />
          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-sm text-slate-300">{user?.email}</span>
            <Button variant="outline" size="sm" onClick={() => navigate("/")} className="border-white/20 text-slate-800">
              <Eye size={15} className="mr-1.5" /> View site
            </Button>
            <Button size="sm" onClick={doLogout} data-testid="admin-logout-btn" className="bg-[#E89D93] hover:bg-[#e08b80] text-white">
              <LogOut size={15} className="mr-1.5" /> Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">
        {/* Sidebar */}
        <aside className="lg:sticky lg:top-24 h-fit">
          <nav className="flex lg:flex-col gap-1 overflow-x-auto hl-scrollbar-hide">
            {TABS.map((t) => (
              <button
                key={t.key}
                data-testid={`admin-tab-${t.key}`}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
                  tab === t.key ? "bg-[#0B132B] text-white" : "text-[#0F172A] hover:bg-white"
                }`}
              >
                <t.icon size={17} className={tab === t.key ? "text-[#D4AF37]" : "text-[#E89D93]"} /> {t.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <div>
          {tab === "reviews" ? <ReviewsManager />
            : tab === "settings" ? <SettingsManager />
            : tab === "subscribers" ? <SubscribersManager />
            : tab === "quizzes" ? <QuizzesManager />
            : tab === "campaigns" ? <CampaignsManager />
            : tab === "analytics" ? <AnalyticsManager />
            : tab === "searches" ? <SearchGapsManager />
            : <EntityManager key={tab} entity={tab} />}
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Generic entity CRUD manager
// -----------------------------------------------------------------------------
const pct = (n, d) => (d > 0 ? Math.round((n / d) * 100) : 0);

function CampaignInline({ s }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs" data-testid="campaign-inline">
      <span className="text-[#B8912B] font-semibold">Email</span>
      <span className="text-muted-foreground">
        {s.email_sent} sent · {s.email_opened} opened ({pct(s.email_opened, s.email_sent)}%) · {s.email_clicked} clicked ({pct(s.email_clicked, s.email_sent)}%)
      </span>
      {s.push_sent > 0 && (
        <>
          <span className="text-[#E89D93] font-semibold">Push</span>
          <span className="text-muted-foreground">
            {s.push_sent} sent · {s.push_clicked} clicked ({pct(s.push_clicked, s.push_sent)}%)
          </span>
        </>
      )}
    </div>
  );
}

function CampaignsManager() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pushCount, setPushCount] = useState(null);

  useEffect(() => {
    Promise.all([api.get("/admin/campaigns"), api.get("/admin/push/count")])
      .then(([c, p]) => { setRows(c.data || []); setPushCount(p.data?.count ?? 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const totals = rows.reduce((a, c) => ({
    email_sent: a.email_sent + (c.email_sent || 0),
    email_opened: a.email_opened + (c.email_opened || 0),
    email_clicked: a.email_clicked + (c.email_clicked || 0),
    push_sent: a.push_sent + (c.push_sent || 0),
    push_clicked: a.push_clicked + (c.push_clicked || 0),
  }), { email_sent: 0, email_opened: 0, email_clicked: 0, push_sent: 0, push_clicked: 0 });

  const Stat = ({ label, value, sub }) => (
    <div className="bg-white rounded-2xl border border-[#E89D93]/15 px-5 py-4" data-testid={`campaign-stat-${label.toLowerCase().replace(/\s/g, "-")}`}>
      <p className="text-xs uppercase tracking-widest text-[#B8912B] font-semibold">{label}</p>
      <p className="text-2xl font-bold text-[#0F172A] mt-1 tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );

  return (
    <div data-testid="campaigns-manager">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h2 className="font-display text-2xl font-bold text-[#0F172A]">Campaign analytics</h2>
          <p className="text-sm text-muted-foreground">Email opens & clicks and push delivery for every article and event announcement.</p>
        </div>
        <span className="text-sm text-[#0F172A] bg-white border border-[#E89D93]/20 rounded-xl px-4 py-2" data-testid="push-subscriber-count">
          <Megaphone size={14} className="inline mr-1.5 text-[#E89D93]" />
          {pushCount == null ? "…" : pushCount} device{pushCount === 1 ? "" : "s"} subscribed to push
        </span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <Stat label="Emails sent" value={totals.email_sent} />
        <Stat label="Opened" value={totals.email_opened} sub={`${pct(totals.email_opened, totals.email_sent)}% open rate`} />
        <Stat label="Email clicks" value={totals.email_clicked} sub={`${pct(totals.email_clicked, totals.email_sent)}% click rate`} />
        <Stat label="Push sent" value={totals.push_sent} />
        <Stat label="Push clicks" value={totals.push_clicked} sub={`${pct(totals.push_clicked, totals.push_sent)}% click rate`} />
      </div>

      {loading ? (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E89D93]/15 px-4 py-12 text-center" data-testid="no-campaigns">
          <Megaphone size={28} className="mx-auto text-[#E89D93] mb-2" />
          <p className="text-sm text-muted-foreground">No campaigns yet. Publish an article or event, or hit the megaphone on one, to send your first announcement.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#E89D93]/15 overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-slate-100">
                <th className="px-4 py-3 font-semibold">Announcement</th>
                <th className="px-4 py-3 font-semibold">Sent</th>
                <th className="px-4 py-3 font-semibold">Email opened</th>
                <th className="px-4 py-3 font-semibold">Email clicked</th>
                <th className="px-4 py-3 font-semibold">Push sent</th>
                <th className="px-4 py-3 font-semibold">Push clicked</th>
                <th className="px-4 py-3 font-semibold">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((c, i) => (
                <tr key={c.id} data-testid={`campaign-row-${i}`} className="hover:bg-[#FAF7F2]">
                  <td className="px-4 py-3">
                    <span className="font-semibold text-[#0F172A]">{c.title || "(untitled)"}</span>
                    <span className="ml-2 text-xs text-[#B8912B] uppercase tracking-wide">{c.kind}</span>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{c.email_sent}</td>
                  <td className="px-4 py-3 tabular-nums">{c.email_opened} <span className="text-muted-foreground">({pct(c.email_opened, c.email_sent)}%)</span></td>
                  <td className="px-4 py-3 tabular-nums">{c.email_clicked} <span className="text-muted-foreground">({pct(c.email_clicked, c.email_sent)}%)</span></td>
                  <td className="px-4 py-3 tabular-nums">{c.push_sent}</td>
                  <td className="px-4 py-3 tabular-nums">{c.push_clicked} <span className="text-muted-foreground">({pct(c.push_clicked, c.push_sent)}%)</span></td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{c.created_at ? new Date(c.created_at).toLocaleDateString() : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function EntityManager({ entity }) {
  const schema = SCHEMAS[entity];
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [selected, setSelected] = useState([]);
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [fltCountry, setFltCountry] = useState("all");
  const [fltRegion, setFltRegion] = useState("all");
  const [fltCategory, setFltCategory] = useState("all");
  const [catOptions, setCatOptions] = useState([]);
  const [notifyItem, setNotifyItem] = useState(null);
  const [campStats, setCampStats] = useState({});

  const load = useCallback(() => {
    setLoading(true);
    setSelected([]);
    api.get(`/admin/${entity}`).then((r) => setItems(r.data)).catch(() => setItems([])).finally(() => setLoading(false));
  }, [entity]);

  const toggleSelect = (id) => setSelected((cur) => cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
  const toggleSelectAll = () => setSelected((cur) => cur.length === items.length ? [] : items.map((it) => it.id));

  const bulkDelete = async () => {
    try {
      const { data } = await api.post("/admin/providers/bulk-delete", { ids: selected });
      toast.success(`Deleted ${data.deleted} provider(s)`);
      setBulkConfirm(false);
      load();
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    }
  };

  const syncCategories = null;

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (entity === "providers") api.get("/categories").then((r) => setCatOptions(r.data.map((c) => c.name))).catch(() => {});
  }, [entity]);

  useEffect(() => {
    if (entity !== "articles" && entity !== "events") return;
    api.get("/admin/campaigns").then((r) => {
      const map = {};
      for (const c of r.data) {
        const m = map[c.ref_id] || (map[c.ref_id] = { email_sent: 0, email_opened: 0, email_clicked: 0, push_sent: 0, push_clicked: 0 });
        m.email_sent += c.email_sent || 0; m.email_opened += c.email_opened || 0; m.email_clicked += c.email_clicked || 0;
        m.push_sent += c.push_sent || 0; m.push_clicked += c.push_clicked || 0;
      }
      setCampStats(map);
    }).catch(() => {});
  }, [entity, items]);

  const openNew = () => {
    setEditing(null);
    setForm({ ...DEFAULTS[entity] });
    setDialogOpen(true);
  };
  const openEdit = (item) => {
    setEditing(item);
    setForm({ ...item });
    setDialogOpen(true);
  };

  const setField = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const save = async () => {
    const missing = schema.filter((s) => s.req && !String(form[s.key] || "").trim());
    if (missing.length) return toast.error(`${missing[0].label} is required.`);
    setSaving(true);
    // build payload
    const payload = {};
    schema.forEach((s) => {
      let v = form[s.key];
      if (s.type === "list") {
        v = Array.isArray(v) ? v : String(v || "").split(",").map((x) => x.trim()).filter(Boolean);
      } else if (s.type === "switch") {
        v = !!v;
      } else if (s.type === "number") {
        v = (v === "" || v === null || v === undefined) ? null : Number(v);
      } else if (s.type === "hours") {
        v = v && typeof v === "object" && Object.keys(v).length ? v : null;
      } else {
        v = v ?? "";
      }
      payload[s.key] = v;
    });
    try {
      if (editing) await api.put(`/admin/${entity}/${editing.id}`, payload);
      else await api.post(`/admin/${entity}`, payload);
      toast.success(editing ? "Updated successfully" : "Created successfully");
      setDialogOpen(false);
      load();
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    try {
      await api.delete(`/admin/${entity}/${deleteId}`);
      toast.success("Deleted");
      setDeleteId(null);
      load();
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    }
  };

  const toggleFeatured = async (item) => {
    try {
      await api.put(`/admin/providers/${item.id}`, { ...item, featured: !item.featured });
      toast.success(item.featured ? "Removed from featured" : "Added to featured");
      load();
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    }
  };

  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const downloadTemplate = () => {
    const blob = new Blob([PROVIDER_TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "providers_template.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const runImport = async () => {
    if (!importFile) return toast.error("Choose a CSV file first.");
    setImporting(true);
    const fd = new FormData();
    fd.append("file", importFile);
    try {
      const { data } = await api.post("/admin/providers/bulk", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setImportResult(data);
      toast.success(`Imported ${data.created} provider(s).`);
      load();
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    } finally { setImporting(false); }
  };

  const titleKey = entity === "articles" ? "title" : "name";

  const filtered = entity === "providers" ? items.filter((it) => {
    if (fltCountry !== "all" && it.country !== fltCountry) return false;
    if (fltRegion !== "all" && it.region !== fltRegion) return false;
    if (fltCategory !== "all" && it.category !== fltCategory) return false;
    return true;
  }) : items;

  const notify = async () => {
    try {
      const { data } = await api.post(`/admin/${entity}/${notifyItem.id}/notify`);
      toast.success(data.queued ? `Notifying ${data.queued} subscriber(s).` : "No active subscribers to notify yet.");
      setNotifyItem(null);
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="font-display text-2xl font-bold text-[#0F172A] capitalize">{entity}</h2>
          <p className="text-sm text-muted-foreground">{items.length} total</p>
        </div>
        <div className="flex items-center gap-2">
          {entity === "providers" && selected.length > 0 && (
            <Button variant="outline" onClick={() => setBulkConfirm(true)} data-testid="bulk-delete-btn" className="border-red-300 text-red-600 hover:bg-red-50">
              <Trash2 size={16} className="mr-1.5" /> Delete selected ({selected.length})
            </Button>
          )}
          {entity === "providers" && (
            <Button variant="outline" onClick={() => { setImportResult(null); setImportFile(null); setImportOpen(true); }} data-testid="import-csv-btn" className="border-[#D4AF37]/50 text-[#B8912B] hover:bg-[#FDF7E7]">
              <Upload size={16} className="mr-1.5" /> Import CSV
            </Button>
          )}
          <Button onClick={openNew} data-testid={`add-${entity}-btn`} className="bg-[#0B132B] hover:bg-[#1C2541] text-white">
            <Plus size={16} className="mr-1.5" /> Add {entity.slice(0, -1)}
          </Button>
        </div>
      </div>

      {entity === "providers" && items.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-4" data-testid="provider-filters">
          <Select value={fltCountry} onValueChange={(v) => { setFltCountry(v); setFltRegion("all"); }}>
            <SelectTrigger className="w-44" data-testid="filter-country"><SelectValue placeholder="Country" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All countries</SelectItem>
              {COUNTRY_NAMES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fltRegion} onValueChange={setFltRegion} disabled={fltCountry === "all"}>
            <SelectTrigger className="w-44" data-testid="filter-region"><SelectValue placeholder="Parish / Island" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All parishes/islands</SelectItem>
              {regionsFor(fltCountry === "all" ? "" : fltCountry).map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fltCategory} onValueChange={setFltCategory}>
            <SelectTrigger className="w-44" data-testid="filter-category"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {catOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          {(fltCountry !== "all" || fltRegion !== "all" || fltCategory !== "all") && (
            <button onClick={() => { setFltCountry("all"); setFltRegion("all"); setFltCategory("all"); }} data-testid="filter-clear" className="text-sm text-[#E89D93] hover:text-[#d47f74] px-2">Clear filters</button>
          )}
          <span className="text-sm text-muted-foreground ml-auto" data-testid="filter-count">{filtered.length} shown</span>
        </div>
      )}

      {loading ? (
        <p className="text-muted-foreground py-10 text-center">Loading...</p>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-[#E89D93]/25 py-16 text-center">
          <Plus size={28} className="mx-auto text-[#E89D93]/60" />
          <p className="mt-3 text-muted-foreground">No {entity} yet. Click "Add" to create the first one.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#E89D93]/15 overflow-hidden">
          {entity === "providers" && (
            <label className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-100 bg-[#FAF7F2] text-sm font-medium text-[#0F172A] cursor-pointer">
              <input type="checkbox" data-testid="select-all-providers" checked={items.length > 0 && selected.length === items.length} onChange={toggleSelectAll} className="w-4 h-4 accent-[#E89D93]" />
              {selected.length > 0 ? `${selected.length} selected` : "Select all"}
            </label>
          )}
          <div className="divide-y divide-slate-100">
            {filtered.length === 0 && <p className="px-4 py-10 text-center text-sm text-muted-foreground" data-testid="no-filter-match">No {entity} match these filters.</p>}
            {filtered.map((item, i) => (
              <div key={item.id} data-testid={`${entity}-row-${i}`} className="flex items-center gap-4 px-4 py-3 hover:bg-[#FAF7F2] transition-colors">
                {entity === "providers" && (
                  <input type="checkbox" data-testid={`select-providers-${i}`} checked={selected.includes(item.id)} onChange={() => toggleSelect(item.id)} className="w-4 h-4 accent-[#E89D93] shrink-0" />
                )}
                {item.image_url && <img src={item.image_url} alt="" className="w-11 h-11 rounded-lg object-cover shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-[#0F172A] truncate">{item[titleKey]}</span>
                    {item.country && <Badge>{item.region ? `${item.region}, ${item.country}` : item.country}</Badge>}
                    {entity === "providers" && item.featured && <Badge color="gold">Featured</Badge>}
                    {(item.active === false || item.published === false) && <Badge color="slate">Hidden</Badge>}
                    {entity === "categories" && item.type === "article" && <Badge>Articles</Badge>}
                    {entity === "categories" && item.type === "article"
                      ? <Badge color="gold">{item.article_count || 0} article{item.article_count === 1 ? "" : "s"}</Badge>
                      : entity === "categories" && <Badge color="gold">{item.provider_count || 0} provider{item.provider_count === 1 ? "" : "s"}</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {item.specialty || item.category || item.excerpt || item.description || item.date || ""}
                  </p>
                  {(entity === "articles" || entity === "events") && campStats[item.id] && (
                    <CampaignInline s={campStats[item.id]} />
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {(entity === "articles" || entity === "events") && (
                    <button onClick={() => setNotifyItem(item)} data-testid={`notify-${entity}-${i}`} title="Notify subscribers" className="p-2 rounded-lg hover:bg-[#FDF7E7] text-[#B8912B]"><Megaphone size={16} /></button>
                  )}
                  {entity === "providers" && (
                    <button onClick={() => toggleFeatured(item)} data-testid={`feature-providers-${i}`} title={item.featured ? "Remove from featured" : "Mark as featured"} className={`p-2 rounded-lg hover:bg-[#FDF7E7] ${item.featured ? "text-[#D4AF37]" : "text-slate-400"}`}>
                    <Star size={16} fill={item.featured ? "#D4AF37" : "none"} /></button>
                  )}
                  <button onClick={() => openEdit(item)} data-testid={`edit-${entity}-${i}`} className="p-2 rounded-lg hover:bg-[#FDF0EE] text-[#0F172A]"><Pencil size={16} /></button>
                  <button onClick={() => setDeleteId(item.id)} data-testid={`delete-${entity}-${i}`} className="p-2 rounded-lg hover:bg-red-50 text-red-500"><Trash2 size={16} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Form dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[88vh] overflow-y-auto" data-testid={`${entity}-form-dialog`}>
          <DialogHeader>
            <DialogTitle className="font-display capitalize">{editing ? "Edit" : "Add"} {entity.slice(0, -1)}</DialogTitle>
            <DialogDescription>Fill in the details below. Fields marked * are required.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            {schema.map((s) => (
              <Field key={s.key} field={s} value={form[s.key]} form={form} onChange={(v) => setField(s.key, v)} />
            ))}
          </div>
          <DialogFooter>
            {entity === "articles" && (
              <Button variant="outline" onClick={() => setPreviewOpen(true)} data-testid="preview-article-btn" className="border-[#D4AF37]/50 text-[#B8912B] hover:bg-[#FDF7E7]">
                <Eye size={15} className="mr-1.5" /> Preview
              </Button>
            )}
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving} data-testid={`save-${entity}-btn`} className="bg-[#0B132B] hover:bg-[#1C2541] text-white">
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[88vh] overflow-y-auto" data-testid="article-preview-dialog">
          <DialogHeader>
            <DialogTitle className="font-display">Article preview</DialogTitle>
            <DialogDescription>This is how your article will look once published{form.published ? "" : " (currently a draft)"}.</DialogDescription>
          </DialogHeader>
          <article className="pt-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold uppercase tracking-widest text-[#D4AF37]">{form.category || "Article"}</span>
              {form.country && <span className="text-xs text-muted-foreground">· {form.region ? `${form.region}, ${form.country}` : form.country}</span>}
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#0F172A] leading-tight">{form.title || "Untitled article"}</h1>
            <p className="text-muted-foreground mt-2 text-sm">By {form.author || "My Healthcare Link"}</p>
            {form.image_url && <img src={form.image_url} alt="" className="w-full h-56 object-cover rounded-2xl mt-4" />}
            {form.excerpt && <p className="text-lg text-[#0F172A] font-medium mt-4 leading-relaxed">{form.excerpt}</p>}
            <div className="hl-prose mt-4 text-[#334155] leading-relaxed" dangerouslySetInnerHTML={{ __html: form.content || "<p style='color:#9aa3b2'>No content yet.</p>" }} />
          </article>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this {entity.slice(0, -1)}?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={remove} data-testid="confirm-delete-btn" className="bg-red-500 hover:bg-red-600">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkConfirm} onOpenChange={setBulkConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selected.length} provider(s)?</AlertDialogTitle>
            <AlertDialogDescription>This permanently removes the selected providers and their reviews. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={bulkDelete} data-testid="confirm-bulk-delete-btn" className="bg-red-500 hover:bg-red-600">Delete {selected.length}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!notifyItem} onOpenChange={(v) => !v && setNotifyItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Notify subscribers?</AlertDialogTitle>
            <AlertDialogDescription>
              This emails all active mailing-list subscribers about "{notifyItem?.[titleKey]}" and pushes a notification to everyone who enabled alerts. Each email includes a one-click unsubscribe link.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={notify} data-testid="confirm-notify-btn" className="bg-[#0B132B] hover:bg-[#1C2541]">Send notification</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-lg" data-testid="import-csv-dialog">
          <DialogHeader>
            <DialogTitle className="font-display">Import providers from CSV</DialogTitle>
            <DialogDescription>Upload a CSV to add many providers at once. Download the template to see the required columns.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Button type="button" variant="outline" onClick={downloadTemplate} data-testid="download-template-btn" className="border-[#D4AF37]/50 text-[#B8912B]">
              <Download size={15} className="mr-1.5" /> Download CSV template
            </Button>
            <div>
              <Label className="mb-1.5 block text-sm">CSV file</Label>
              <input type="file" accept=".csv,text/csv" onChange={(e) => setImportFile(e.target.files?.[0] || null)} data-testid="import-file-input" className="block w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-[#0B132B] file:text-white file:cursor-pointer" />
              <p className="text-xs text-muted-foreground mt-1.5">Lists like niches/services use semicolons (Heart Health;Preventive Care). Booleans: true/false.</p>
            </div>
            {importResult && (
              <div className="rounded-lg bg-[#FAF7F2] p-3 text-sm" data-testid="import-result">
                <p className="font-semibold text-emerald-600">✓ {importResult.created} provider(s) imported.</p>
                {importResult.errors?.length > 0 && (
                  <ul className="mt-2 text-amber-600 list-disc pl-5 max-h-28 overflow-y-auto">
                    {importResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>Close</Button>
            <Button onClick={runImport} disabled={importing} data-testid="run-import-btn" className="bg-[#0B132B] hover:bg-[#1C2541] text-white">
              {importing ? "Importing..." : "Import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CategorySelect({ value, onChange, testid }) {
  const [opts, setOpts] = useState([]);
  useEffect(() => {
    api.get("/categories").then((r) => setOpts(r.data.filter((c) => c.type !== "article").map((c) => c.name))).catch(() => setOpts([]));
  }, []);
  const names = !value || opts.includes(value) ? opts : [value, ...opts];
  return (
    <Select value={value || "__none__"} onValueChange={(v) => onChange(v === "__none__" ? "" : v)}>
      <SelectTrigger data-testid={testid}><SelectValue placeholder="Select category" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">— None —</SelectItem>
        {names.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function ArticleCategoryField({ value, onChange, testid }) {
  const [opts, setOpts] = useState([]);
  useEffect(() => {
    Promise.all([
      api.get("/categories", { params: { type: "article" } }).then((r) => r.data.map((c) => c.name)).catch(() => []),
      api.get("/admin/articles").then((r) => r.data.map((a) => a.category).filter(Boolean)).catch(() => []),
    ]).then(([a, b]) => setOpts([...new Set([...a, ...b])].sort()));
  }, []);
  return (
    <>
      <Input data-testid={testid} list="article-category-options" value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder="e.g. Nutrition, Mental Health" />
      <datalist id="article-category-options">{opts.map((o) => <option key={o} value={o} />)}</datalist>
      <p className="mt-1 text-xs text-muted-foreground">Pick an existing topic or type a new one. Readers can filter the blog by topic.</p>
    </>
  );
}

function Field({ field, value, onChange, form }) {
  const full = field.full || field.type === "textarea" || field.type === "switch";
  const listVal = field.type === "list" ? (Array.isArray(value) ? value.join(", ") : (value || "")) : value;

  return (
    <div className={full ? "sm:col-span-2" : ""}>
      {field.type !== "switch" && <Label className="mb-1.5 block text-sm">{field.label}{field.req && <span className="text-[#E89D93]"> *</span>}</Label>}
      {field.type === "richtext" ? (
        <RichTextEditor value={value || ""} onChange={onChange} testid={`field-${field.key}`} />
      ) : field.type === "hours" ? (
        <HoursEditor value={value} onChange={onChange} testid={`field-${field.key}`} />
      ) : field.type === "number" ? (
        <Input type="number" step="any" data-testid={`field-${field.key}`} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
      ) : field.type === "textarea" ? (
        <Textarea data-testid={`field-${field.key}`} rows={field.rows || 3} value={value || ""} onChange={(e) => onChange(e.target.value)} />
      ) : field.type === "switch" ? (
        <div className="flex items-center justify-between rounded-lg bg-[#FAF7F2] px-3 py-2.5 h-full">
          <Label className="cursor-pointer text-sm">{field.label}</Label>
          <Switch data-testid={`field-${field.key}`} checked={!!value} onCheckedChange={onChange} />
        </div>
      ) : field.type === "image" ? (
        <ImageField value={value} onChange={onChange} testid={`field-${field.key}`} />
      ) : field.type === "category-select" ? (
        <CategorySelect value={value} onChange={onChange} testid={`field-${field.key}`} />
      ) : field.type === "article-category" ? (
        <ArticleCategoryField value={value} onChange={onChange} testid={`field-${field.key}`} />
      ) : field.type === "country" ? (
        <Select value={value || ""} onValueChange={onChange}>
          <SelectTrigger data-testid={`field-${field.key}`}><SelectValue placeholder="Select country" /></SelectTrigger>
          <SelectContent>
            {COUNTRY_NAMES.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
      ) : field.type === "region" ? (
        <>
          <Input
            data-testid={`field-${field.key}`}
            list={`regions-${field.key}`}
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={form?.country ? "Select or type parish/island" : "Choose a country first"}
            disabled={!form?.country}
          />
          <datalist id={`regions-${field.key}`}>
            {regionsFor(form?.country).map((o) => <option key={o} value={o} />)}
          </datalist>
          <p className="mt-1 text-xs text-muted-foreground" data-testid={`region-hint-${field.key}`}>
            Leave blank to make this visible in every parish of the country.
          </p>
        </>
      ) : field.type === "select" ? (
        <Select value={value || ""} onValueChange={onChange}>
          <SelectTrigger data-testid={`field-${field.key}`}><SelectValue placeholder="Select" /></SelectTrigger>
          <SelectContent>
            {field.options.map((o) => <SelectItem key={o} value={o}>{field.optionLabels?.[o] || o}</SelectItem>)}
          </SelectContent>
        </Select>
      ) : (
        <Input data-testid={`field-${field.key}`} value={listVal || ""} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

function ImageField({ value, onChange, testid }) {
  const [uploading, setUploading] = useState(false);
  const ref = useRef();
  const handle = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const { data } = await api.post("/admin/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      onChange(`${process.env.REACT_APP_BACKEND_URL}${data.url}`);
      toast.success("Image uploaded");
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    } finally {
      setUploading(false);
      if (ref.current) ref.current.value = "";
    }
  };
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        {value ? (
          <img src={value} alt="" className="w-16 h-16 rounded-xl object-cover border border-[#E89D93]/30" />
        ) : (
          <div className="w-16 h-16 rounded-xl bg-[#FAF7F2] border border-dashed border-[#E89D93]/40 flex items-center justify-center text-[#E89D93]"><ImageIcon size={20} /></div>
        )}
        <div className="flex-1">
          <input ref={ref} type="file" accept="image/*" onChange={handle} className="hidden" data-testid={`${testid}-file`} />
          <Button type="button" variant="outline" onClick={() => ref.current?.click()} disabled={uploading} data-testid={`${testid}-upload`} className="border-[#E89D93]/50 text-[#d47f74]">
            <Upload size={15} className="mr-1.5" /> {uploading ? "Uploading..." : "Upload image"}
          </Button>
          {value && <button type="button" onClick={() => onChange("")} className="ml-2 text-xs text-red-500">Remove</button>}
        </div>
      </div>
      <Input value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder="…or paste an image URL" data-testid={testid} />
    </div>
  );
}

function Badge({ children, color = "blush" }) {
  const map = {
    blush: "bg-[#FDF0EE] text-[#d47f74]",
    emerald: "bg-emerald-50 text-emerald-600",
    gold: "bg-[#FDF7E7] text-[#B8912B]",
    slate: "bg-slate-100 text-slate-500",
  };
  return <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${map[color]}`}>{children}</span>;
}

// -----------------------------------------------------------------------------
// Reviews moderation
// -----------------------------------------------------------------------------
function ReviewsManager() {
  const [reviews, setReviews] = useState([]);
  const [filter, setFilter] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    const params = filter === "all" ? {} : { status: filter };
    api.get("/admin/reviews", { params }).then((r) => setReviews(r.data)).catch(() => setReviews([])).finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const moderate = async (id, status) => {
    try {
      await api.put(`/admin/reviews/${id}/status?status=${status}`);
      toast.success(`Review ${status}`);
      load();
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    }
  };
  const remove = async () => {
    try {
      await api.delete(`/admin/reviews/${deleteId}`);
      toast.success("Deleted");
      setDeleteId(null);
      load();
    } catch { toast.error("Failed to delete"); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <h2 className="font-display text-2xl font-bold text-[#0F172A]">Review Moderation</h2>
        <div className="flex gap-1 bg-white rounded-xl p-1 border border-[#E89D93]/15">
          {["pending", "approved", "rejected", "all"].map((f) => (
            <button
              key={f}
              data-testid={`review-filter-${f}`}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${filter === f ? "bg-[#0B132B] text-white" : "text-[#0F172A]"}`}
            >{f}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground py-10 text-center">Loading...</p>
      ) : reviews.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-[#E89D93]/25 py-16 text-center">
          <MessageSquare size={28} className="mx-auto text-[#E89D93]/60" />
          <p className="mt-3 text-muted-foreground">No {filter !== "all" ? filter : ""} reviews.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((r, i) => (
            <div key={r.id} data-testid={`review-mod-${i}`} className="bg-white rounded-2xl border border-[#E89D93]/15 p-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <StarRating value={r.rating} size={14} />
                    <span className="font-semibold text-[#0F172A]">{r.author_name}</span>
                    {r.provider_name && <Badge color="gold">{r.provider_name}</Badge>}
                    <StatusBadge status={r.status} />
                    {r.verified_patient && <Badge color="emerald">Verified</Badge>}
                  </div>
                  {r.title && <h4 className="font-semibold text-[#0F172A] mt-2">{r.title}</h4>}
                  <p className="text-sm text-muted-foreground mt-1">{r.comment}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {r.status !== "approved" && (
                    <Button size="sm" onClick={() => moderate(r.id, "approved")} data-testid={`approve-review-${i}`} className="bg-emerald-500 hover:bg-emerald-600 text-white h-8">
                      <Check size={15} className="mr-1" /> Approve
                    </Button>
                  )}
                  {r.status !== "rejected" && (
                    <Button size="sm" variant="outline" onClick={() => moderate(r.id, "rejected")} data-testid={`reject-review-${i}`} className="h-8 border-slate-300">
                      <X size={15} className="mr-1" /> Reject
                    </Button>
                  )}
                  <button onClick={() => setDeleteId(r.id)} className="p-2 rounded-lg hover:bg-red-50 text-red-500"><Trash2 size={16} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this review?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-red-500 hover:bg-red-600">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    pending: "bg-amber-50 text-amber-600",
    approved: "bg-emerald-50 text-emerald-600",
    rejected: "bg-red-50 text-red-500",
  };
  return <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${map[status]}`}>{status}</span>;
}

function SettingField({ k, label, ph, area, value, onChange }) {
  return (
    <div className={area ? "sm:col-span-2" : ""}>
      <Label className="mb-1.5 block text-sm">{label}</Label>
      {area
        ? <Textarea data-testid={`setting-${k}`} rows={3} value={value} onChange={(e) => onChange(e.target.value)} placeholder={ph} />
        : <Input data-testid={`setting-${k}`} value={value} onChange={(e) => onChange(e.target.value)} placeholder={ph} />}
    </div>
  );
}

function HandoverExport() {
  const [busy, setBusy] = useState(false);
  const download = async () => {
    setBusy(true);
    try {
      const res = await api.get("/admin/export/handover", { responseType: "blob", timeout: 300000 });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/zip" }));
      const a = document.createElement("a");
      a.href = url; a.download = `healthlink-handover-${new Date().toISOString().slice(0, 10)}.zip`; a.click();
      window.URL.revokeObjectURL(url);
      toast.success("Handover package downloaded");
    } catch { toast.error("Export failed. Please try again."); }
    finally { setBusy(false); }
  };
  return (
    <div className="bg-white rounded-2xl border border-[#D4AF37]/40 p-5" data-testid="handover-card">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="max-w-xl">
          <h3 className="font-display font-bold text-[#0F172A] flex items-center gap-2"><Download size={16} className="text-[#D4AF37]" /> Handover package</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Downloads one ZIP with every database collection (JSON), all uploaded images, brand assets, a restore script and a
            <span className="font-semibold"> HANDOVER.md</span> with setup instructions. Pair it with "Save to GitHub" for the source code to transfer the site to its owner.
          </p>
        </div>
        <Button onClick={download} disabled={busy} data-testid="handover-export-btn" className="bg-[#0B132B] hover:bg-[#1C2541] text-white">
          <Download size={15} className="mr-1.5" /> {busy ? "Preparing..." : "Export handover ZIP"}
        </Button>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Site settings + account/security
// -----------------------------------------------------------------------------
function SettingsManager() {
  const { refresh } = useAuth();
  const [s, setS] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cur, setCur] = useState("");
  const [ne, setNe] = useState("");
  const [np, setNp] = useState("");
  const [accSaving, setAccSaving] = useState(false);

  useEffect(() => {
    api.get("/settings").then((r) => setS(r.data || {})).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const setF = (k, v) => setS((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true);
    try { await api.put("/admin/settings", s); toast.success("Settings saved"); }
    catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
    finally { setSaving(false); }
  };

  const saveAccount = async () => {
    if (!cur) return toast.error("Enter your current password to confirm changes.");
    if (!ne.trim() && !np) return toast.error("Enter a new email or new password.");
    setAccSaving(true);
    try {
      const body = { current_password: cur };
      if (ne.trim()) body.new_email = ne.trim().toLowerCase();
      if (np) body.new_password = np;
      await api.put("/admin/account", body);
      toast.success("Account updated");
      setCur(""); setNe(""); setNp("");
      refresh();
    } catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
    finally { setAccSaving(false); }
  };

  if (loading) return <p className="text-muted-foreground py-10 text-center">Loading...</p>;

  const TF = (k, label, ph, area) => (
    <SettingField k={k} label={label} ph={ph} area={area} value={s[k] || ""} onChange={(v) => setF(k, v)} />
  );

  return (
    <div className="space-y-6" data-testid="settings-manager">
      <h2 className="font-display text-2xl font-bold text-[#0F172A]">Settings</h2>

      <HandoverExport />

      <div className="bg-white rounded-2xl border border-[#E89D93]/15 p-5">
        <h3 className="font-display font-bold text-[#0F172A] mb-4">Site content</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {TF("site_title", "Site title", "My Healthcare Link")}
          {TF("hero_heading", "Homepage heading", "Find trusted healthcare across the Caribbean")}
          {TF("hero_subheading", "Homepage tagline", "Discover doctors, services and events near you", true)}
          {TF("about_text", "About blurb (footer)", "Connecting Caribbean communities with trusted healthcare...", true)}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[#E89D93]/15 p-5">
        <h3 className="font-display font-bold text-[#0F172A] mb-4">Contact & social links</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {TF("contact_email", "Contact email", "hello@myhealthcarelink.com")}
          {TF("contact_phone", "Contact phone", "+1 (246) 000-0000")}
          {TF("contact_address", "Address", "Bridgetown, Barbados", true)}
          {TF("facebook_url", "Facebook URL", "https://facebook.com/yourpage")}
          {TF("instagram_url", "Instagram URL", "https://instagram.com/yourpage")}
          {TF("tiktok_url", "TikTok URL", "https://tiktok.com/@yourpage")}
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={save} disabled={saving} data-testid="save-settings-btn" className="bg-[#0B132B] hover:bg-[#1C2541] text-white">
            {saving ? "Saving..." : "Save settings"}
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[#E89D93]/15 p-5">
        <h3 className="font-display font-bold text-[#0F172A] flex items-center gap-2"><ShieldCheck size={18} className="text-[#B8912B]" /> Account & security</h3>
        <p className="text-sm text-muted-foreground mt-1 mb-4">Update your admin login email or password. Enter your current password to confirm.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="mb-1.5 block text-sm">New email</Label>
            <Input data-testid="account-new-email" type="email" value={ne} onChange={(e) => setNe(e.target.value)} placeholder="new@email.com" />
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">New password (min 8 chars)</Label>
            <Input data-testid="account-new-password" type="password" value={np} onChange={(e) => setNp(e.target.value)} placeholder="********" />
          </div>
          <div className="sm:col-span-2">
            <Label className="mb-1.5 block text-sm">Current password <span className="text-[#E89D93]">*</span></Label>
            <Input data-testid="account-current-password" type="password" value={cur} onChange={(e) => setCur(e.target.value)} placeholder="********" />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={saveAccount} disabled={accSaving} data-testid="save-account-btn" className="bg-[#E89D93] hover:bg-[#e08b80] text-white">
            {accSaving ? "Updating..." : "Update account"}
          </Button>
        </div>
      </div>

      <AboutEditor />
    </div>
  );
}

// -----------------------------------------------------------------------------
// About page editor
// -----------------------------------------------------------------------------
function AboutEditor() {
  const [a, setA] = useState({ heading: "", story: "", image_url: "", team: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/about").then((r) => setA({ heading: "", story: "", image_url: "", team: [], ...(r.data || {}) }))
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  const setField = (k, v) => setA((p) => ({ ...p, [k]: v }));
  const setMember = (i, k, v) => setA((p) => ({ ...p, team: p.team.map((m, j) => (j === i ? { ...m, [k]: v } : m)) }));
  const addMember = () => setA((p) => ({ ...p, team: [...p.team, { name: "", role: "", photo: "", bio: "" }] }));
  const removeMember = (i) => setA((p) => ({ ...p, team: p.team.filter((_, j) => j !== i) }));

  const save = async () => {
    setSaving(true);
    try { await api.put("/admin/about", a); toast.success("About page saved"); }
    catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
    finally { setSaving(false); }
  };

  if (loading) return null;

  return (
    <div className="bg-white rounded-2xl border border-[#E89D93]/15 p-5" data-testid="about-editor">
      <h3 className="font-display font-bold text-[#0F172A] mb-4">About page</h3>
      <div className="space-y-4">
        <div>
          <Label className="mb-1.5 block text-sm">Heading</Label>
          <Input data-testid="about-heading-input" value={a.heading || ""} onChange={(e) => setField("heading", e.target.value)} placeholder="About My Healthcare Link" />
        </div>
        <div>
          <Label className="mb-1.5 block text-sm">Hero image</Label>
          <ImageField value={a.image_url} onChange={(v) => setField("image_url", v)} testid="about-image" />
        </div>
        <div>
          <Label className="mb-1.5 block text-sm">Our story</Label>
          <RichTextEditor value={a.story || ""} onChange={(v) => setField("story", v)} testid="about-story-editor" />
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-sm">Team members</Label>
            <Button type="button" variant="outline" size="sm" onClick={addMember} data-testid="add-team-member-btn"><Plus size={14} className="mr-1" /> Add member</Button>
          </div>
          <div className="space-y-3">
            {(a.team || []).map((m, i) => (
              <div key={i} className="rounded-xl border border-[#E89D93]/20 p-3" data-testid={`team-member-editor-${i}`}>
                <div className="flex items-start gap-3">
                  <ImageField value={m.photo} onChange={(v) => setMember(i, "photo", v)} testid={`team-photo-${i}`} />
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Input data-testid={`team-name-${i}`} value={m.name || ""} onChange={(e) => setMember(i, "name", e.target.value)} placeholder="Name" />
                    <Input data-testid={`team-role-${i}`} value={m.role || ""} onChange={(e) => setMember(i, "role", e.target.value)} placeholder="Role (e.g. Founder)" />
                    <Textarea className="sm:col-span-2" rows={2} data-testid={`team-bio-${i}`} value={m.bio || ""} onChange={(e) => setMember(i, "bio", e.target.value)} placeholder="Short bio" />
                  </div>
                  <button onClick={() => removeMember(i)} data-testid={`remove-team-member-${i}`} className="p-2 rounded-lg hover:bg-red-50 text-red-500"><Trash2 size={16} /></button>
                </div>
              </div>
            ))}
            {(a.team || []).length === 0 && <p className="text-sm text-muted-foreground">No team members yet.</p>}
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={save} disabled={saving} data-testid="save-about-btn" className="bg-[#0B132B] hover:bg-[#1C2541] text-white">
            {saving ? "Saving..." : "Save about page"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Reusable date-range filter bar
function DateRangeBar({ start, end, setStart, setEnd, testid }) {
  return (
    <div className="flex items-center gap-2 flex-wrap" data-testid={`${testid}-daterange`}>
      <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} data-testid={`${testid}-start`} className="w-40 h-9" />
      <span className="text-muted-foreground text-sm">to</span>
      <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} data-testid={`${testid}-end`} className="w-40 h-9" />
      {(start || end) && (
        <button onClick={() => { setStart(""); setEnd(""); }} data-testid={`${testid}-clear`} className="text-sm text-[#E89D93] hover:text-[#d47f74] px-1">Clear</button>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Newsletter subscribers
// -----------------------------------------------------------------------------
function SubscribersManager() {
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [deleteId, setDeleteId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    api.get("/admin/subscribers").then((r) => setSubs(r.data)).catch(() => setSubs([])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!email.trim()) return;
    try {
      await api.post("/admin/subscribers", { email: email.trim().toLowerCase() });
      toast.success("Subscriber added");
      setEmail(""); load();
    } catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
  };
  const toggle = async (sub) => {
    try { await api.put(`/admin/subscribers/${sub.id}`, { active: !sub.active }); load(); }
    catch { toast.error("Failed to update"); }
  };
  const remove = async () => {
    try { await api.delete(`/admin/subscribers/${deleteId}`); toast.success("Removed"); setDeleteId(null); load(); }
    catch { toast.error("Failed to delete"); }
  };

  const activeCount = subs.filter((x) => x.active).length;

  return (
    <div data-testid="subscribers-manager">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold text-[#0F172A]">Mailing List</h2>
          <p className="text-sm text-muted-foreground">{subs.length} total · {activeCount} active</p>
        </div>
        <div className="flex items-center gap-2">
          <Input data-testid="add-subscriber-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="add email..." className="w-56" />
          <Button onClick={add} data-testid="add-subscriber-btn" className="bg-[#0B132B] hover:bg-[#1C2541] text-white"><Plus size={16} className="mr-1.5" /> Add</Button>
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground py-10 text-center">Loading...</p>
      ) : subs.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-[#E89D93]/25 py-16 text-center">
          <Mail size={28} className="mx-auto text-[#E89D93]/60" />
          <p className="mt-3 text-muted-foreground">No subscribers yet. They appear here when visitors join from the blog/events popup.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#E89D93]/15 divide-y divide-slate-100">
          {subs.map((sub, i) => (
            <div key={sub.id} data-testid={`subscriber-row-${i}`} className="flex items-center gap-4 px-4 py-3 hover:bg-[#FAF7F2]">
              <div className="flex-1 min-w-0">
                <span className="font-medium text-[#0F172A] truncate">{sub.email}</span>
                {!sub.active && <Badge color="slate">Inactive</Badge>}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                  <Switch data-testid={`subscriber-active-${i}`} checked={!!sub.active} onCheckedChange={() => toggle(sub)} />
                  Active
                </label>
                <button onClick={() => setDeleteId(sub.id)} data-testid={`delete-subscriber-${i}`} className="p-2 rounded-lg hover:bg-red-50 text-red-500"><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this subscriber?</AlertDialogTitle>
            <AlertDialogDescription>They will be permanently removed from the mailing list.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-red-500 hover:bg-red-600">Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Visitor analytics
// -----------------------------------------------------------------------------
function AnalyticsManager() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(null);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    const params = {};
    if (start) params.start = start;
    if (end) params.end = end;
    api.get("/admin/analytics", { params })
      .then((r) => setData(r.data))
      .catch(() => setData({ sessions: [], total_sessions: 0, total_pageviews: 0 }))
      .finally(() => setLoading(false));
  }, [start, end]);
  useEffect(() => { load(); }, [load]);

  const fmtDur = (s) => (s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s || 0}s`);
  const fmtTime = (iso) => { try { return new Date(iso).toLocaleString(); } catch { return iso; } };

  const sessions = data?.sessions || [];

  return (
    <div data-testid="analytics-manager">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h2 className="font-display text-2xl font-bold text-[#0F172A]">Visitor Analytics</h2>
        <DateRangeBar start={start} end={end} setStart={setStart} setEnd={setEnd} testid="analytics" />
      </div>
      {loading ? <p className="text-muted-foreground py-10 text-center">Loading...</p> : (
      <>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        {[
          { l: "Sessions", v: data?.total_sessions || 0 },
          { l: "Page views", v: data?.total_pageviews || 0 },
          { l: "Countries", v: new Set(sessions.map((x) => x.country).filter(Boolean)).size },
        ].map((c) => (
          <div key={c.l} className="bg-white rounded-2xl border border-[#E89D93]/15 p-5">
            <div className="font-display text-3xl font-bold text-[#0B132B]">{c.v}</div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mt-1">{c.l}</div>
          </div>
        ))}
      </div>

      {sessions.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-[#E89D93]/25 py-16 text-center">
          <BarChart3 size={28} className="mx-auto text-[#E89D93]/60" />
          <p className="mt-3 text-muted-foreground">No visits recorded yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#E89D93]/15 overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-4 py-2.5 bg-[#FAF7F2] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <span>Visitor / Location</span><span className="text-right">Pages</span><span className="text-right">Time</span><span className="text-right">Last seen</span>
          </div>
          <div className="divide-y divide-slate-100">
            {sessions.map((s, i) => (
              <div key={s.session_id} data-testid={`analytics-session-${i}`}>
                <button onClick={() => setOpenId(openId === s.session_id ? null : s.session_id)} className="w-full grid grid-cols-[1fr_auto_auto_auto] gap-3 px-4 py-3 items-center text-left hover:bg-[#FAF7F2]">
                  <div className="min-w-0">
                    <div className="font-medium text-[#0F172A] truncate">{s.country || "Unknown"}{s.city ? `, ${s.city}` : ""}</div>
                    <div className="text-xs text-muted-foreground truncate">{s.ip || "—"}</div>
                  </div>
                  <span className="text-right text-sm">{s.page_count}</span>
                  <span className="text-right text-sm">{fmtDur(s.total_duration)}</span>
                  <span className="text-right text-xs text-muted-foreground whitespace-nowrap">{fmtTime(s.last_seen)}</span>
                </button>
                {openId === s.session_id && (
                  <div className="px-4 pb-3 bg-[#FAF7F2]/50" data-testid={`analytics-pages-${i}`}>
                    <p className="text-xs text-muted-foreground mb-1.5 break-all">{s.user_agent}</p>
                    <ul className="space-y-1">
                      {s.pages.map((p, j) => (
                        <li key={j} className="flex items-center justify-between text-sm text-[#334155] gap-3">
                          <span className="font-mono text-xs truncate">{p.path}</span>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">{fmtTime(p.ts)} · {fmtDur(p.duration)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Search gaps
// -----------------------------------------------------------------------------
function SearchGapsManager() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [onlyGaps, setOnlyGaps] = useState(true);
  const [confirmClear, setConfirmClear] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const params = {};
    if (start) params.start = start;
    if (end) params.end = end;
    api.get("/admin/search-gaps", { params })
      .then((r) => setData(r.data))
      .catch(() => setData({ terms: [], total_searches: 0, zero_result_searches: 0 }))
      .finally(() => setLoading(false));
  }, [start, end]);
  useEffect(() => { load(); }, [load]);

  const clear = async () => {
    try { await api.delete("/admin/search-gaps"); toast.success("Search history cleared"); setConfirmClear(false); load(); }
    catch { toast.error("Failed to clear"); }
  };

  const fmtTime = (iso) => { try { return new Date(iso).toLocaleString(); } catch { return iso; } };
  const terms = (data?.terms || []).filter((t) => !onlyGaps || t.zero_results > 0);

  return (
    <div data-testid="search-gaps-manager">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="font-display text-2xl font-bold text-[#0F172A]">Search Gaps</h2>
          <p className="text-sm text-muted-foreground">What visitors look for in the directory — and what they can't find.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <DateRangeBar start={start} end={end} setStart={setStart} setEnd={setEnd} testid="search-gaps" />
          <Button variant="outline" size="sm" onClick={() => setConfirmClear(true)} data-testid="clear-searches-btn" className="text-red-500 border-red-200 hover:bg-red-50"><Trash2 size={14} className="mr-1.5" /> Clear</Button>
        </div>
      </div>
      {loading ? <p className="text-muted-foreground py-10 text-center">Loading...</p> : (
      <>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        {[
          { l: "Total searches", v: data?.total_searches || 0, t: "search-total" },
          { l: "No-result searches", v: data?.zero_result_searches || 0, t: "search-zero" },
          { l: "Unmet terms", v: (data?.terms || []).filter((x) => x.zero_results > 0).length, t: "search-unmet" },
        ].map((c) => (
          <div key={c.l} className="bg-white rounded-2xl border border-[#E89D93]/15 p-5" data-testid={c.t}>
            <div className="font-display text-3xl font-bold text-[#0B132B]">{c.v}</div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mt-1">{c.l}</div>
          </div>
        ))}
      </div>

      <label className="flex items-center gap-2 text-sm text-muted-foreground mb-3 cursor-pointer w-fit">
        <Switch data-testid="only-gaps-toggle" checked={onlyGaps} onCheckedChange={setOnlyGaps} /> Show only searches with no results
      </label>

      {terms.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-[#E89D93]/25 py-16 text-center">
          <SearchIcon size={28} className="mx-auto text-[#E89D93]/60" />
          <p className="mt-3 text-muted-foreground" data-testid="search-gaps-empty">{onlyGaps ? "No unmet searches yet — every search found something." : "No searches recorded yet."}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#E89D93]/15 overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-4 py-2.5 bg-[#FAF7F2] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <span>Search term</span><span className="text-right">Searches</span><span className="text-right">No results</span><span className="text-right hidden sm:block">Last searched</span>
          </div>
          <div className="divide-y divide-slate-100">
            {terms.map((t, i) => (
              <div key={t.term} data-testid={`search-gap-row-${i}`} className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-4 py-3 items-center hover:bg-[#FAF7F2]">
                <div className="min-w-0">
                  <div className="font-medium text-[#0F172A] truncate">"{t.term}"</div>
                  {t.countries.length > 0 && <div className="text-xs text-muted-foreground truncate">{t.countries.join(", ")}</div>}
                </div>
                <span className="text-right text-sm">{t.count}</span>
                <span className={`text-right text-sm font-semibold ${t.zero_results > 0 ? "text-red-500" : "text-emerald-600"}`}>{t.zero_results}</span>
                <span className="text-right text-xs text-muted-foreground whitespace-nowrap hidden sm:block">{fmtTime(t.last_searched)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      </>
      )}

      <AlertDialog open={confirmClear} onOpenChange={(v) => !v && setConfirmClear(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all search history?</AlertDialogTitle>
            <AlertDialogDescription>This permanently removes every recorded search. It cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={clear} data-testid="confirm-clear-searches-btn" className="bg-red-500 hover:bg-red-600">Clear</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Quizzes: list / editor / analysis
// -----------------------------------------------------------------------------
function blankQuiz() {
  return { title: "", description: "", result_message: "", result_tiers: [], popup_delay_seconds: 10, active: false, start_date: "", end_date: "", questions: [] };
}

function QuizzesManager() {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("list"); // list | edit | analysis
  const [editing, setEditing] = useState(null);
  const [analysisId, setAnalysisId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    api.get("/admin/quizzes").then((r) => setQuizzes(r.data)).catch(() => setQuizzes([])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const activate = async (q) => {
    try { await api.put(`/admin/quizzes/${q.id}`, { ...q, active: !q.active }); load(); }
    catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
  };
  const remove = async () => {
    try { await api.delete(`/admin/quizzes/${deleteId}`); toast.success("Quiz deleted"); setDeleteId(null); load(); }
    catch { toast.error("Failed to delete"); }
  };

  if (view === "edit") {
    return <QuizEditor initial={editing} onDone={() => { setView("list"); load(); }} onCancel={() => setView("list")} />;
  }
  if (view === "analysis") {
    return <QuizAnalysis quizId={analysisId} onBack={() => setView("list")} />;
  }

  return (
    <div data-testid="quizzes-manager">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold text-[#0F172A]">Quizzes</h2>
          <p className="text-sm text-muted-foreground">Only one quiz can be active at a time.</p>
        </div>
        <Button onClick={() => { setEditing(blankQuiz()); setView("edit"); }} data-testid="add-quiz-btn" className="bg-[#0B132B] hover:bg-[#1C2541] text-white"><Plus size={16} className="mr-1.5" /> New quiz</Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground py-10 text-center">Loading...</p>
      ) : quizzes.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-[#E89D93]/25 py-16 text-center">
          <ClipboardList size={28} className="mx-auto text-[#E89D93]/60" />
          <p className="mt-3 text-muted-foreground">No quizzes yet. Create one to start collecting responses.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#E89D93]/15 divide-y divide-slate-100">
          {quizzes.map((q, i) => (
            <div key={q.id} data-testid={`quiz-row-${i}`} className="flex items-center gap-4 px-4 py-3 hover:bg-[#FAF7F2]">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-[#0F172A] truncate">{q.title}</span>
                  {q.active && <span className="text-[10px] font-bold uppercase tracking-wide bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full">Active</span>}
                </div>
                <p className="text-xs text-muted-foreground">{(q.questions || []).length} questions · {q.response_count || 0} responses · popup after {q.popup_delay_seconds}s</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                  <Switch data-testid={`quiz-active-${i}`} checked={!!q.active} onCheckedChange={() => activate(q)} /> Active
                </label>
                <button onClick={() => { setAnalysisId(q.id); setView("analysis"); }} data-testid={`quiz-analyze-${i}`} title="Analyze" className="p-2 rounded-lg hover:bg-[#FDF7E7] text-[#B8912B]"><BarChart3 size={16} /></button>
                <button onClick={() => { setEditing(q); setView("edit"); }} data-testid={`quiz-edit-${i}`} className="p-2 rounded-lg hover:bg-slate-100 text-[#0F172A]"><Pencil size={16} /></button>
                <button onClick={() => setDeleteId(q.id)} data-testid={`quiz-delete-${i}`} className="p-2 rounded-lg hover:bg-red-50 text-red-500"><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this quiz?</AlertDialogTitle>
            <AlertDialogDescription>The quiz is removed. Collected responses stay in the database for analysis.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-red-500 hover:bg-red-600">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function QuizEditor({ initial, onDone, onCancel }) {
  const [q, setQ] = useState(() => ({
    result_tiers: [], start_date: "", end_date: "",
    ...initial,
    questions: (initial.questions || []).map((x) => ({
      ...x,
      options: (x.options || []).map((o) => (typeof o === "string" ? { text: o, points: 0 } : { text: o.text || "", points: o.points || 0 })),
    })),
  }));
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setQ((p) => ({ ...p, [k]: v }));

  const addQuestion = () => setQ((p) => ({ ...p, questions: [...p.questions, { text: "", options: [{ text: "", points: 0 }, { text: "", points: 0 }] }] }));
  const removeQuestion = (i) => setQ((p) => ({ ...p, questions: p.questions.filter((_, j) => j !== i) }));
  const setQuestion = (i, text) => setQ((p) => ({ ...p, questions: p.questions.map((x, j) => (j === i ? { ...x, text } : x)) }));
  const addOption = (i) => setQ((p) => ({ ...p, questions: p.questions.map((x, j) => (j === i ? { ...x, options: [...x.options, { text: "", points: 0 }] } : x)) }));
  const setOpt = (i, oi, k, v) => setQ((p) => ({ ...p, questions: p.questions.map((x, j) => (j === i ? { ...x, options: x.options.map((o, m) => (m === oi ? { ...o, [k]: v } : o)) } : x)) }));
  const removeOption = (i, oi) => setQ((p) => ({ ...p, questions: p.questions.map((x, j) => (j === i ? { ...x, options: x.options.filter((_, m) => m !== oi) } : x)) }));
  const addTier = () => setQ((p) => ({ ...p, result_tiers: [...(p.result_tiers || []), { min_points: 0, message: "" }] }));
  const setTier = (i, k, v) => setQ((p) => ({ ...p, result_tiers: p.result_tiers.map((t, j) => (j === i ? { ...t, [k]: v } : t)) }));
  const removeTier = (i) => setQ((p) => ({ ...p, result_tiers: p.result_tiers.filter((_, j) => j !== i) }));

  const save = async () => {
    if (!q.title.trim()) return toast.error("Give the quiz a title.");
    const clean = {
      ...q,
      popup_delay_seconds: Number(q.popup_delay_seconds) || 10,
      result_tiers: (q.result_tiers || [])
        .filter((t) => (t.message || "").trim())
        .map((t) => ({ min_points: Number(t.min_points) || 0, message: t.message.trim() })),
      questions: q.questions
        .filter((x) => x.text.trim())
        .map((x) => ({ ...x, options: x.options.map((o) => ({ text: (o.text || "").trim(), points: Number(o.points) || 0 })).filter((o) => o.text) })),
    };
    if (clean.questions.length === 0) return toast.error("Add at least one question with options.");
    if (clean.questions.some((x) => x.options.length < 2)) return toast.error("Each question needs at least 2 options.");
    setSaving(true);
    try {
      if (q.id) await api.put(`/admin/quizzes/${q.id}`, clean);
      else await api.post("/admin/quizzes", clean);
      toast.success("Quiz saved");
      onDone();
    } catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
    finally { setSaving(false); }
  };

  return (
    <div data-testid="quiz-editor" className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-bold text-[#0F172A]">{q.id ? "Edit quiz" : "New quiz"}</h2>
        <button onClick={onCancel} className="text-sm text-muted-foreground hover:text-[#0F172A]">Cancel</button>
      </div>

      <div className="bg-white rounded-2xl border border-[#E89D93]/15 p-5 space-y-4">
        <div>
          <Label className="mb-1.5 block text-sm">Title</Label>
          <Input data-testid="quiz-title-input" value={q.title} onChange={(e) => set("title", e.target.value)} placeholder="Health Check Quiz" />
        </div>
        <div>
          <Label className="mb-1.5 block text-sm">Intro description</Label>
          <Textarea rows={2} data-testid="quiz-desc-input" value={q.description || ""} onChange={(e) => set("description", e.target.value)} placeholder="A short intro shown before the quiz starts" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="mb-1.5 block text-sm">Popup delay (seconds on page)</Label>
            <Input type="number" min="0" data-testid="quiz-delay-input" value={q.popup_delay_seconds} onChange={(e) => set("popup_delay_seconds", e.target.value)} />
          </div>
          <div className="flex items-center justify-between rounded-lg bg-[#FAF7F2] px-3 py-2.5">
            <Label className="text-sm cursor-pointer">Active (only one at a time)</Label>
            <Switch data-testid="quiz-active-switch" checked={!!q.active} onCheckedChange={(v) => set("active", v)} />
          </div>
        </div>
        <div>
          <Label className="mb-1.5 block text-sm">Default result email message <span className="text-muted-foreground font-normal">(use **bold** for emphasis)</span></Label>
          <Textarea rows={3} data-testid="quiz-result-msg" value={q.result_message || ""} onChange={(e) => set("result_message", e.target.value)} placeholder="Shown if no score tier matches. Use **bold** to emphasise words." />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="mb-1.5 block text-sm">Start date <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input type="date" data-testid="quiz-start-date" value={q.start_date || ""} onChange={(e) => set("start_date", e.target.value)} />
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">End date <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input type="date" data-testid="quiz-end-date" value={q.end_date || ""} onChange={(e) => set("end_date", e.target.value)} />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[#E89D93]/15 p-5">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-display font-bold text-[#0F172A]">Score-based result messages</h3>
          <Button type="button" variant="outline" size="sm" onClick={addTier} data-testid="add-tier-btn"><Plus size={14} className="mr-1" /> Add tier</Button>
        </div>
        <p className="text-xs text-muted-foreground mb-3">Each person receives the message of the highest tier their points reach. Use **bold** for emphasis. Falls back to the default message above.</p>
        <div className="space-y-2">
          {(q.result_tiers || []).map((t, i) => (
            <div key={i} className="flex items-start gap-2" data-testid={`tier-editor-${i}`}>
              <div className="w-24 shrink-0">
                <Input type="number" data-testid={`tier-min-${i}`} value={t.min_points} onChange={(e) => setTier(i, "min_points", e.target.value)} placeholder="Min pts" className="h-9" />
              </div>
              <Textarea rows={2} data-testid={`tier-msg-${i}`} value={t.message} onChange={(e) => setTier(i, "message", e.target.value)} placeholder="Message for this score and up" className="flex-1" />
              <button onClick={() => removeTier(i)} data-testid={`remove-tier-${i}`} className="p-2 rounded-lg hover:bg-red-50 text-red-500 mt-0.5"><Trash2 size={15} /></button>
            </div>
          ))}
          {(q.result_tiers || []).length === 0 && <p className="text-sm text-muted-foreground">No tiers yet — everyone gets the default message.</p>}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[#E89D93]/15 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display font-bold text-[#0F172A]">Questions</h3>
          <Button type="button" variant="outline" size="sm" onClick={addQuestion} data-testid="add-question-btn"><Plus size={14} className="mr-1" /> Add question</Button>
        </div>
        <div className="space-y-4">
          {q.questions.map((ques, i) => (
            <div key={i} className="rounded-xl border border-[#E89D93]/20 p-4" data-testid={`question-editor-${i}`}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-semibold text-[#B8912B]">Q{i + 1}</span>
                <Input data-testid={`question-text-${i}`} value={ques.text} onChange={(e) => setQuestion(i, e.target.value)} placeholder="Question text" className="flex-1" />
                <button onClick={() => removeQuestion(i)} data-testid={`remove-question-${i}`} className="p-2 rounded-lg hover:bg-red-50 text-red-500"><Trash2 size={15} /></button>
              </div>
              <div className="space-y-2 pl-8">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground"><span className="flex-1">Option</span><span className="w-16 text-center">Points</span><span className="w-7" /></div>
                {ques.options.map((opt, oi) => (
                  <div key={oi} className="flex items-center gap-2">
                    <Input data-testid={`option-${i}-${oi}`} value={opt.text} onChange={(e) => setOpt(i, oi, "text", e.target.value)} placeholder={`Option ${oi + 1}`} className="flex-1 h-9" />
                    <Input type="number" data-testid={`option-points-${i}-${oi}`} value={opt.points} onChange={(e) => setOpt(i, oi, "points", e.target.value)} className="w-16 h-9 text-center" />
                    {ques.options.length > 2 && <button onClick={() => removeOption(i, oi)} className="p-1.5 rounded hover:bg-red-50 text-red-400"><X size={14} /></button>}
                  </div>
                ))}
                <button onClick={() => addOption(i)} data-testid={`add-option-${i}`} className="text-xs text-[#E89D93] hover:text-[#d47f74]">+ Add option</button>
              </div>
            </div>
          ))}
          {q.questions.length === 0 && <p className="text-sm text-muted-foreground">No questions yet.</p>}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={save} disabled={saving} data-testid="save-quiz-btn" className="bg-[#0B132B] hover:bg-[#1C2541] text-white">{saving ? "Saving..." : "Save quiz"}</Button>
      </div>
    </div>
  );
}

function QuizAnalysis({ quizId, onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    const params = {};
    if (start) params.start = start;
    if (end) params.end = end;
    api.get(`/admin/quizzes/${quizId}/analysis`, { params }).then((r) => setData(r.data)).catch(() => setData(null)).finally(() => setLoading(false));
  }, [quizId, start, end]);
  useEffect(() => { load(); }, [load]);

  const exportCsv = async () => {
    try {
      const res = await api.get(`/admin/quizzes/${quizId}/responses.csv`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url; a.download = "quiz-responses.csv"; a.click();
      window.URL.revokeObjectURL(url);
    } catch { toast.error("Export failed"); }
  };

  const fmtTime = (iso) => { try { return new Date(iso).toLocaleString(); } catch { return iso; } };

  return (
    <div data-testid="quiz-analysis">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="text-sm text-[#E89D93] hover:text-[#d47f74]">← Back</button>
          <h2 className="font-display text-2xl font-bold text-[#0F172A]">{data?.quiz_title || "Quiz"} analysis</h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <DateRangeBar start={start} end={end} setStart={setStart} setEnd={setEnd} testid="quiz" />
          <Button variant="outline" size="sm" onClick={exportCsv} data-testid="export-quiz-csv-btn"><Download size={14} className="mr-1" /> Export CSV</Button>
        </div>
      </div>

      {loading ? <p className="text-muted-foreground py-10 text-center">Loading...</p> : !data ? (
        <p className="text-muted-foreground py-10 text-center">No data.</p>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-[#E89D93]/15 p-5">
              <div className="font-display text-3xl font-bold text-[#0B132B]" data-testid="quiz-total-responses">{data.total}</div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground mt-1">Responses</div>
            </div>
            {Object.entries(data.ages || {}).slice(0, 2).map(([age, n]) => (
              <div key={age} className="bg-white rounded-2xl border border-[#E89D93]/15 p-5">
                <div className="font-display text-3xl font-bold text-[#0B132B]">{n}</div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mt-1">Age {age}</div>
              </div>
            ))}
          </div>

          {(data.questions || []).map((ques, i) => {
            const total = Object.values(ques.counts).reduce((a, b) => a + b, 0) || 1;
            return (
              <div key={i} className="bg-white rounded-2xl border border-[#E89D93]/15 p-5" data-testid={`analysis-question-${i}`}>
                <p className="font-medium text-[#0F172A] mb-3">{ques.text}</p>
                <div className="space-y-2">
                  {Object.entries(ques.counts).map(([opt, n]) => (
                    <div key={opt}>
                      <div className="flex items-center justify-between text-sm mb-1"><span className="text-[#334155]">{opt}</span><span className="text-muted-foreground">{n} ({Math.round((n / total) * 100)}%)</span></div>
                      <div className="h-2 rounded-full bg-[#FDF0EE] overflow-hidden"><div className="h-full bg-[#E89D93]" style={{ width: `${(n / total) * 100}%` }} /></div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          <div className="bg-white rounded-2xl border border-[#E89D93]/15 overflow-hidden">
            <div className="px-4 py-2.5 bg-[#FAF7F2] text-xs font-semibold uppercase tracking-wider text-muted-foreground">Respondents ({data.responses.length})</div>
            <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
              {data.responses.map((r, i) => (
                <div key={i} className="px-4 py-3" data-testid={`respondent-${i}`}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-[#0F172A] truncate">{r.name} <span className="text-muted-foreground font-normal">· {r.email}</span></span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{r.age} · {r.points || 0} pts · {fmtTime(r.created_at)}</span>
                  </div>
                  <div className="mt-1 text-xs text-[#64748B] flex flex-wrap gap-x-3 gap-y-0.5">
                    {(r.answers || []).map((a, j) => <span key={j}>{a.question}: <b className="text-[#334155]">{a.answer}</b></span>)}
                  </div>
                </div>
              ))}
              {data.responses.length === 0 && <p className="px-4 py-8 text-center text-sm text-muted-foreground">No responses in this range.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
