import type { ComponentType, SVGProps } from "react";
import {
  ClockIcon,
  Cog6ToothIcon,
  FolderIcon,
  GlobeAltIcon,
  HomeIcon,
  SparklesIcon,
  UserIcon,
} from "@heroicons/react/24/solid";
import type { RouteId } from "./routes";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

/** 侧栏导航：Heroicons Solid（与截图同款实心风格） */
export const NAV_ICONS: Record<RouteId, IconComponent> = {
  dashboard: HomeIcon,
  tasks: SparklesIcon,
  records: ClockIcon,
  actors: UserIcon,
  files: FolderIcon,
  sources: GlobeAltIcon,
  settings: Cog6ToothIcon,
};
