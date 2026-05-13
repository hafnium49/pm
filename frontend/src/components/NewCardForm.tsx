import { useState, type FormEvent } from "react";
import { PlusIcon } from "@/components/icons";

type NewCardFormProps = {
  onAdd: (title: string, details: string) => void;
};

export const NewCardForm = ({ onAdd }: NewCardFormProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");

  const reset = () => {
    setTitle("");
    setDetails("");
    setIsOpen(false);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const t = title.trim();
    if (!t) return;
    onAdd(t, details.trim());
    reset();
  };

  if (!isOpen) {
    return (
      <div className="mt-3">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)] transition hover:bg-[var(--surface)] hover:text-[var(--primary-blue)]"
        >
          <PlusIcon width={14} height={14} />
          Add a card
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3">
      <form onSubmit={handleSubmit} className="space-y-2 rounded-xl border border-[var(--stroke)] bg-[var(--surface)] p-2.5">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Card title"
          autoFocus
          className="w-full rounded-lg border border-[var(--stroke)] bg-white px-3 py-2 text-sm font-medium text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
          required
        />
        <textarea
          value={details}
          onChange={(event) => setDetails(event.target.value)}
          placeholder="Details"
          rows={2}
          className="w-full resize-none rounded-lg border border-[var(--stroke)] bg-white px-3 py-2 text-sm text-[var(--gray-text)] outline-none transition focus:border-[var(--primary-blue)]"
        />
        <div className="flex items-center gap-2">
          <button
            type="submit"
            className="rounded-full bg-[var(--secondary-purple)] px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-white transition hover:brightness-110"
          >
            Add card
          </button>
          <button
            type="button"
            onClick={reset}
            className="rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};
