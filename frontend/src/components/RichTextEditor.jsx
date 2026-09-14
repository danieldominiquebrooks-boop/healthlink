import React, { useRef, useEffect } from "react";
import { Bold, Italic, Heading2, Heading3, List, ListOrdered, Link2, Pilcrow, ImagePlus } from "lucide-react";
import api, { formatApiError } from "@/lib/api";
import { toast } from "sonner";

export function RichTextEditor({ value, onChange, testid }) {
  const ref = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== (value || "")) {
      ref.current.innerHTML = value || "";
    }
    // set once on mount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sync = () => onChange(ref.current.innerHTML);

  const exec = (cmd, arg) => {
    ref.current.focus();
    document.execCommand(cmd, false, arg);
    sync();
  };

  const addLink = () => {
    const url = window.prompt("Enter the link URL (include https://)");
    if (url) exec("createLink", url);
  };

  const insertImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      const { data } = await api.post("/admin/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      ref.current.focus();
      document.execCommand("insertImage", false, `${process.env.REACT_APP_BACKEND_URL}${data.url}`);
      sync();
      toast.success("Image inserted");
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const Btn = ({ onClick, title, children, tid }) => (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={title}
      data-testid={tid}
      className="w-8 h-8 flex items-center justify-center rounded-md text-[#0F172A] hover:bg-[#FDF0EE] transition-colors"
    >
      {children}
    </button>
  );

  return (
    <div className="rounded-lg border border-input overflow-hidden" data-testid={testid}>
      <div className="flex flex-wrap items-center gap-0.5 border-b border-input bg-[#FAF7F2] px-2 py-1.5">
        <Btn onClick={() => exec("formatBlock", "<h2>")} title="Heading" tid="rte-h2"><Heading2 size={16} /></Btn>
        <Btn onClick={() => exec("formatBlock", "<h3>")} title="Subheading" tid="rte-h3"><Heading3 size={16} /></Btn>
        <Btn onClick={() => exec("formatBlock", "<p>")} title="Paragraph"><Pilcrow size={15} /></Btn>
        <span className="w-px h-5 bg-input mx-1" />
        <Btn onClick={() => exec("bold")} title="Bold" tid="rte-bold"><Bold size={15} /></Btn>
        <Btn onClick={() => exec("italic")} title="Italic"><Italic size={15} /></Btn>
        <span className="w-px h-5 bg-input mx-1" />
        <Btn onClick={() => exec("insertUnorderedList")} title="Bullet list" tid="rte-ul"><List size={16} /></Btn>
        <Btn onClick={() => exec("insertOrderedList")} title="Numbered list"><ListOrdered size={16} /></Btn>
        <Btn onClick={addLink} title="Insert link" tid="rte-link"><Link2 size={15} /></Btn>
        <Btn onClick={() => fileRef.current?.click()} title="Insert image" tid="rte-image"><ImagePlus size={15} /></Btn>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={insertImage} data-testid="rte-image-file" />
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={sync}
        data-testid={`${testid}-area`}
        className="hl-prose min-h-[180px] max-h-[360px] overflow-y-auto px-3 py-2.5 text-sm outline-none bg-card"
      />
    </div>
  );
}
