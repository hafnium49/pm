"use client";
import { useEffect, useRef, useState } from "react";
import { sendChatMessage, type ChatMessage } from "@/lib/api";

interface Props {
  onRefresh: () => Promise<void>;
}

export const AIChatSidebar = ({ onRefresh }: Props) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const userMsg: ChatMessage = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await sendChatMessage(next);
      setMessages([...next, { role: "assistant", content: res.message }]);
      if (res.board_updates.length > 0) await onRefresh();
    } catch {
      setMessages([
        ...next,
        { role: "assistant", content: "Sorry, something went wrong." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <aside
      data-testid="ai-sidebar"
      style={{
        position: "fixed",
        right: 0,
        top: 0,
        bottom: 0,
        width: "320px",
        zIndex: 40,
        display: "flex",
        flexDirection: "column",
        background: "rgba(255,255,255,0.97)",
        borderLeft: "1px solid var(--stroke)",
        boxShadow: "-4px 0 24px rgba(0,0,0,0.10)",
      }}
    >
      <div
        style={{
          borderBottom: "1px solid var(--stroke)",
          padding: "16px 20px",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--navy-dark)",
          }}
        >
          AI Assistant
        </h2>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        {messages.length === 0 && !loading && (
          <p
            style={{
              textAlign: "center",
              marginTop: "40px",
              fontSize: "13px",
              color: "var(--gray-text)",
            }}
          >
            Ask the AI to add, move, or edit cards.
          </p>
        )}
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div
              key={i}
              data-testid="ai-message-user"
              style={{
                alignSelf: "flex-end",
                maxWidth: "80%",
                background: "var(--primary-blue)",
                color: "#fff",
                borderRadius: "16px 16px 4px 16px",
                padding: "10px 14px",
                fontSize: "13px",
                lineHeight: 1.5,
              }}
            >
              {m.content}
            </div>
          ) : (
            <div
              key={i}
              data-testid="ai-message-assistant"
              style={{
                alignSelf: "flex-start",
                maxWidth: "80%",
                background: "var(--surface)",
                color: "var(--navy-dark)",
                borderRadius: "16px 16px 16px 4px",
                padding: "10px 14px",
                fontSize: "13px",
                lineHeight: 1.5,
              }}
            >
              {m.content}
            </div>
          )
        )}
        {loading && (
          <div
            data-testid="ai-thinking"
            style={{
              alignSelf: "flex-start",
              maxWidth: "80%",
              background: "var(--surface)",
              color: "var(--gray-text)",
              borderRadius: "16px 16px 16px 4px",
              padding: "10px 14px",
              fontSize: "13px",
            }}
          >
            Thinking…
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div
        style={{
          borderTop: "1px solid var(--stroke)",
          padding: "12px 16px",
          display: "flex",
          gap: "8px",
        }}
      >
        <input
          aria-label="Message to AI"
          placeholder="Ask the AI…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          disabled={loading}
          style={{
            flex: 1,
            borderRadius: "20px",
            border: "1px solid var(--stroke)",
            background: "var(--surface)",
            padding: "8px 16px",
            fontSize: "13px",
            color: "var(--navy-dark)",
            outline: "none",
          }}
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          style={{
            borderRadius: "20px",
            background: "var(--purple-secondary)",
            color: "#fff",
            border: "none",
            padding: "8px 18px",
            fontSize: "13px",
            fontWeight: 600,
            cursor: loading || !input.trim() ? "not-allowed" : "pointer",
            opacity: loading || !input.trim() ? 0.5 : 1,
            transition: "opacity 0.2s",
          }}
        >
          Send
        </button>
      </div>
    </aside>
  );
};
