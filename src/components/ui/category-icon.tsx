import {
  Briefcase,
  Car,
  Coins,
  Film,
  Gift,
  GraduationCap,
  HeartPulse,
  Home,
  Laptop,
  RotateCcw,
  Sparkles,
  ShoppingBag,
  ShoppingCart,
  TrendingUp,
  Utensils,
  Wallet,
  Zap,
  type LucideIcon,
} from "lucide-react";

// Database icon keys are kebab-case (portable, human-readable in the SQL
// editor) and map here to the actual lucide-react components, so nothing
// in the schema depends on a JS import name.
const ICONS: Record<string, LucideIcon> = {
  "utensils": Utensils,
  "shopping-cart": ShoppingCart,
  "home": Home,
  "zap": Zap,
  "car": Car,
  "film": Film,
  "shopping-bag": ShoppingBag,
  "heart-pulse": HeartPulse,
  "graduation-cap": GraduationCap,
  "sparkles": Sparkles,
  "briefcase": Briefcase,
  "laptop": Laptop,
  "trending-up": TrendingUp,
  "gift": Gift,
  "rotate-ccw": RotateCcw,
  "coins": Coins,
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
