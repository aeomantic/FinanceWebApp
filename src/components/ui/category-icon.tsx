import {
  Briefcase,
  Bus,
  Car,
  Coffee,
  Coins,
  Dumbbell,
  Film,
  Flame,
  Fuel,
  Gamepad2,
  Gift,
  GraduationCap,
  HeartPulse,
  Home,
  Laptop,
  Phone,
  PiggyBank,
  Pizza,
  Plane,
  RotateCcw,
  Sparkles,
  ShoppingBag,
  ShoppingCart,
  Tag,
  TrendingUp,
  Utensils,
  Wallet,
  Wifi,
  Wine,
  Zap,
  type LucideIcon,
} from "lucide-react";

// Database icon keys are kebab-case (portable, human-readable in the SQL
// editor) and map here to the actual lucide-react components, so nothing
// in the schema depends on a JS import name.
const ICONS: Record<string, LucideIcon> = {
  "utensils": Utensils,
  "coffee": Coffee,
  "pizza": Pizza,
  "wine": Wine,
  "shopping-cart": ShoppingCart,
  "shopping-bag": ShoppingBag,
  "tag": Tag,
  "gift": Gift,
  "home": Home,
  "zap": Zap,
  "wifi": Wifi,
  "flame": Flame,
  "phone": Phone,
  "car": Car,
  "bus": Bus,
  "fuel": Fuel,
  "plane": Plane,
  "heart-pulse": HeartPulse,
  "dumbbell": Dumbbell,
  "film": Film,
  "gamepad-2": Gamepad2,
  "briefcase": Briefcase,
  "wallet": Wallet,
  "coins": Coins,
  "trending-up": TrendingUp,
  "piggy-bank": PiggyBank,
  "graduation-cap": GraduationCap,
  "sparkles": Sparkles,
  "laptop": Laptop,
  "rotate-ccw": RotateCcw,
};

export function getCategoryIcon(iconName: string | null | undefined): LucideIcon {
  return (iconName && ICONS[iconName]) || Wallet;
}

export function CategoryIcon({ name, className, size }: { name: string | null | undefined; className?: string; size?: number }) {
  const IconComponent = getCategoryIcon(name);
  // IconComponent is a stable reference pulled from the top-level ICONS map,
  // never constructed here, so this isn't the "component created during
  // render" pattern the rule is meant to catch.
  // eslint-disable-next-line react-hooks/static-components
  return <IconComponent className={className} size={size} aria-hidden="true" />;
}

export const CATEGORY_ICON_NAMES = Object.keys(ICONS);

/** Grouped by everyday context for the icon picker grid. Every key here
 * must exist in ICONS above; the groups themselves are cosmetic only. */
export const CATEGORY_ICON_GROUPS: { label: string; icons: string[] }[] = [
  { label: "Food & dining", icons: ["utensils", "coffee", "pizza", "wine"] },
  { label: "Shopping & essentials", icons: ["shopping-cart", "shopping-bag", "tag", "gift"] },
  { label: "Bills & living", icons: ["home", "zap", "wifi", "flame", "phone"] },
  { label: "Transport", icons: ["car", "bus", "fuel", "plane"] },
  { label: "Health & leisure", icons: ["heart-pulse", "dumbbell", "film", "gamepad-2"] },
  { label: "Income & work", icons: ["briefcase", "wallet", "coins", "trending-up", "piggy-bank"] },
  { label: "More", icons: ["graduation-cap", "sparkles", "laptop", "rotate-ccw"] },
];
