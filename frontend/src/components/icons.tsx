import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export const TrashIcon = (props: IconProps) => (
  <svg {...base} aria-hidden="true" {...props}>
    <path d="M4 7h16" />
    <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
  </svg>
);

export const SparkleIcon = (props: IconProps) => (
  <svg {...base} aria-hidden="true" {...props}>
    <path d="M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4L12 3z" />
    <path d="M19 14l.8 2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-1L19 14z" />
  </svg>
);

export const LogOutIcon = (props: IconProps) => (
  <svg {...base} aria-hidden="true" {...props}>
    <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
    <path d="M10 17l-5-5 5-5" />
    <path d="M5 12h11" />
  </svg>
);

export const PlusIcon = (props: IconProps) => (
  <svg {...base} aria-hidden="true" {...props}>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </svg>
);

export const CloseIcon = (props: IconProps) => (
  <svg {...base} aria-hidden="true" {...props}>
    <path d="M6 6l12 12" />
    <path d="M18 6L6 18" />
  </svg>
);

export const SendIcon = (props: IconProps) => (
  <svg {...base} aria-hidden="true" {...props}>
    <path d="M4 12l16-8-6 18-2-8-8-2z" />
  </svg>
);

export const ChevronDownIcon = (props: IconProps) => (
  <svg {...base} aria-hidden="true" {...props}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);

export const CheckIcon = (props: IconProps) => (
  <svg {...base} aria-hidden="true" {...props}>
    <path d="M5 12l5 5L20 7" />
  </svg>
);

export const PencilIcon = (props: IconProps) => (
  <svg {...base} aria-hidden="true" {...props}>
    <path d="M4 20h4l10-10-4-4L4 16v4z" />
    <path d="M13 6l4 4" />
  </svg>
);

export const BoardIcon = (props: IconProps) => (
  <svg {...base} aria-hidden="true" {...props}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M9 4v16" />
    <path d="M15 4v16" />
  </svg>
);

export const CalendarIcon = (props: IconProps) => (
  <svg {...base} aria-hidden="true" {...props}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18" />
    <path d="M8 3v4" />
    <path d="M16 3v4" />
  </svg>
);

export const FlagIcon = (props: IconProps) => (
  <svg {...base} aria-hidden="true" {...props}>
    <path d="M5 21V4" />
    <path d="M5 4h11l-2 4 2 4H5" />
  </svg>
);

export const ChecklistIcon = (props: IconProps) => (
  <svg {...base} aria-hidden="true" {...props}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M8 12l3 3 5-6" />
  </svg>
);

export const CommentIcon = (props: IconProps) => (
  <svg {...base} aria-hidden="true" {...props}>
    <path d="M21 12a8 8 0 1 1-3.07-6.31L21 4l-1 4.32A8 8 0 0 1 21 12z" />
  </svg>
);

export const SearchIcon = (props: IconProps) => (
  <svg {...base} aria-hidden="true" {...props}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </svg>
);

export const FilterIcon = (props: IconProps) => (
  <svg {...base} aria-hidden="true" {...props}>
    <path d="M3 5h18l-7 9v6l-4-2v-4z" />
  </svg>
);

export const UserIcon = (props: IconProps) => (
  <svg {...base} aria-hidden="true" {...props}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
  </svg>
);

export const UsersIcon = (props: IconProps) => (
  <svg {...base} aria-hidden="true" {...props}>
    <circle cx="9" cy="9" r="3.5" />
    <path d="M2 20c0-3.8 3.1-6 7-6s7 2.2 7 6" />
    <circle cx="17" cy="7" r="2.5" />
    <path d="M22 17c0-2.5-1.8-4-4-4" />
  </svg>
);

export const ArchiveIcon = (props: IconProps) => (
  <svg {...base} aria-hidden="true" {...props}>
    <rect x="3" y="4" width="18" height="4" rx="1" />
    <path d="M5 8v11a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8" />
    <path d="M10 13h4" />
  </svg>
);

export const RestoreIcon = (props: IconProps) => (
  <svg {...base} aria-hidden="true" {...props}>
    <path d="M3 12a9 9 0 1 0 3-6.7" />
    <path d="M3 4v5h5" />
  </svg>
);

export const GripIcon = (props: IconProps) => (
  <svg {...base} aria-hidden="true" {...props}>
    <circle cx="9" cy="5" r="1.2" />
    <circle cx="9" cy="12" r="1.2" />
    <circle cx="9" cy="19" r="1.2" />
    <circle cx="15" cy="5" r="1.2" />
    <circle cx="15" cy="12" r="1.2" />
    <circle cx="15" cy="19" r="1.2" />
  </svg>
);
