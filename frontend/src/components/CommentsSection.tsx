"use client";

import { useState } from "react";
import type { Comment } from "@/lib/kanban";
import { TrashIcon } from "@/components/icons";

type Props = {
  comments: Comment[];
  currentUsername: string | null;
  posting: boolean;
  onPost: (body: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
};

function formatRelative(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export const CommentsSection = ({
  comments,
  currentUsername,
  posting,
  onPost,
  onDelete,
}: Props) => {
  // CommentsSection mounts/unmounts with the parent CardDetailModal, so the
  // draft body is reset naturally per card-open — no reset effect needed.
  const [body, setBody] = useState("");

  const handleSubmit = async () => {
    const text = body.trim();
    if (!text || posting) return;
    await onPost(text);
    setBody("");
  };

  return (
    <div data-testid="comments-section" className="space-y-3">
      <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--gray-text)]">
        Comments
      </span>

      <ul className="space-y-2">
        {comments.length === 0 ? (
          <li className="rounded-lg border border-dashed border-[var(--stroke)] px-3 py-3 text-center text-[12px] text-[var(--gray-text)]">
            No comments yet.
          </li>
        ) : (
          comments.map((c) => {
            const mine = currentUsername !== null && c.author_username === currentUsername;
            return (
              <li
                key={c.id}
                data-testid={`comment-${c.id}`}
                className="group rounded-lg border border-[var(--stroke)] bg-[var(--surface)] px-3 py-2"
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[12px] font-semibold text-[var(--navy-dark)]">
                      {c.author_username}
                    </span>
                    <time
                      title={c.created_at}
                      className="text-[11px] text-[var(--gray-text)]"
                    >
                      {formatRelative(c.created_at)}
                    </time>
                  </div>
                  {mine && (
                    <button
                      type="button"
                      onClick={() => onDelete(c.id)}
                      aria-label={`Delete comment ${c.id}`}
                      className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[var(--gray-text)] opacity-0 transition hover:bg-red-50 hover:text-red-600 focus:opacity-100 group-hover:opacity-100"
                    >
                      <TrashIcon width={11} height={11} />
                    </button>
                  )}
                </div>
                <p className="whitespace-pre-wrap text-[13px] leading-[1.5] text-[var(--navy-dark)]">
                  {c.body}
                </p>
              </li>
            );
          })
        )}
      </ul>

      <div>
        <label htmlFor="new-comment" className="sr-only">
          New comment
        </label>
        <textarea
          id="new-comment"
          aria-label="New comment"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder="Write a comment… (Ctrl+Enter to submit)"
          rows={2}
          maxLength={4000}
          className="w-full resize-none rounded-lg border border-[var(--stroke)] bg-white px-3 py-2 text-sm leading-6 text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
        />
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={posting || !body.trim()}
            className="rounded-full bg-[var(--secondary-purple)] px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-white transition hover:brightness-110 disabled:opacity-50"
          >
            {posting ? "Posting…" : "Comment"}
          </button>
        </div>
      </div>
    </div>
  );
};
