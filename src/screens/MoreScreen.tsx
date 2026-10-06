import type { ProfileName } from "../../shared/types";
import { PageHeader } from "../components/common";
import { Icon } from "../components/Icon";
import { canOpen, profileNavigation, screens } from "../config/navigation";
import { Link } from "../router";

export function MoreScreen({ profile }: { profile: ProfileName }) {
  const items = profileNavigation[profile].more.filter((screen) => canOpen(profile, screen));
  return (
    <div className="screen-enter mx-auto max-w-[720px] px-4 py-6 sm:px-6">
      <PageHeader title="More" />
      <nav className="divide-y divide-stone-200 border-y border-stone-200">
        {items.map((screen) => (
          <Link key={screen} to={screens[screen].pattern} className="tap-target flex min-h-14 items-center gap-3 px-1 text-sm font-medium text-stone-800 hover:bg-stone-50">
            <Icon name={screens[screen].icon} size={18} className="text-[#925515]" />
            <span className="flex-1">{screens[screen].title}</span>
            <Icon name="chevron" size={16} className="-rotate-90 text-stone-400" />
          </Link>
        ))}
      </nav>
    </div>
  );
}
