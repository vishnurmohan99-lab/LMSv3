"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import { Image } from "@tiptap/extension-image";
import { Extension } from "@tiptap/core";
import { useEffect, useRef } from "react";
import { uploadsApi } from "@/lib/api";

const FontSize = Extension.create({
  name: "fontSize",
  addGlobalAttributes() {
    return [
      {
        types: ["textStyle"],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.fontSize || null,
            renderHTML: (attributes: { fontSize?: string | null }) => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
        },
      },
    ];
  },
});

const btnStyle = (active: boolean): React.CSSProperties => ({
  width: 30,
  height: 30,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid " + (active ? "var(--orange)" : "var(--line)"),
  background: active ? "var(--orange-soft)" : "var(--card)",
  color: active ? "var(--orange)" : "var(--ink2)",
  borderRadius: 7,
  fontSize: 13,
  fontWeight: 700,
  fontFamily: "inherit",
  cursor: "pointer",
});

export default function RichTextEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit, Underline, TextStyle, FontSize, Image],
    content: value,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  if (!editor) return null;

  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const url = await uploadsApi.uploadQuestionImage(file);
    editor?.chain().focus().setImage({ src: url }).run();
  }

  return (
    <div style={{ border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden" }}>
      <div style={{ display: "flex", gap: 6, padding: 8, borderBottom: "1px solid var(--line)", background: "var(--bg)", flexWrap: "wrap" }}>
        <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} style={btnStyle(editor.isActive("bold"))}>
          B
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} style={{ ...btnStyle(editor.isActive("italic")), fontStyle: "italic" }}>
          I
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          style={{ ...btnStyle(editor.isActive("underline")), textDecoration: "underline" }}
        >
          U
        </button>
        <select
          defaultValue=""
          onChange={(e) => {
            const size = e.target.value;
            if (!size) {
              editor.chain().focus().setMark("textStyle", { fontSize: null }).run();
            } else {
              editor.chain().focus().setMark("textStyle", { fontSize: size }).run();
            }
          }}
          style={{ ...btnStyle(false), width: "auto", padding: "0 6px" }}
        >
          <option value="">Size</option>
          <option value="13px">Small</option>
          <option value="16px">Normal</option>
          <option value="20px">Large</option>
          <option value="28px">Huge</option>
        </select>
        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} style={btnStyle(editor.isActive("bulletList"))}>
          •—
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} style={btnStyle(editor.isActive("orderedList"))}>
          1.
        </button>
        <button type="button" onClick={() => fileInputRef.current?.click()} style={btnStyle(false)}>
          🖼
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={onPickImage} style={{ display: "none" }} />
      </div>
      <div style={{ padding: 12, minHeight: 120 }}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
