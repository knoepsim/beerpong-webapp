import {
  Award,
  CalendarClock,
  CircleCheck,
  Coffee,
  Hourglass,
  MapPin,
  Play,
  TriangleAlert,
  Trophy,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import type { StatusIcon } from "@/lib/my-status";

/** The icon of a participant status, the same in the status card and in the list of my tournaments. */
export const STATUS_ICONS: Record<StatusIcon, LucideIcon> = {
  go: MapPin,
  play: Play,
  queue: Hourglass,
  pause: Coffee,
  award: Award,
  trophy: Trophy,
  check: CircleCheck,
  alert: TriangleAlert,
  calendar: CalendarClock,
  join: UserPlus,
};
