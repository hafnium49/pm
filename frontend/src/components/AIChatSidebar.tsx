"use client";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { sendChatMessage, type ChatMessage } from "@/lib/api";
import { CloseIcon, SendIcon, SparkleIcon } from "@/components/icons";

interface Props {
  boardId: string | null;
  onRefresh: () => Promise<void>;
  onClose: () => void;
}

export const AIChatSidebar = ({ boardId, onRefresh, onClose }: Props) => {
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
      const res = await sendChatMessage(next, boardId ?? undefined);
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
      className="flex h-screen w-80 shrink-0 flex-col border-l border-[var(--stroke)] bg-white/97 shadow-[-4px_0_24px_rgba(0,0,0,0.06)]"
    >
      <div className="flex items-center justify-between gap-2 border-b border-[var(--stroke)] px-4 py-3">
        <div className="inline-flex items-center gap-2 text-[var(--navy-dark)]">
          <SparkleIcon className="text-[var(--secondary-purple)]" />
          <h2 className="m-0 text-[11px] font-bold uppercase tracking-[0.2em]">
            AI Assistant
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close AI assistant"
          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[var(--gray-text)] transition hover:bg-[var(--surface)] hover:text-[var(--navy-dark)]"
        >
          <CloseIcon width={14} height={14} />
        </button>
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

      <div className="flex items-center gap-2 border-t border-[var(--stroke)] px-3 py-3">
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
          className="flex-1 rounded-full border border-[var(--stroke)] bg-[var(--surface)] px-4 py-2 text-[13px] text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
        />
        <button
          onClick={send}
          disabled={disabled}
          aria-label="Send"
          name="Send"
          className={clsx(
            "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--secondary-purple)] text-white transition",
            disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:brightness-110"
          )}
        >
          <SendIcon width={16} height={16} />
        </button>
      </div>
    </aside>
  );
};
