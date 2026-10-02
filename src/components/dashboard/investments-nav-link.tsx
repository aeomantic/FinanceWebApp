"use client";
import Link from "next/link";
import { TrendingUp } from "lucide-react";

export function InvestmentsNavLink({ demo = false }: { demo?: boolean }) {
  return <Link href={demo ? "/login" : "/investments"} className="rail-link" aria-label="Investments" title="Investments"><TrendingUp /></Link>;
}
