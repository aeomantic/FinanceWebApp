import type { Metadata } from "next";
import { SettingsView } from "@/components/settings/settings-view";
import { getSettingsData } from "@/lib/settings/data";

export const metadata: Metadata = { title: "Settings | Folio" };

export default async function SettingsPage() {
  const data = await getSettingsData();
  return <SettingsView data={data} />;
}
