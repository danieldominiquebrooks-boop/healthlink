import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Lock, Mail, ArrowLeft } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { formatApiError } from "@/lib/api";
import { toast } from "sonner";

export default function AdminLogin() {
  const { login, user, ready } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (ready && user) navigate("/admin/dashboard");
  }, [ready, user, navigate]);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
      toast.success("Welcome back!");
      navigate("/admin/dashboard");
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen hl-navy-gradient flex items-center justify-center px-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <button onClick={() => navigate("/")} className="flex items-center gap-1.5 text-slate-300 hover:text-white text-sm mb-6"><ArrowLeft size={16} /> Back to site</button>
        <div className="bg-white rounded-3xl p-8 shadow-2xl">
          <div className="flex justify-center mb-6"><Logo dark={false} /></div>
          <h1 className="font-display text-2xl font-bold text-[#0F172A] text-center">Admin Login</h1>
          <p className="text-center text-muted-foreground text-sm mt-1">Manage your healthcare platform</p>
          <form onSubmit={submit} className="mt-7 space-y-4">
            <div>
              <Label htmlFor="email" className="mb-1.5 block">Email</Label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#E89D93]" />
                <Input id="email" data-testid="admin-email-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10" placeholder="admin@example.com" required />
              </div>
            </div>
            <div>
              <Label htmlFor="password" className="mb-1.5 block">Password</Label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#E89D93]" />
                <Input id="password" data-testid="admin-password-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10" placeholder="••••••••" required />
              </div>
            </div>
            <Button type="submit" disabled={loading} data-testid="admin-login-submit" className="w-full bg-[#0B132B] hover:bg-[#1C2541] text-white h-11">
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
