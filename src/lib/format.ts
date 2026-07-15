const nf0 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const cf = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const pf = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });

export const fmtInt = (n: number | undefined | null) => (n == null ? "—" : nf0.format(n));
export const fmtDec = (n: number | undefined | null) => (n == null ? "—" : nf1.format(n));
export const fmtBRL = (n: number | undefined | null) => (n == null ? "—" : cf.format(n));
export const fmtPct = (n: number | undefined | null) => (n == null ? "—" : pf.format(n));

export function fmtCompact(n: number | undefined | null): string {
  if (n == null) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return nf1.format(n / 1_000_000_000) + " bi";
  if (abs >= 1_000_000) return nf1.format(n / 1_000_000) + " mi";
  if (abs >= 1_000) return nf1.format(n / 1_000) + " mil";
  return nf0.format(n);
}

export function fmtBRLCompact(n: number | undefined | null): string {
  if (n == null) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return "R$ " + nf1.format(n / 1_000_000_000) + " bi";
  if (abs >= 1_000_000) return "R$ " + nf1.format(n / 1_000_000) + " mi";
  if (abs >= 1_000) return "R$ " + nf1.format(n / 1_000) + " mil";
  return cf.format(n);
}
