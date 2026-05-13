"use client";

import { useEffect, useState, type FormEvent } from "react";
import { CloseIcon, TrashIcon, UserIcon } from "@/components/icons";
import * as api from "@/lib/api";

type Props = {
  open: boolean;
  currentUsername: string | null;
  onClose: () => void;
  onUsernameChanged: (newUsername: string) => void;
  onAccountDeleted: () => void;
};

type SectionState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

const okMsg = (m: string): SectionState => ({ kind: "success", message: m });
const errMsg = (e: unknown): SectionState => ({
  kind: "error",
  message: e instanceof Error ? e.message : "Something went wrong",
});

export const AccountSettingsModal = ({
  open,
  currentUsername,
  onClose,
  onUsernameChanged,
  onAccountDeleted,
}: Props) => {
  // Change password
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwState, setPwState] = useState<SectionState>({ kind: "idle" });

  // Change username
  const [unNew, setUnNew] = useState("");
  const [unPassword, setUnPassword] = useState("");
  const [unState, setUnState] = useState<SectionState>({ kind: "idle" });

  // Delete account
  const [delPassword, setDelPassword] = useState("");
  const [delConfirmText, setDelConfirmText] = useState("");
  const [delState, setDelState] = useState<SectionState>({ kind: "idle" });

  // Modal unmounts when `open` is false (see early return below), so all form
  // state is re-initialized on each open — no explicit reset effect needed.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (pwNew !== pwConfirm) {
      setPwState({ kind: "error", message: "New passwords do not match." });
      return;
    }
    setPwState({ kind: "saving" });
    try {
      await api.changePassword(pwCurrent, pwNew);
      setPwState(okMsg("Password updated."));
      setPwCurrent("");
      setPwNew("");
      setPwConfirm("");
    } catch (e) {
      setPwState(errMsg(e));
    }
  };

  const handleChangeUsername = async (e: FormEvent) => {
    e.preventDefault();
    setUnState({ kind: "saving" });
    try {
      const newUsername = await api.changeUsername(unPassword, unNew.trim());
      onUsernameChanged(newUsername);
      setUnState(okMsg("Username updated."));
      setUnNew("");
      setUnPassword("");
    } catch (e) {
      setUnState(errMsg(e));
    }
  };

  const handleDelete = async (e: FormEvent) => {
    e.preventDefault();
    if (delConfirmText !== "delete my account") {
      setDelState({
        kind: "error",
        message: 'Type "delete my account" to confirm.',
      });
      return;
    }
    setDelState({ kind: "saving" });
    try {
      await api.deleteAccount(delPassword);
      onAccountDeleted();
    } catch (e) {
      setDelState(errMsg(e));
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Account settings"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(3,33,71,0.45)] backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[var(--stroke)] bg-white shadow-[var(--shadow)]">
        <header className="flex items-center justify-between gap-3 border-b border-[var(--stroke)] px-5 py-3">
          <div className="inline-flex items-center gap-2 text-[var(--navy-dark)]">
            <UserIcon className="text-[var(--gray-text)]" />
            <h2 className="text-[11px] font-bold uppercase tracking-[0.2em]">
              Account
            </h2>
            {currentUsername && (
              <span className="text-[11px] font-semibold text-[var(--gray-text)]">
                · {currentUsername}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close account settings"
            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[var(--gray-text)] hover:bg-[var(--surface)] hover:text-[var(--navy-dark)]"
          >
            <CloseIcon width={14} height={14} />
          </button>
        </header>

        <div className="space-y-6 overflow-y-auto px-5 py-4">
          {/* CHANGE PASSWORD */}
          <section aria-labelledby="acct-password-heading" className="space-y-2">
            <h3 id="acct-password-heading" className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--gray-text)]">
              Change password
            </h3>
            <form onSubmit={handleChangePassword} className="space-y-2">
              <input
                aria-label="Current password"
                type="password"
                autoComplete="current-password"
                placeholder="Current password"
                value={pwCurrent}
                onChange={(e) => setPwCurrent(e.target.value)}
                required
                className="w-full rounded-lg border border-[var(--stroke)] px-3 py-2 text-sm text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
              />
              <input
                aria-label="New password"
                type="password"
                autoComplete="new-password"
                placeholder="New password (8+ chars)"
                minLength={8}
                value={pwNew}
                onChange={(e) => setPwNew(e.target.value)}
                required
                className="w-full rounded-lg border border-[var(--stroke)] px-3 py-2 text-sm text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
              />
              <input
                aria-label="Confirm new password"
                type="password"
                autoComplete="new-password"
                placeholder="Confirm new password"
                minLength={8}
                value={pwConfirm}
                onChange={(e) => setPwConfirm(e.target.value)}
                required
                className="w-full rounded-lg border border-[var(--stroke)] px-3 py-2 text-sm text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
              />
              {pwState.kind === "error" && (
                <p data-testid="pw-error" className="text-xs text-red-600">{pwState.message}</p>
              )}
              {pwState.kind === "success" && (
                <p data-testid="pw-success" className="text-xs text-emerald-600">{pwState.message}</p>
              )}
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={pwState.kind === "saving"}
                  className="rounded-full bg-[var(--secondary-purple)] px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-white disabled:opacity-50"
                >
                  {pwState.kind === "saving" ? "Saving…" : "Save password"}
                </button>
              </div>
            </form>
          </section>

          {/* CHANGE USERNAME */}
          <section aria-labelledby="acct-username-heading" className="space-y-2">
            <h3 id="acct-username-heading" className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--gray-text)]">
              Change username
            </h3>
            <form onSubmit={handleChangeUsername} className="space-y-2">
              <input
                aria-label="New username"
                type="text"
                placeholder="New username (3-32 chars: a-Z, 0-9, _.-)"
                value={unNew}
                onChange={(e) => setUnNew(e.target.value)}
                minLength={3}
                maxLength={32}
                required
                className="w-full rounded-lg border border-[var(--stroke)] px-3 py-2 text-sm text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
              />
              <input
                aria-label="Confirm with password"
                type="password"
                autoComplete="current-password"
                placeholder="Current password"
                value={unPassword}
                onChange={(e) => setUnPassword(e.target.value)}
                required
                className="w-full rounded-lg border border-[var(--stroke)] px-3 py-2 text-sm text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
              />
              {unState.kind === "error" && (
                <p data-testid="un-error" className="text-xs text-red-600">{unState.message}</p>
              )}
              {unState.kind === "success" && (
                <p data-testid="un-success" className="text-xs text-emerald-600">{unState.message}</p>
              )}
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={unState.kind === "saving"}
                  className="rounded-full bg-[var(--secondary-purple)] px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-white disabled:opacity-50"
                >
                  {unState.kind === "saving" ? "Saving…" : "Save username"}
                </button>
              </div>
            </form>
          </section>

          {/* DELETE ACCOUNT */}
          <section
            aria-labelledby="acct-delete-heading"
            className="space-y-2 rounded-xl border border-red-200 bg-red-50/40 p-3"
          >
            <h3 id="acct-delete-heading" className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-red-700">
              <TrashIcon width={12} height={12} />
              Delete account
            </h3>
            <p className="text-[11px] text-red-700/80">
              Permanently removes you and all your boards, columns, cards, labels, and comments. This cannot be undone.
            </p>
            <form onSubmit={handleDelete} className="space-y-2">
              <input
                aria-label="Confirm password for deletion"
                type="password"
                autoComplete="current-password"
                placeholder="Current password"
                value={delPassword}
                onChange={(e) => setDelPassword(e.target.value)}
                required
                className="w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm text-[var(--navy-dark)] outline-none focus:border-red-500"
              />
              <input
                aria-label="Type to confirm deletion"
                type="text"
                placeholder='Type "delete my account" to confirm'
                value={delConfirmText}
                onChange={(e) => setDelConfirmText(e.target.value)}
                required
                className="w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm text-[var(--navy-dark)] outline-none focus:border-red-500"
              />
              {delState.kind === "error" && (
                <p data-testid="del-error" className="text-xs text-red-600">{delState.message}</p>
              )}
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={delState.kind === "saving"}
                  className="rounded-full bg-red-600 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-white disabled:opacity-50 hover:bg-red-700"
                >
                  {delState.kind === "saving" ? "Deleting…" : "Delete my account"}
                </button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
};
