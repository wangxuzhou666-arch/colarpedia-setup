"use client";

import { useState, useRef, useEffect } from "react";
import { stripWikilinks, countWikilinks } from "../lib/wikilinks";

export default function WikiTextarea({
  value,
  onChange,
  onBlur,
  rows = 5,
  placeholder = "",
  className = "setup-textarea",
  id,
  "aria-describedby": ariaDescribedBy,
  inputRef,
}) {
  const [editing, setEditing] = useState(false);
  const textareaRef = useRef(null);
  const safeValue = value ?? "";
  const rendered = stripWikilinks(safeValue);
  const linkCount = countWikilinks(safeValue);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, [editing]);

  if (editing) {
    return (
      <div className="wiki-textarea-wrap">
        <textarea
          id={id}
          ref={(el) => {
            textareaRef.current = el;
            if (typeof inputRef === "function") inputRef(el);
            else if (inputRef && "current" in inputRef) inputRef.current = el;
          }}
          value={safeValue}
          onChange={onChange}
          onBlur={(e) => {
            setEditing(false);
            onBlur?.(e);
          }}
          rows={rows}
          placeholder={placeholder}
          className={className}
          aria-describedby={ariaDescribedBy}
        />
        <div className="wiki-textarea-mode-hint">
          编辑模式 — <code>[[Slug]]</code> 是跨页跳转锚点,删除会断链接。点击其他区域退出编辑。
        </div>
      </div>
    );
  }

  return (
    <div className="wiki-textarea-wrap">
      <div
        className={`${className} wiki-textarea-display`}
        role="textbox"
        tabIndex={0}
        onClick={() => setEditing(true)}
        onFocus={() => setEditing(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " " || e.key.length === 1) {
            setEditing(true);
          }
        }}
        aria-describedby={ariaDescribedBy}
        style={{
          minHeight: `${rows * 1.5}em`,
          whiteSpace: "pre-wrap",
          cursor: "text",
          color: rendered ? "inherit" : "var(--wiki-text-soft)",
        }}
      >
        {rendered || placeholder}
      </div>
      {linkCount > 0 && (
        <div className="wiki-textarea-mode-hint">
          含 {linkCount} 个跨页跳转 · 点这里编辑
        </div>
      )}
    </div>
  );
}
