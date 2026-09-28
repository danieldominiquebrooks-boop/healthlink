import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Check, PartyPopper } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import api, { formatApiError } from "@/lib/api";
import { toast } from "sonner";

const AGE_RANGES = ["Under 18", "18-29", "30-39", "40-49", "50-59", "60+"];

// Site-wide quiz popup. Shows the active quiz after its configured delay.
// Once per visit (session), never again on a device that already completed it.
export function QuizModal() {
  const [quiz, setQuiz] = useState(null);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0); // 0 name/email, 1 age, 2..N questions, then submit
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [age, setAge] = useState("");
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let timer;
    api.get("/quiz/active").then((r) => {
      const q = r.data;
      if (!q || !q.id) return;
      if (sessionStorage.getItem("hl_quiz_dismissed")) return;
      if (localStorage.getItem(`hl_quiz_done_${q.id}`)) return;
      setQuiz(q);
      timer = setTimeout(() => setOpen(true), (q.popup_delay_seconds || 10) * 1000);
    }).catch(() => {});
    return () => timer && clearTimeout(timer);
  }, []);

  if (!quiz) return null;

  const questions = quiz.questions || [];
  const totalSteps = 2 + questions.length;
  const progress = Math.round(((step + 1) / totalSteps) * 100);

  const dismiss = () => {
    sessionStorage.setItem("hl_quiz_dismissed", "1");
    setOpen(false);
  };

  const next = () => {
    if (step === 0) {
      if (!name.trim()) return toast.error("Please enter your name.");
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) return toast.error("Please enter a valid email.");
    }
    if (step === 1 && !age) return toast.error("Please select your age range.");
    if (step >= 2) {
      const q = questions[step - 2];
      if (!answers[q.id]) return toast.error("Please pick an answer.");
    }
    if (step < totalSteps - 1) setStep(step + 1);
    else submit();
  };

  const submit = async () => {
    setLoading(true);
    try {
      const { data } = await api.post("/quiz/submit", {
        quiz_id: quiz.id,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        age,
        answers: questions.map((q) => ({ question_id: q.id, question: q.text, answer: answers[q.id] || "" })),
      });
      localStorage.setItem(`hl_quiz_done_${quiz.id}`, "1");
      localStorage.setItem("hl_subscribed", "1");
      toast.success(data.message || "Thanks for completing the quiz!");
      setOpen(false);
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) dismiss(); }}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden border-0 rounded-3xl" data-testid="quiz-modal">
        <DialogTitle className="sr-only">{quiz.title}</DialogTitle>
        {/* Colorful gradient header */}
        <div className="relative bg-gradient-to-br from-[#E89D93] via-[#EFB6A0] to-[#D4AF37] px-6 pt-7 pb-6 text-center overflow-hidden">
          <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full bg-white/15" />
          <div className="absolute -bottom-10 -left-6 w-24 h-24 rounded-full bg-white/10" />
          <motion.span
            initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 16 }}
            className="relative inline-flex w-14 h-14 rounded-2xl bg-white/95 items-center justify-center text-[#E89D93] shadow-lg"
          >
            <Sparkles size={26} />
          </motion.span>
          <h2 className="relative mt-3 font-display text-2xl font-extrabold text-white drop-shadow-sm">{quiz.title}</h2>
          <p className="relative mt-1 text-sm text-white/90">
            {step === 0 ? (quiz.description || "Take our fun quiz & get your results by email!") : `Step ${step + 1} of ${totalSteps}`}
          </p>
          {/* progress bar */}
          <div className="relative mt-4 h-2 rounded-full bg-white/25 overflow-hidden">
            <motion.div className="h-full rounded-full bg-white" animate={{ width: `${progress}%` }} transition={{ duration: 0.35 }} />
          </div>
        </div>

        <div className="px-6 py-5 space-y-4 bg-white">
          {step === 0 && (
            <>
              <div>
                <Label className="mb-1.5 block text-sm font-semibold text-[#0B132B]">Your name</Label>
                <Input data-testid="quiz-name-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" className="h-11 rounded-xl" />
              </div>
              <div>
                <Label className="mb-1.5 block text-sm font-semibold text-[#0B132B]">Email address</Label>
                <Input data-testid="quiz-email-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="h-11 rounded-xl" />
              </div>
            </>
          )}

          {step === 1 && (
            <div>
              <Label className="mb-1.5 block text-sm font-semibold text-[#0B132B]">Your age range</Label>
              <Select value={age} onValueChange={setAge}>
                <SelectTrigger data-testid="quiz-age-select" className="h-11 rounded-xl"><SelectValue placeholder="Select age range" /></SelectTrigger>
                <SelectContent>
                  {AGE_RANGES.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {step >= 2 && (() => {
            const q = questions[step - 2];
            const palette = ["#E89D93", "#D4AF37", "#5AA9A3", "#7C83E8", "#E8956B", "#C77DAE"];
            return (
              <motion.div key={q.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
                <p className="font-display font-bold text-lg text-[#0B132B] mb-3">{q.text}</p>
                <div className="space-y-2.5" data-testid="quiz-options">
                  {(q.options || []).map((opt, i) => {
                    const selected = answers[q.id] === opt;
                    const c = palette[i % palette.length];
                    return (
                      <motion.button
                        key={i}
                        type="button"
                        whileTap={{ scale: 0.97 }}
                        data-testid={`quiz-option-${i}`}
                        onClick={() => setAnswers((p) => ({ ...p, [q.id]: opt }))}
                        className="w-full flex items-center gap-3 text-left px-4 py-3 rounded-2xl border-2 transition-all"
                        style={{
                          borderColor: selected ? c : "#EEE",
                          background: selected ? `${c}1A` : "#fff",
                          boxShadow: selected ? `0 4px 14px ${c}33` : "none",
                        }}
                      >
                        <span className="w-6 h-6 rounded-full flex items-center justify-center border-2 shrink-0 text-white"
                          style={{ background: selected ? c : "#fff", borderColor: selected ? c : "#D8D8D8" }}>
                          {selected && <Check size={14} />}
                        </span>
                        <span className="text-sm font-medium text-[#334155]">{opt}</span>
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            );
          })()}

          <Button onClick={next} disabled={loading} data-testid="quiz-next-btn"
            className="w-full h-12 rounded-xl text-white font-bold text-base bg-gradient-to-r from-[#E89D93] to-[#D4AF37] hover:opacity-95 transition-opacity shadow-lg">
            {loading ? "Submitting..." : step < totalSteps - 1 ? "Continue" : (<span className="inline-flex items-center gap-2"><PartyPopper size={18} /> Submit &amp; get results</span>)}
          </Button>
          <div className="text-center">
            <button type="button" onClick={dismiss} data-testid="quiz-dismiss-btn" className="text-xs text-muted-foreground hover:text-[#0F172A]">No thanks</button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
