import { useEffect } from "react";
import { AppShell } from "./components/AppShell";
import { SkeletonRows } from "./components/common";
import { canOpen, profileNavigation, resolveScreen } from "./config/navigation";
import { navigate, usePath } from "./router";
import { AccountScreen } from "./screens/AccountScreen";
import { DashboardScreen } from "./screens/dashboard/DashboardScreen";
import { LoginScreen } from "./screens/LoginScreen";
import { MoreScreen } from "./screens/MoreScreen";
import { ForbiddenScreen, NotFoundScreen, PendingScreen } from "./screens/PendingScreen";
import { useOnline, useSession } from "./state/session";

export default function App() {
  const { status, user, bootstrap, switchProfile, logout } = useSession();
  const online = useOnline();
  const path = usePath();
  const pathname = path.split("?")[0];

  // A profile without a dashboard starts on its own first tab.
  useEffect(() => {
    if (status === "signedIn" && user && pathname === "/" && !canOpen(user.profile, "dashboard")) {
      navigate(profileNavigation[user.profile].home, { replace: true });
    }
  }, [status, user, pathname]);

  if (status === "loading") {
    return <div className="mx-auto max-w-md px-4 pt-[20vh]"><SkeletonRows rows={3} /></div>;
  }
  if (status === "signedOut" || !user || !bootstrap) return <LoginScreen />;
  if (user.mustChangePin) return <AccountScreen forced />;

  const resolved = resolveScreen(pathname);
  const special = pathname === "/more" ? "more" : pathname === "/account" ? "account" : null;

  let content;
  if (special === "more") content = <MoreScreen profile={user.profile} />;
  else if (special === "account") content = <AccountScreen />;
  else if (!resolved) content = <NotFoundScreen />;
  else if (!canOpen(user.profile, resolved.key)) content = <ForbiddenScreen />;
  else if (resolved.key === "dashboard") content = <DashboardScreen />;
  else content = <PendingScreen screen={resolved.key} />;

  const changeProfile = async (profile: typeof user.profile) => {
    await switchProfile(profile);
    navigate(profileNavigation[profile].home);
  };

  return (
    <AppShell
      user={user}
      today={bootstrap.today}
      activeScreen={special ?? resolved?.key ?? null}
      online={online}
      waitingToSync={0}
      onProfileChange={changeProfile}
      onLogout={logout}
    >
      {content}
    </AppShell>
  );
}
