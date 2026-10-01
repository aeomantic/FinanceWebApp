"use client";

import { useState } from "react";
import { Store, Coffee, ShoppingCart, ShoppingBag, Car, Bus, Utensils, Laptop } from "lucide-react";
import type { Merchant } from "@/lib/merchants/model";
import styles from "./merchants.module.css";
const icons = { store: Store, coffee: Coffee, "shopping-cart": ShoppingCart, "shopping-bag": ShoppingBag, car: Car, bus: Bus, utensils: Utensils, laptop: Laptop };
export function MerchantIcon({ merchant, small = false }: { merchant: Merchant; small?: boolean }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const Icon = icons[merchant.icon_name.toLowerCase() as keyof typeof icons] ?? Store;
  const logo = merchant.logo_url?.startsWith("https://") && merchant.logo_url !== failedUrl ? merchant.logo_url : null;
  const color = /^#[0-9a-f]{6}$/i.test(merchant.brand_color) ? merchant.brand_color : "#FEF38B";
  return <span className={`${styles.icon} ${small ? styles.smallIcon : ""}`} style={{ borderColor: color }} aria-hidden="true">
    {logo ? (
      // Remote logos are optional; render directly without proxying unknown hosts.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={logo} alt="" width={small ? 20 : 28} height={small ? 20 : 28} referrerPolicy="no-referrer" loading="lazy" onError={() => setFailedUrl(logo)} />
    ) : <Icon size={small ? 13 : 18} />}
  </span>;
}
