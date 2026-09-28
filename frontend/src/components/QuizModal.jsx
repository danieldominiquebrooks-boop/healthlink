import React, { useEffect, useState } from "react";
import { ClipboardList, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
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
      <DialogContent className="sm:max-w-md" data-testid="quiz-modal">
        <DialogHeader>
          <div className="flex justify-center mb-2">
            <span className="w-12 h-12 rounded-2xl bg-[#FDF7E7] flex items-center justify-center text-[#B8912B]"><ClipboardList size={24} /></span>
          </div>
          <DialogTitle className="font-display text-center text-xl">{quiz.title}</DialogTitle>
          <DialogDescription className="text-center">
            {step === 0 ? (quiz.description || "Take a quick quiz and get your results by email.") : `Step ${step + 1} of ${totalSteps}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {step === 0 && (
            <>
              <div>
                <Label className="mb-1.5 block text-sm">Your name</Label>
                <Input data-testid="quiz-name-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" className="h-11" />
              </div>
              <div>
                <Label className="mb-1.5 block text-sm">Email address</Label>
                <Input data-testid="quiz-email-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="h-11" />
              </div>
            </>
          )}

          {step === 1 && (
            <div>
              <Label className="mb-1.5 block text-sm">Your age range</Label>
              <Select value={age} onValueChange={setAge}>
                <SelectTrigger data-testid="quiz-age-select" className="h-11"><SelectValue placeholder="Select age range" /></SelectTrigger>
                <SelectContent>
                  {AGE_RANGES.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {step >= 2 && (() => {
            const q = questions[step - 2];
            return (
              <div>
                <p className="font-medium text-[#0F172A] mb-3">{q.text}</p>
                <div className="space-y-2" data-testid="quiz-options">
                  {(q.options || []).map((opt, i) => {
                    const selected = answers[q.id] === opt;
                    return (
                      <button
                        key={i}
                        type="button"
                        data-testid={`quiz-option-${i}`}
                        onClick={() => setAnswers((p) => ({ ...p, [q.id]: opt }))}
                        className={`w-full flex items-center gap-3 text-left px-4 py-3 rounded-xl border transition-colors ${selected ? "border-[#E89D93] bg-[#FDF0EE]" : "border-slate-200 hover:border-[#E89D93]/50"}`}
                      >
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center border ${selected ? "bg-[#E89D93] border-[#E89D93] text-white" : "border-slate-300"}`}>
                          {selected && <Check size={13} />}
                        </span>
                        <span className="text-sm text-[#334155]">{opt}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          <Button onClick={next} disabled={loading} data-testid="quiz-next-btn" className="w-full bg-[#0B132B] hover:bg-[#1C2541] text-white h-11">
            {loading ? "Submitting..." : step < totalSteps - 1 ? "Continue" : "Submit & get results"}
          </Button>
          <div className="text-center">
            <button type="button" onClick={dismiss} data-testid="quiz-dismiss-btn" className="text-xs text-muted-foreground hover:text-[#0F172A]">No thanks</button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
