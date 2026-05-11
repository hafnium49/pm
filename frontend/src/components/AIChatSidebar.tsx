"use client";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
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

  const disabled = loading || !input.trim();

  return (
    <aside
      data-testid="ai-sidebar"
      className="fixed right-0 top-0 bottom-0 z-40 flex w-80 flex-col bg-white/97 border-l border-[var(--stroke)] shadow-[-4px_0_24px_rgba(0,0,0,0.10)]"
    >
      <div className="border-b border-[var(--stroke)] px-5 py-4">
        <h2 className="m-0 text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--navy-dark)]">
          AI Assistant
        </h2>
      </div>

      <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto p-4">
        {messages.length === 0 && !loading && (
          <p className="mt-10 text-center text-[13px] text-[var(--gray-text)]">
            Ask the AI to add, move, or edit cards.
          </p>
        )}
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div
              key={i}
              data-testid="ai-message-user"
              className="self-end max-w-[80%] rounded-[16px_16px_4px_16px] bg-[var(--primary-blue)] px-3.5 py-2.5 text-[13px] leading-normal text-white"
            >
              {m.content}
            </div>
          ) : (
            <div
              key={i}
              data-testid="ai-message-assistant"
              className="self-start max-w-[80%] rounded-[16px_16px_16px_4px] bg-[var(--surface)] px-3.5 py-2.5 text-[13px] leading-normal text-[var(--navy-dark)]"
            >
              {m.content}
            </div>
          )
        )}
        {loading && (
          <div
            data-testid="ai-thinking"
            className="self-start max-w-[80%] rounded-[16px_16px_16px_4px] bg-[var(--surface)] px-3.5 py-2.5 text-[13px] text-[var(--gray-text)]"
          >
            Thinking…
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2 border-t border-[var(--stroke)] px-4 py-3">
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
          className="flex-1 rounded-[20px] border border-[var(--stroke)] bg-[var(--surface)] px-4 py-2 text-[13px] text-[var(--navy-dark)] outline-none"
        />
        <button
          onClick={send}
          disabled={disabled}
          className={clsx(
            "rounded-[20px] border-none bg-[var(--secondary-purple)] px-[18px] py-2 text-[13px] font-semibold text-white transition-opacity duration-200",
            disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer opacity-100"
          )}
        >
          Send
        </button>
      </div>
    </aside>
  );
};
