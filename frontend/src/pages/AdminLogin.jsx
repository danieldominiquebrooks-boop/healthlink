import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Lock, Mail, ArrowLeft, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { formatApiError } from "@/lib/api";
import { toast } from "sonner";

export default function AdminLogin() {
  const { login, verify2fa, user, ready } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState("creds"); // creds | code
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [challenge, setChallenge] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (ready && user) navigate("/admin/dashboard");
  }, [ready, user, navigate]);

  const submitCreds = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await login(email.trim().toLowerCase(), password);
      if (data?.requires_2fa) {
        setChallenge(data.challenge);
        setMaskedEmail(data.email);
        setStep("code");
        toast.success("We emailed you a 6-digit code.");
      }
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  const submitCode = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await verify2fa(challenge, code.trim());
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
        <button onClick={() => (step === "code" ? setStep("creds") : navigate("/"))} className="flex items-center gap-1.5 text-slate-300 hover:text-white text-sm mb-6">
          <ArrowLeft size={16} /> {step === "code" ? "Back" : "Back to site"}
        </button>
        <div className="bg-white rounded-3xl p-8 shadow-2xl">
          <div className="flex justify-center mb-6"><Logo dark={false} /></div>

          {step === "creds" ? (
            <>
              <h1 className="font-display text-2xl font-bold text-[#0F172A] text-center">Admin Login</h1>
              <p className="text-center text-muted-foreground text-sm mt-1">Manage your healthcare platform</p>
              <form onSubmit={submitCreds} className="mt-7 space-y-4">
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
                    <Input id="password" data-testid="admin-password-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10" placeholder="********" required />
                  </div>
                </div>
                <Button type="submit" disabled={loading} data-testid="admin-login-submit" className="w-full bg-[#0B132B] hover:bg-[#1C2541] text-white h-11">
                  {loading ? "Sending code..." : "Continue"}
                </Button>
              </form>
            </>
          ) : (
            <>
              <div className="flex justify-center"><span className="w-12 h-12 rounded-full bg-[#FDF7E7] flex items-center justify-center text-[#B8912B]"><ShieldCheck size={22} /></span></div>
              <h1 className="font-display text-2xl font-bold text-[#0F172A] text-center mt-3">Enter your code</h1>
              <p className="text-center text-muted-foreground text-sm mt-1">We sent a 6-digit code to <span className="font-semibold text-[#0F172A]">{maskedEmail}</span></p>
              <form onSubmit={submitCode} className="mt-7 space-y-4">
                <div>
                  <Label htmlFor="code" className="mb-1.5 block">Verification code</Label>
                  <Input id="code" data-testid="admin-2fa-input" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className="text-center text-2xl tracking-[0.5em] font-bold" placeholder="000000" required />
                </div>
                <Button type="submit" disabled={loading} data-testid="admin-2fa-submit" className="w-full bg-[#0B132B] hover:bg-[#1C2541] text-white h-11">
                  {loading ? "Verifying..." : "Verify & sign in"}
                </Button>
                <button type="button" onClick={submitCreds} disabled={loading} className="w-full text-xs text-muted-foreground hover:text-[#0F172A]">Didn't get it? Resend code</button>
              </form>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
