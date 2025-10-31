// Helper function to shorten the address
  export const shortenAddress = (addr: string, start = 6, end = 4) => {
    if (!addr) return '';
    if (addr.length <= start + end) return addr;
    return `${addr.slice(0, start)}...${addr.slice(-end)}`;
  };

  // helper to format amounts safely
  export const fmt = (v: number | null | undefined, digits = 2) => {
    if (v == null || Number.isNaN(v)) return '0.00';
    return v.toFixed(digits);
  };

  export function capitalizeFirst(s?: string | null) {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function explorerTxUrl(txid: string | null) {
  if (!txid) return "#";
  // devnet explorer
  return `https://explorer.solana.com/tx/${txid}?cluster=devnet`;
}