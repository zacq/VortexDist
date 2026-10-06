import { useState, type ReactNode } from "react";
import { formatKenyanDate } from "../../shared/format";
import type { AuthUser, ProfileName } from "../../shared/types";
import { canOpen, profileNavigation, screens, type ScreenKey } from "../config/navigation";
import { navigate } from "../router";
import { OfflineBanner } from "./common";
import { Icon } from "./Icon";

function initials(name: string): string {
  return name.split(" ").slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

export function BrandMark() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-[3px] bg-[#925515] text-[17px] font-bold tracking-[-0.08em] text-white">V</span>
      <span className="leading-none">
        <span className="block text-[13px] font-bold tracking-[0.12em] text-stone-900">VORTEX</span>
        <span className="mt-1 block text-[9px] font-semibold tracking-[0.2em] text-stone-500">DISTILLERY ERP</span>
      </span>
    </div>
  );
}

function ProfileMenu({ user, onSelect, onLogout, onAccount }: {
  user: AuthUser;
  onSelect: (profile: ProfileName) => void;
  onLogout: () => void;
  onAccount: () => void;
}) {
  return (
    <div className="dropdown-motion absolute right-0 top-[calc(100%+10px)] z-50 w-[min(300px,calc(100vw-24px))] overflow-hidden rounded-md border border-stone-200 bg-white py-1 shadow-[0_12px_32px_rgba(33,30,24,0.14)]">
      <div className="border-b border-stone-100 px-3 pb-2.5 pt-2">
        <p className="truncate text-sm font-semibold text-stone-900">{user.name}</p>
        <p className="text-xs text-stone-500">{user.phone}</p>
      </div>
      {user.profiles.length > 1 && (
        <>
          <p className="px-3 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">Work as</p>
          {user.profiles.map((profile) => (
            <button type="button" key={profile} onClick={() => onSelect(profile)} className="tap-target flex min-h-11 w-full items-center justify-between gap-3 px-3 text-left text-sm hover:bg-stone-50">
              <span className={profile === user.profile ? "font-semibold text-stone-900" : "text-stone-700"}>{profile}</span>
              {profile === user.profile && <Icon name="check" size={16} className="text-[#925515]" />}
            </button>
          ))}
        </>
      )}
      <div className="mt-1 border-t border-stone-100 pt-1">
        <button type="button" onClick={onAccount} className="tap-target flex min-h-11 w-full items-center gap-2.5 px-3 text-left text-sm text-stone-700 hover:bg-stone-50"><Icon name="key" size={16} />Change PIN</button>
        <button type="button" onClick={onLogout} className="tap-target flex min-h-11 w-full items-center gap-2.5 px-3 text-left text-sm text-stone-700 hover:bg-stone-50"><Icon name="logout" size={16} />Sign out</button>
      </div>
    </div>
  );
}

