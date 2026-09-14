import React, { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users, Activity, Tags, BookOpen, Calendar, MessageSquare, Settings as SettingsIcon,
  Plus, Pencil, Trash2, LogOut, Check, X, Eye, ExternalLink, ShieldCheck,
  Upload, Download, Image as ImageIcon,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { StarRating } from "@/components/StarRating";
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
import { ISLANDS } from "@/lib/constants";
import api, { formatApiError } from "@/lib/api";
import { toast } from "sonner";

const ISLAND_OPTS = ISLANDS;

const PROVIDER_TEMPLATE = `name,specialty,category,island,description,phone,email,website,address,niches,services,in_network,featured,verified,accepting_new_patients,image_url
Dr. Jane Doe,Cardiology,Doctors,Barbados,Experienced cardiologist serving the community,+1246555000,jane@example.com,https://example.com,Bridgetown,Heart Health;Preventive Care,Consultation;ECG;Stress Test,true,true,true,true,
Sunrise Wellness Clinic,General Practice,Clinics,Jamaica,Full-service family clinic,+1876555111,info@sunrise.com,,Kingston,Family Medicine;Pediatrics,General Consultation;Vaccinations,false,false,true,true,
`;

// Field schemas per entity
const SCHEMAS = {
  providers: [
    { key: "name", label: "Name", req: true },
    { key: "specialty", label: "Specialty" },
    { key: "category", label: "Category" },
    { key: "island", label: "Island", type: "island" },
    { key: "image_url", label: "Image", type: "image", full: true },
    { key: "description", label: "Description", type: "textarea", full: true },
    { key: "niches", label: "Niches (comma separated)", type: "list", full: true },
    { key: "services", label: "Services (comma separated)", type: "list", full: true },
    { key: "phone", label: "Phone" },
    { key: "email", label: "Email" },
    { key: "website", label: "Website", full: true },
    { key: "address", label: "Address", full: true },
    { key: "in_network", label: "In-Network", type: "switch" },
    { key: "accepting_new_patients", label: "Accepting new patients", type: "switch" },
    { key: "verified", label: "Verified", type: "switch" },
    { key: "featured", label: "Featured on homepage", type: "switch" },
    { key: "active", label: "Active (visible)", type: "switch" },
  ],
  services: [
    { key: "name", label: "Name", req: true },
    { key: "category", label: "Category" },
    { key: "island", label: "Island", type: "island" },
    { key: "icon", label: "Icon", type: "select", options: ["activity", "heart", "stethoscope", "microscope", "video"] },
    { key: "description", label: "Description", type: "textarea", full: true },
    { key: "active", label: "Active", type: "switch" },
  ],
  categories: [
    { key: "name", label: "Name", req: true },
    { key: "type", label: "Type", type: "select", options: ["category", "specialty", "service", "niche"] },
    { key: "icon", label: "Icon" },
    { key: "description", label: "Description", type: "textarea", full: true },
  ],
  articles: [
    { key: "title", label: "Title", req: true, full: true },
    { key: "category", label: "Category" },
    { key: "island", label: "Island", type: "island" },
    { key: "author", label: "Author" },
    { key: "image_url", label: "Image", type: "image", full: true },
    { key: "excerpt", label: "Excerpt", type: "textarea", full: true },
    { key: "content", label: "Content", type: "textarea", full: true, rows: 8 },
    { key: "published", label: "Published", type: "switch" },
  ],
  events: [
    { key: "name", label: "Name", req: true, full: true },
    { key: "date", label: "Date (e.g. Apr 18, 2026)" },
    { key: "time", label: "Time (e.g. 9:00 AM - 4:00 PM)" },
    { key: "location", label: "Location" },
    { key: "island", label: "Island", type: "island" },
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
  providers: { in_network: false, accepting_new_patients: true, verified: false, featured: false, active: true, niches: [], services: [] },
  services: { active: true, icon: "activity" },
  categories: { type: "category", icon: "stethoscope" },
  articles: { published: true, author: "My Healthcare Link" },
  events: { published: true, external_links: [] },
};

const TABS = [
  { key: "providers", label: "Providers", icon: Users },
  { key: "services", label: "Services", icon: Activity },
  { key: "categories", label: "Categories", icon: Tags },
  { key: "articles", label: "Articles", icon: BookOpen },
  { key: "events", label: "Events", icon: Calendar },
  { key: "reviews", label: "Reviews", icon: MessageSquare },
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
          {tab === "reviews" ? <ReviewsManager /> : <EntityManager key={tab} entity={tab} />}
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Generic entity CRUD manager
// -----------------------------------------------------------------------------
function EntityManager({ entity }) {
  const schema = SCHEMAS[entity];
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    api.get(`/admin/${entity}`).then((r) => setItems(r.data)).catch(() => setItems([])).finally(() => setLoading(false));
  }, [entity]);

  useEffect(() => { load(); }, [load]);

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

  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

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

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="font-display text-2xl font-bold text-[#0F172A] capitalize">{entity}</h2>
          <p className="text-sm text-muted-foreground">{items.length} total</p>
        </div>
        <div className="flex items-center gap-2">
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

      {loading ? (
        <p className="text-muted-foreground py-10 text-center">Loading...</p>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-[#E89D93]/25 py-16 text-center">
          <Plus size={28} className="mx-auto text-[#E89D93]/60" />
          <p className="mt-3 text-muted-foreground">No {entity} yet. Click "Add" to create the first one.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#E89D93]/15 overflow-hidden">
          <div className="divide-y divide-slate-100">
            {items.map((item, i) => (
              <div key={item.id} data-testid={`${entity}-row-${i}`} className="flex items-center gap-4 px-4 py-3 hover:bg-[#FAF7F2] transition-colors">
                {item.image_url && <img src={item.image_url} alt="" className="w-11 h-11 rounded-lg object-cover shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-[#0F172A] truncate">{item[titleKey]}</span>
                    {item.island && <Badge>{item.island}</Badge>}
                    {entity === "providers" && item.in_network && <Badge color="emerald">In-Network</Badge>}
                    {entity === "providers" && item.featured && <Badge color="gold">Featured</Badge>}
                    {(item.active === false || item.published === false) && <Badge color="slate">Hidden</Badge>}
                    {entity === "categories" && item.type && <Badge color="gold">{item.type}</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {item.specialty || item.category || item.excerpt || item.description || item.date || ""}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
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
              <Field key={s.key} field={s} value={form[s.key]} onChange={(v) => setField(s.key, v)} />
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving} data-testid={`save-${entity}-btn`} className="bg-[#0B132B] hover:bg-[#1C2541] text-white">
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
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

function Field({ field, value, onChange }) {
  const full = field.full || field.type === "textarea" || field.type === "switch";
  const listVal = field.type === "list" ? (Array.isArray(value) ? value.join(", ") : (value || "")) : value;

  return (
    <div className={full ? "sm:col-span-2" : ""}>
      {field.type !== "switch" && <Label className="mb-1.5 block text-sm">{field.label}{field.req && <span className="text-[#E89D93]"> *</span>}</Label>}
      {field.type === "textarea" ? (
        <Textarea data-testid={`field-${field.key}`} rows={field.rows || 3} value={value || ""} onChange={(e) => onChange(e.target.value)} />
      ) : field.type === "switch" ? (
        <div className="flex items-center justify-between rounded-lg bg-[#FAF7F2] px-3 py-2.5 h-full">
          <Label className="cursor-pointer text-sm">{field.label}</Label>
          <Switch data-testid={`field-${field.key}`} checked={!!value} onCheckedChange={onChange} />
        </div>
      ) : field.type === "image" ? (
        <ImageField value={value} onChange={onChange} testid={`field-${field.key}`} />
      ) : field.type === "island" ? (
        <Select value={value || ""} onValueChange={onChange}>
          <SelectTrigger data-testid={`field-${field.key}`}><SelectValue placeholder="Select island" /></SelectTrigger>
          <SelectContent>
            {ISLAND_OPTS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
      ) : field.type === "select" ? (
        <Select value={value || ""} onValueChange={onChange}>
          <SelectTrigger data-testid={`field-${field.key}`}><SelectValue placeholder="Select" /></SelectTrigger>
          <SelectContent>
            {field.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
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
