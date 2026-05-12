import type { LabelColor } from "@/lib/kanban";

/**
 * Static map from token to Tailwind classes. Tailwind's JIT can only see literal
 * class names, so we list every variant explicitly rather than interpolating.
 */
export const LABEL_CHIP_CLASS: Record<LabelColor, string> = {
  slate: "bg-slate-200 text-slate-800",
  red: "bg-red-200 text-red-800",
  amber: "bg-amber-200 text-amber-900",
  lime: "bg-lime-200 text-lime-900",
  emerald: "bg-emerald-200 text-emerald-900",
  cyan: "bg-cyan-200 text-cyan-900",
  blue: "bg-blue-200 text-blue-900",
  violet: "bg-violet-200 text-violet-900",
  fuchsia: "bg-fuchsia-200 text-fuchsia-900",
  pink: "bg-pink-200 text-pink-900",
};

export const LABEL_SWATCH_CLASS: Record<LabelColor, string> = {
  slate: "bg-slate-400",
  red: "bg-red-500",
  amber: "bg-amber-500",
  lime: "bg-lime-500",
  emerald: "bg-emerald-500",
  cyan: "bg-cyan-500",
  blue: "bg-blue-500",
  violet: "bg-violet-500",
  fuchsia: "bg-fuchsia-500",
  pink: "bg-pink-500",
};
