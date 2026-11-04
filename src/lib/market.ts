export const countries = [
  {
    code: "BG",
    name: "Bulgaria",
    color: "var(--mint)",
    flag: "bg",
  },
  {
    code: "RO",
    name: "Romania",
    color: "var(--cyan)",
    flag: "ro",
  },
  {
    code: "RS",
    name: "Serbia",
    color: "var(--violet)",
    flag: "rs",
  },
  {
    code: "HU",
    name: "Hungary",
    color: "var(--amber)",
    flag: "hu",
  },
  {
    code: "GR",
    name: "Greece",
    color: "var(--blue)",
    flag: "gr",
  },
  {
    code: "SK",
    name: "Slovakia",
    color: "var(--pink)",
    flag: "sk",
  },
  {
    code: "PL",
    name: "Poland",
    color: "var(--cyan)",
    flag: "pl",
  },
  {
    code: "CZ",
    name: "Czechia",
    color: "var(--violet)",
    flag: "cz",
  },
];
export type CountryCode = (typeof countries)[number]["code"];
export const generationMix = [
  { name: "Nuclear", color: "var(--blue)" },
  { name: "Solar", color: "var(--mint)" },
  { name: "Coal", color: "var(--slate)" },
  { name: "Hydro", color: "var(--cyan)" },
  { name: "Gas", color: "var(--violet)" },
  { name: "Wind", color: "var(--amber)" },
  { name: "Biomass", color: "var(--pink)" },
  { name: "Storage", color: "var(--violet)" },
  { name: "Other", color: "var(--slate)" },
];
export type MarketRow = {
  timestamp: string;
  label: string;
  country: string;
  price?: number | null;
  generation?: number | null;
  renewable?: number | null;
  load?: number | null;
  import?: number | null;
  export?: number | null;
  solar?: number | null;
  wind?: number | null;
  hydro?: number | null;
  nuclear?: number | null;
  coal?: number | null;
  gas?: number | null;
  biomass?: number | null;
  storage?: number | null;
  other?: number | null;
  netFlow?: number | null;
  renewableGeneration?: number | null;
  durationHours?: number;
  negativeHours?: number;
  negativeIntervals?: number;
  [key: string]: string | number | null | undefined;
};
export type MarketQuery = {
  country?: string;
  days?: number;
  resolution?: string;
  date?: string;
};
export const formatNumber = (n: number | null | undefined, digits = 2) =>
  n == null || !Number.isFinite(n)
    ? "—"
    : new Intl.NumberFormat("en-GB", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }).format(n);
export function marketAverage(rows: MarketRow[], key: string) {
  let total = 0,
    hours = 0;
  for (const row of rows) {
    const value = row[key];
    const duration = Number(row.durationHours ?? 1);
    if (
      typeof value === "number" &&
      Number.isFinite(value) &&
      Number.isFinite(duration) &&
      duration > 0
    ) {
      total += value * duration;
      hours += duration;
    }
  }
  return hours ? total / hours : NaN;
}
export function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const escape = (v: unknown) =>
    '"' +
    (typeof v === "string"
      ? v.replace(/^[=+@-]/, "'$&")
      : String(v ?? "")
    ).replaceAll('"', '""') +
    '"';
  return (
    "\uFEFF" +
    [
      columns.map(escape).join(","),
      ...rows.map((row) => columns.map((c) => escape(row[c])).join(",")),
    ].join("\r\n")
  );
}