export function AppShell({ user, today, activeScreen, online, waitingToSync, onProfileChange, onLogout, children }: {
  user: AuthUser;
  today: string;
  activeScreen: ScreenKey | "more" | "account" | null;
  online: boolean;
  waitingToSync: number;
  onProfileChange: (profile: ProfileName) => void;
  onLogout: () => void;
  children: ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const nav = profileNavigation[user.profile];
  const tabs = nav.tabs.filter((tab) => canOpen(user.profile, tab.screen));
  const more = nav.more.filter((screen) => canOpen(user.profile, screen));
  const tabScreens = new Set<string>(tabs.map((tab) => tab.screen));

  // Detail screens light up their list tab ("/invoices/12" -> Invoices).
  const parentOf: Partial<Record<string, ScreenKey>> = { newInvoice: "invoices", invoice: "invoices", customer: "customers", newPayment: "payments", newProduction: "production" };
  const selected = activeScreen ? (parentOf[activeScreen] ?? activeScreen) : null;
  const moreSelected = selected === "more" || (selected !== null && !tabScreens.has(selected) && selected !== "account");

  const go = (path: string) => {
    setMenuOpen(false);
    navigate(path);
  };

  const sideItems: { key: string; label: string; icon: Parameters<typeof Icon>[0]["name"]; path: string }[] = [
    ...tabs.map((tab) => ({ key: tab.screen, label: tab.label, icon: screens[tab.screen].icon, path: screens[tab.screen].pattern })),
    ...more.map((screen) => ({ key: screen, label: screens[screen].title, icon: screens[screen].icon, path: screens[screen].pattern })),
  ];

  const bottomItems = [
    ...tabs.map((tab) => ({ key: tab.screen as string, label: tab.label, icon: screens[tab.screen].icon, path: screens[tab.screen].pattern, active: selected === tab.screen })),
    ...(more.length > 0 ? [{ key: "more", label: "More", icon: "more" as const, path: "/more", active: moreSelected }] : []),
  ];

  return (
    <div className="min-h-screen bg-[#f6f5f1] text-stone-900">
      <div className="min-h-screen lg:grid lg:grid-cols-[232px_minmax(0,1fr)]">
        <aside className="sticky top-0 hidden h-screen border-r border-stone-200 bg-[#fbfaf7] px-4 pb-5 pt-5 lg:flex lg:flex-col">
          <div className="px-2"><BrandMark /></div>
          {nav.primaryAction && (
            <button type="button" onClick={() => go(nav.primaryAction!.to)} className="tap-target mt-8 flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-[#925515] px-3 text-sm font-semibold text-white hover:bg-[#79440f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#925515]/35 focus-visible:ring-offset-2">
              <Icon name={nav.primaryAction.icon} size={17} />{nav.primaryAction.label}
            </button>
          )}
          <p className="mb-2 mt-8 px-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-stone-400">Workspace</p>
          <nav aria-label="Main navigation" className="space-y-1 overflow-y-auto">
            {sideItems.map((item) => {
              const active = selected === item.key;
              return (
                <button type="button" key={item.key} onClick={() => go(item.path)} className={`tap-target flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-left text-sm font-medium transition-colors ${active ? "bg-[#f3e8d7] text-[#73400e]" : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"}`}>
                  <Icon name={item.icon} size={17} />{item.label}
                </button>
              );
            })}
          </nav>
          <div className="mt-auto border-t border-stone-200 pt-4">
            <div className="flex items-center gap-2.5 px-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-200 text-[10px] font-semibold text-stone-700">{initials(user.name)}</span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-semibold">{user.name}</span>
                <span className="block text-[11px] text-stone-500">{user.profile}</span>
              </span>
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-40 flex h-[60px] items-center justify-between border-b border-stone-200 bg-[#f8f7f3]/95 px-4 backdrop-blur-sm md:px-6 lg:h-[66px] lg:px-8">
            <div className="lg:hidden"><BrandMark /></div>
            <div className="flex min-w-0 items-center gap-1.5 text-[10px] text-stone-500 sm:gap-2 sm:text-xs lg:mr-auto lg:pl-1">
              <Icon name="calendar" size={14} className="shrink-0 text-stone-400" />
              <span className="whitespace-nowrap">{formatKenyanDate(today)}</span>
            </div>
            <div className="ml-auto flex items-center gap-2.5 sm:ml-6">
              <span title={online ? "Online" : "Offline"} className="flex h-11 items-center gap-1.5 px-2 text-xs text-stone-600">
                <span className={`h-2 w-2 rounded-full ${online ? "bg-emerald-600" : "bg-amber-600"}`} />
                <span className="hidden sm:inline">{online ? "Online" : "Offline"}</span>
              </span>
              <div className="relative">
                <button type="button" aria-expanded={menuOpen} onClick={() => setMenuOpen((current) => !current)} className="tap-target flex h-11 min-h-11 items-center gap-2 rounded-md pl-1 pr-1.5 hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#925515]/25">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e9ddca] text-[10px] font-bold text-[#74420f]">{initials(user.name)}</span>
                  <span className="hidden max-w-[138px] text-left sm:block">
                    <span className="block truncate text-xs font-semibold leading-4 text-stone-800">{user.name}</span>
                    <span className="block text-[10px] leading-3 text-stone-500">{user.profile}</span>
                  </span>
                  <Icon name="chevron" size={14} className="hidden text-stone-500 sm:block" />
                </button>
                {menuOpen && (
                  <ProfileMenu
                    user={user}
                    onSelect={(profile) => { setMenuOpen(false); onProfileChange(profile); }}
                    onAccount={() => go("/account")}
                    onLogout={() => { setMenuOpen(false); onLogout(); }}
                  />
                )}
              </div>
            </div>
          </header>
          {!online && <OfflineBanner waitingCount={waitingToSync} />}
          <main className="min-w-0 pb-24 lg:pb-8">{children}</main>
        </div>
      </div>

      <nav
        aria-label="Bottom navigation"
        className="fixed inset-x-0 bottom-0 z-50 grid items-center border-t border-stone-200 bg-[#fffefa]/95 px-2 pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur-sm lg:hidden"
        style={{ gridTemplateColumns: `repeat(${bottomItems.length}, minmax(0, 1fr))${nav.primaryAction ? " 48px" : ""}` }}
      >
        {bottomItems.map((item) => (
          <button type="button" key={item.key} onClick={() => go(item.path)} className={`tap-target flex min-h-[54px] min-w-0 flex-col items-center justify-center gap-1 rounded-md px-0.5 transition-colors ${item.active ? "text-[#7b460f]" : "text-stone-500 hover:text-stone-900"}`}>
            <Icon name={item.icon} size={18} strokeWidth={item.active ? 2.1 : 1.8} />
            <span className={`max-w-full truncate text-[9px] leading-3 ${item.active ? "font-semibold" : "font-medium"}`}>{item.label}</span>
          </button>
        ))}
        {nav.primaryAction && (
          <button type="button" onClick={() => go(nav.primaryAction!.to)} aria-label={nav.primaryAction.label} title={nav.primaryAction.label} className="tap-target flex h-11 w-11 items-center justify-center justify-self-center rounded-full bg-[#925515] text-white hover:bg-[#79440f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#925515]/40 focus-visible:ring-offset-2">
            <Icon name={nav.primaryAction.icon} size={20} strokeWidth={2} />
          </button>
        )}
      </nav>
    </div>
  );
}
