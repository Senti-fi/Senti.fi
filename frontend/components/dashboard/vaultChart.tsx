import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

export type UserVaultDetail = {
  vaultName: string;
  vaultPubkey: string;
  token: string;
  amount: number; // token units
  yieldRate?: number | null;
  lockedUntil?: string | null;
  isUnlocked: boolean;
  rewardsAccrued: number;
  // optional enriched fields added by page:
  usdPrice?: number | null;
  usdValue?: number;
};

type Props = {
  vaults: UserVaultDetail[];
  /** diameter in px (used as max width) */
  size?: number;
  /** optional colors for slices; will repeat if fewer than vaults */
  colors?: string[];
};

const DEFAULT_COLORS = [
  "#27AAE1",
  "#AD54F0",
  "#658BEC",
  "#DF4AAA",
  "#F6C85F",
  "#34D399",
  "#FB7185",
  "#60A5FA",
];

function formatCurrency(n: number) {
  if (!Number.isFinite(n)) return "—";
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function VaultsChart({ vaults, size = 220, colors = DEFAULT_COLORS }: Props) {
  // compute USD value per vault (prefer usdValue property, otherwise compute with usdPrice)
  const data = vaults
    .map((v) => {
      const usdValue = typeof v.usdValue === "number" && isFinite(v.usdValue)
        ? v.usdValue
        : (typeof v.usdPrice === "number" ? v.amount * v.usdPrice : 0);
      return {
        name: v.vaultName || `${v.token} Vault`,
        token: v.token,
        tokenAmount: v.amount,
        usdValue,
      };
    })
    .filter((d) => d.usdValue > 0); // hide zero-value slices

  const totalUsd = data.reduce((s, d) => s + (d.usdValue || 0), 0);

  if (data.length === 0 || totalUsd === 0) {
    return (
      <div className="flex flex-col items-center justify-center bg-[#0D0D0D] rounded-2xl px-4 py-10 w-full">
        <div className="w-full text-center">
          <div className="text-sm text-[#A4A4A4]">Portfolio distribution</div>
          <div className="text-lg font-semibold text-white mt-2">No funds in vaults</div>
          <div className="text-sm text-[#A4A4A4] mt-1">Create or deposit into a vault to see a chart</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0D0D0D] rounded-2xl p-4 w-full flex flex-1 flex-col items-center">
      <div className="w-full flex items-center justify-between mb-3">
        <div>
          <div className="text-lg font-semibold text-white">Allocation</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-[#A4A4A4]">Total (USD)</div>
          <div className="text-sm font-semibold text-white">{formatCurrency(totalUsd)}</div>
        </div>
      </div>

      <div style={{ width: size, height: size }} className="flex items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="usdValue"
              nameKey="name"
              innerRadius={size * 0.33}
              outerRadius={size * 0.48}
              paddingAngle={4}
              cornerRadius={6}
              isAnimationActive={false}
            >
              {data.map((_, idx) => (
                <Cell key={`cell-${idx}`} fill={colors[idx % colors.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: any, name: string, props: any) => {
                const v = Number(value || 0);
                const item = props && props.payload ? props.payload : null;
                const token = item?.token ?? "";
                const tokenAmt = item?.tokenAmount ?? 0;
                const pct = totalUsd > 0 ? `${((v / totalUsd) * 100).toFixed(2)}%` : "0%";
                // show: USD value, and label includes token + amount and percent
                return [formatCurrency(v), `${name} • ${tokenAmt} ${token}`];
              }}
              wrapperStyle={{ zIndex: 50 }}
            />
            {/* <Tooltip formatter={(value: any, name: string, props: any) => { const v = Number(value || 0); const pct = total > 0 ? ${((v / total) * 100).toFixed(2)}% : "0%"; return [formatCurrency(v), ${name} • ${pct}]; }} wrapperStyle={{ zIndex: 50 }} /> */}
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* legend */}
      <div className="mt-4 w-full grid grid-cols-1 gap-2">
        {data.map((d, i) => {
          const pct = totalUsd > 0 ? ((d.usdValue / totalUsd) * 100).toFixed(2) : "0.00";
          return (
            <div key={d.name} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-3">
                <div
                  className="w-3 h-3 rounded-sm"
                  style={{ background: colors[i % colors.length] }}
                />
                <div className="max-w-[300px] text-[#A4A4A4]">
                  {d.name} <span className="text-xs text-[#6B7280]">• {d.tokenAmount.toFixed(2)} {d.token}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-white font-medium">{formatCurrency(d.usdValue)}</span>
                <span className="text-xs text-[#A4A4A4]">({pct}%)</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
