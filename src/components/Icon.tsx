import type { ReactNode } from "react";

export type IconName =
  | "dashboard"
  | "invoice"
  | "box"
  | "users"
  | "more"
  | "payment"
  | "tax"
  | "production"
  | "materials"
  | "dispatch"
  | "stamp"
  | "settings"
  | "search"
  | "plus"
  | "chevron"
  | "check"
  | "lock"
  | "wifi"
  | "wifiOff"
  | "scan"
  | "trash"
  | "close"
  | "calendar"
  | "clock"
  | "alert"
  | "file"
  | "download"
  | "message"
  | "arrow"
  | "spark"
  | "logout"
  | "key";

const paths: Record<IconName, ReactNode> = {
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="4" rx="1" /><rect x="14" y="10" width="7" height="11" rx="1" /><rect x="3" y="13" width="7" height="8" rx="1" /></>,
  invoice: <><path d="M7 3h7l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" /><path d="M14 3v5h5M9 12h6M9 16h6" /></>,
  box: <><path d="m3 7 9-4 9 4-9 4-9-4Z" /><path d="M3 7v10l9 4 9-4V7M12 11v10" /></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" /><circle cx="9.5" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
  more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
  payment: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18M7 15h3" /></>,
  tax: <><path d="M4 4h16v16H4z" /><path d="M8 8h8M8 12h3M8 16h8M15 11l-2 3h3l-2 3" /></>,
  production: <><path d="M3 21h18M5 21V8l7-4 7 4v13M9 21v-6h6v6M9 10h.01M15 10h.01" /></>,
  materials: <><path d="M4 5h16l-1 16H5L4 5Z" /><path d="M8 5a4 4 0 0 1 8 0M8 10h8M8 14h5" /></>,
  dispatch: <><path d="M3 7h11v11H3zM14 11h4l3 3v4h-7z" /><circle cx="7.5" cy="19" r="1.5" /><circle cx="17.5" cy="19" r="1.5" /></>,
  stamp: <><path d="M8 4h8v5l3 3v2H5v-2l3-3V4Z" /><path d="M5 17h14v3H5zM10 6h4" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.6a8 8 0 0 1-1.7 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.7-1l-1.7.6-1.4-2.4 1.4-1.1a7 7 0 0 1 0-2l-1.4-1.1 1.4-2.4 1.7.6a8 8 0 0 1 1.7-1l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.7 1l1.7-.6 1.4 2.4-1.4 1.1a7 7 0 0 1 0 2Z" transform="translate(-1 -2) scale(.95)" /></>,
  search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4 4" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  chevron: <><path d="m7 10 5 5 5-5" /></>,
  check: <><path d="m5 12 4 4L19 6" /></>,
  lock: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  wifi: <><path d="M5 12.5a11 11 0 0 1 14 0M8.5 16a5.5 5.5 0 0 1 7 0M12 19h.01" /></>,
  wifiOff: <><path d="M3 3 21 21M5 12.5a11 11 0 0 1 7-2.5M8.5 16a5.5 5.5 0 0 1 4-1M17 16l-1 .5M12 19h.01M16 5.5A11 11 0 0 1 21 9" /></>,
  scan: <><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10M12 7v10" /></>,
  trash: <><path d="M4 7h16M10 11v6M14 11v6M5 7l1 14h12l1-14M9 7V4h6v3" /></>,
  close: <><path d="m6 6 12 12M18 6 6 18" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  alert: <><path d="m10.3 4.3-8 14A1.3 1.3 0 0 0 3.4 20h17.2a1.3 1.3 0 0 0 1.1-1.7l-8-14a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></>,
  file: <><path d="M6 3h8l4 4v14H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" /><path d="M14 3v5h5M8 13h8M8 17h8" /></>,
  download: <><path d="M12 3v12M7 10l5 5 5-5M4 20h16" /></>,
  message: <><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5 8 8 0 0 1-3.3-.7L4 20l1.7-4A7.5 7.5 0 1 1 20 11.5Z" /><path d="M9 10h.01M13 10h.01M17 10h.01" /></>,
  arrow: <><path d="M19 12H5M12 19l-7-7 7-7" /></>,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></>,
  key: <><circle cx="8" cy="15" r="4" /><path d="m10.8 12.2 9.2-9.2M17 6l3 3M14 9l2 2" /></>,
  spark: <><path d="m12 3 1.6 6.4L20 11l-6.4 1.6L12 19l-1.6-6.4L4 11l6.4-1.6L12 3Z" /><path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z" /></>,
};

export function Icon({ name, size = 18, strokeWidth = 1.8, className = "" }: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}