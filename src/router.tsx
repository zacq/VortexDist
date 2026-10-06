import { useEffect, useState, type MouseEvent, type ReactNode } from "react";

const listeners = new Set<() => void>();

export function navigate(path: string, options: { replace?: boolean } = {}) {
  if (options.replace) history.replaceState(null, "", path);
  else history.pushState(null, "", path);
  window.scrollTo(0, 0);
  listeners.forEach((listener) => listener());
}

export function usePath(): string {
  const [path, setPath] = useState(() => location.pathname + location.search);
  useEffect(() => {
    const update = () => setPath(location.pathname + location.search);
    listeners.add(update);
    window.addEventListener("popstate", update);
    return () => {
      listeners.delete(update);
      window.removeEventListener("popstate", update);
    };
  }, []);
  return path;
}

// "/invoices/:id" against "/invoices/12" -> { id: "12" }
export function matchPath(pattern: string, pathname: string): Record<string, string> | null {
  const keys: string[] = [];
  const regex = new RegExp(`^${pattern.replace(/:(\w+)/g, (_, key: string) => { keys.push(key); return "([^/]+)"; })}/?$`);
  const found = regex.exec(pathname);
  if (!found) return null;
  return Object.fromEntries(keys.map((key, i) => [key, decodeURIComponent(found[i + 1])]));
}

export function Link({ to, className, children, ...rest }: { to: string; className?: string; children: ReactNode; "aria-label"?: string }) {
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    navigate(to);
  };
  return <a href={to} onClick={onClick} className={className} {...rest}>{children}</a>;
}
