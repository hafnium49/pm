"use client";

import { useEffect, useState, type FormEvent } from "react";
import clsx from "clsx";
import type { BoardRole, Member } from "@/lib/kanban";
import { CloseIcon, TrashIcon, UsersIcon } from "@/components/icons";

type Props = {
  open: boolean;
  boardName: string;
  members: Member[];
  loading: boolean;
  currentRole: BoardRole;
  currentUserId: string | null;
  onClose: () => void;
  onInvite: (username: string, role: Exclude<BoardRole, "owner">) => Promise<void>;
  onChangeRole: (userId: string, role: Exclude<BoardRole, "owner">) => Promise<void>;
  onRemove: (userId: string) => Promise<void>;
};

const ROLE_LABEL: Record<BoardRole, string> = {
  owner: "Owner",
  editor: "Editor",
  viewer: "Viewer",
};

const ROLE_CLASS: Record<BoardRole, string> = {
  owner: "bg-[var(--secondary-purple)]/10 text-[var(--secondary-purple)]",
  editor: "bg-emerald-100 text-emerald-800",
  viewer: "bg-slate-200 text-slate-700",
};

export const MembersModal = ({
  open,
  boardName,
  members,
  loading,
  currentRole,
  currentUserId,
  onClose,
  onInvite,
  onChangeRole,
  onRemove,
}: Props) => {
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<Exclude<BoardRole, "owner">>("editor");
  const [inviteState, setInviteState] = useState<
    { kind: "idle" } | { kind: "saving" } | { kind: "error"; message: string }
  >({ kind: "idle" });

  useEffect(() => {
    if (!open) {
      setInviteName("");
      setInviteRole("editor");
      setInviteState({ kind: "idle" });
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const isOwner = currentRole === "owner";

  const handleInvite = async (e: FormEvent) => {
    e.preventDefault();
    const name = inviteName.trim();
    if (!name) return;
    setInviteState({ kind: "saving" });
    try {
      await onInvite(name, inviteRole);
      setInviteName("");
      setInviteRole("editor");
      setInviteState({ kind: "idle" });
    } catch (err) {
      setInviteState({
        kind: "error",
        message: err instanceof Error ? err.message : "Could not invite",
      });
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Board members"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(3,33,71,0.45)] backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[var(--stroke)] bg-white shadow-[var(--shadow)]">
        <header className="flex items-center justify-between gap-3 border-b border-[var(--stroke)] px-5 py-3">
          <div className="inline-flex items-center gap-2 text-[var(--navy-dark)]">
            <UsersIcon className="text-[var(--gray-text)]" />
            <h2 className="text-[11px] font-bold uppercase tracking-[0.2em]">
              Members
            </h2>
            <span className="text-[11px] font-semibold text-[var(--gray-text)]">
              · {boardName}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close members"
            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[var(--gray-text)] hover:bg-[var(--surface)] hover:text-[var(--navy-dark)]"
          >
            <CloseIcon width={14} height={14} />
          </button>
        </header>

        <div className="space-y-4 overflow-y-auto px-5 py-4">
          {/* MEMBER LIST */}
          {loading ? (
            <p className="text-center text-sm text-[var(--gray-text)]">Loading…</p>
          ) : (
            <ul className="space-y-2">
              {members.map((m) => {
                const isSelf = m.user_id === currentUserId;
                const canChangeRole = isOwner && !m.is_owner;
                const canRemove = !m.is_owner && (isOwner || isSelf);
                return (
                  <li
                    key={m.user_id}
                    data-testid={`member-${m.user_id}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[var(--stroke)] bg-white px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--navy-dark)]">
                        {m.username}
                        {isSelf && (
                          <span className="ml-2 text-[11px] font-medium text-[var(--gray-text)]">
                            (you)
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {canChangeRole ? (
                        <select
                          aria-label={`Role for ${m.username}`}
                          value={m.role}
                          onChange={(e) =>
                            onChangeRole(
                              m.user_id,
                              e.target.value as Exclude<BoardRole, "owner">,
                            )
                          }
                          className="rounded-full border border-[var(--stroke)] bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
                        >
                          <option value="editor">Editor</option>
                          <option value="viewer">Viewer</option>
                        </select>
                      ) : (
                        <span
                          className={clsx(
                            "rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
                            ROLE_CLASS[m.role]
                          )}
                        >
                          {ROLE_LABEL[m.role]}
                        </span>
                      )}
                      {canRemove && (
                        <button
                          type="button"
                          aria-label={isSelf ? "Leave board" : `Remove ${m.username}`}
                          onClick={() => onRemove(m.user_id)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[var(--gray-text)] transition hover:bg-red-50 hover:text-red-600"
                          title={isSelf ? "Leave board" : "Remove member"}
                        >
                          <TrashIcon width={12} height={12} />
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {/* INVITE FORM (owner only) */}
          {isOwner && (
            <section aria-labelledby="invite-heading" className="space-y-2 rounded-xl border border-dashed border-[var(--stroke)] p-3">
              <h3 id="invite-heading" className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--gray-text)]">
                Invite by username
              </h3>
              <form onSubmit={handleInvite} className="flex flex-wrap items-center gap-2">
                <input
                  aria-label="Member username"
                  type="text"
                  placeholder="Username"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  required
                  className="min-w-[160px] flex-1 rounded-lg border border-[var(--stroke)] px-3 py-1.5 text-sm text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
                />
                <select
                  aria-label="Invite role"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as Exclude<BoardRole, "owner">)}
                  className="rounded-lg border border-[var(--stroke)] bg-white px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
                >
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
                <button
                  type="submit"
                  disabled={!inviteName.trim() || inviteState.kind === "saving"}
                  className="rounded-full bg-[var(--secondary-purple)] px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-white disabled:opacity-50"
                >
                  {inviteState.kind === "saving" ? "Inviting…" : "Invite"}
                </button>
              </form>
              {inviteState.kind === "error" && (
                <p data-testid="invite-error" className="text-xs text-red-600">
                  {inviteState.message}
                </p>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
};
