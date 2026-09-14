import React, { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { StarRating } from "@/components/StarRating";
import api, { formatApiError } from "@/lib/api";
import { toast } from "sonner";

export function ReviewModal({ open, onOpenChange, provider }) {
  const [rating, setRating] = useState(0);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setRating(0); setName(""); setTitle(""); setComment(""); setVerified(false);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!rating) return toast.error("Please select a star rating.");
    if (!name.trim() || !comment.trim()) return toast.error("Please add your name and review.");
    setLoading(true);
    try {
      const { data } = await api.post("/reviews", {
        provider_id: provider.id,
        author_name: name.trim(),
        rating,
        title: title.trim(),
        comment: comment.trim(),
        island: provider.island || "",
        verified_patient: verified,
      });
      toast.success(data.message || "Review submitted for approval.");
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="review-modal">
        <DialogHeader>
          <DialogTitle className="font-display">Write a review</DialogTitle>
          <DialogDescription>
            Share your experience with {provider?.name}. Reviews are published after approval by our team.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label className="mb-1.5 block">Your rating</Label>
            <StarRating value={rating} interactive onSelect={setRating} size={28} />
          </div>
          <div>
            <Label htmlFor="rev-name" className="mb-1.5 block">Your name</Label>
            <Input id="rev-name" data-testid="review-name-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Samantha R." />
          </div>
          <div>
            <Label htmlFor="rev-title" className="mb-1.5 block">Title <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input id="rev-title" data-testid="review-title-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Excellent care" />
          </div>
          <div>
            <Label htmlFor="rev-comment" className="mb-1.5 block">Your review</Label>
            <Textarea id="rev-comment" data-testid="review-comment-input" value={comment} onChange={(e) => setComment(e.target.value)} rows={4} placeholder="Tell others about your experience..." />
          </div>
          <div className="flex items-center justify-between rounded-lg bg-[#FAF7F2] px-3 py-2.5">
            <Label htmlFor="rev-verified" className="cursor-pointer">I am a verified patient</Label>
            <Switch id="rev-verified" data-testid="review-verified-switch" checked={verified} onCheckedChange={setVerified} />
          </div>
          <Button type="submit" disabled={loading} data-testid="submit-review-btn" className="w-full bg-[#E89D93] hover:bg-[#e08b80] text-white">
            {loading ? "Submitting..." : "Submit review"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
