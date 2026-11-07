"use client";

import { totalsByCategory } from "@/lib/expenses";
import { formatBRLFromCents } from "@/lib/money";
import { getCategory } from "./categories";
import { Card, CardHeader } from "./ui";

const PERCENT = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 0 });

export default function CategoryBreakdown({ expenses }) {
  const byCategory = totalsByCategory(expenses);
  const total = Object.values(byCategory).reduce((s, v) => s + v, 0);
  const rows = Object.entries(byCategory)
    .filter(([, cents]) => cents > 0)
    .sort((a, b) => b[1] - a[1]);

  if (rows.length === 0) return null;

  return (
    <Card aria-labelledby="categorias-titulo">
      <CardHeader id="categorias-titulo" title="Por categoria" />
      <ul className="space-y-3">
        {rows.map(([value, cents]) => {
          const { Icon, label } = getCategory(value);
          const share = total > 0 ? cents / total : 0;
          return (
            <li key={value}>
              <div className="flex items-center gap-2 text-sm">
                <Icon size={16} className="shrink-0 text-mute" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-ink">{label}</span>
                <span className="num text-xs text-mute">{PERCENT.format(share)}</span>
                <span className="num w-24 text-right font-medium text-ink">{formatBRLFromCents(cents)}</span>
              </div>
              <div className="ml-6 mt-1.5 h-1 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(share * 100, 2)}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
