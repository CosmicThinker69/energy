export const countries = [
  {
    code: "BG",
    name: "Bulgaria",
    price: 87.42,
    change: -1.8,
    color: "var(--mint)",
    flag: "bg",
    generation: 5840,
    renewable: 41.7,
  },
  {
    code: "RO",
    name: "Romania",
    price: 92.31,
    change: 2.4,
    color: "var(--cyan)",
    flag: "ro",
    generation: 6820,
    renewable: 46.2,
  },
  {
    code: "RS",
    name: "Serbia",
    price: 89.76,
    change: 1.2,
    color: "var(--violet)",
    flag: "rs",
    generation: 4150,
    renewable: 30.5,
  },
  {
    code: "HU",
    name: "Hungary",
    price: 98.54,
    change: 3.6,
    color: "var(--amber)",
    flag: "hu",
    generation: 4980,
    renewable: 28.1,
  },
  {
    code: "GR",
    name: "Greece",
    price: 94.12,
    change: -0.8,
    color: "var(--blue)",
    flag: "gr",
    generation: 7210,
    renewable: 52.4,
  },
  {
    code: "SK",
    name: "Slovakia",
    price: 88.17,
    change: -1.1,
    color: "var(--pink)",
    flag: "sk",
    generation: 3220,
    renewable: 24.6,
  },
  {
    code: "PL",
    name: "Poland",
    price: 93.44,
    change: 1.7,
    color: "var(--cyan)",
    flag: "pl",
    generation: 18740,
    renewable: 32.8,
  },
  {
    code: "CZ",
    name: "Czechia",
    price: 85.68,
    change: -2.3,
    color: "var(--violet)",
    flag: "cz",
    generation: 8430,
    renewable: 22.9,
  },
];
export type CountryCode = (typeof countries)[number]["code"];
export const generationMix = [
  { name: "Nuclear", value: 31.3, color: "var(--blue)" },
  { name: "Solar", value: 21.2, color: "var(--mint)" },
  { name: "Coal", value: 18.0, color: "var(--slate)" },
  { name: "Hydro", value: 12.4, color: "var(--cyan)" },
  { name: "Gas", value: 9.0, color: "var(--violet)" },
  { name: "Wind", value: 6.0, color: "var(--amber)" },
  { name: "Biomass", value: 2.1, color: "var(--pink)" },
];
export const marketEvents = [
  {
    type: "price",
    title: "Bulgaria trades below the regional average",
    detail: "Day-ahead spread narrows to −€3.76/MWh.",
    time: "4 min ago",
    level: "info",
  },
  {
    type: "generation",
    title: "Solar output reaches today’s peak",
    detail: "BG solar generation exceeds 1.24 GW at 13:00.",
    time: "12 min ago",
    level: "success",
  },
  {
    type: "flow",
    title: "BG → GR interconnector at 78% capacity",
    detail: "Scheduled exports remain within available capacity.",
    time: "28 min ago",
    level: "warning",
  },
];
export type MarketRow = {
  timestamp: string;
  label: string;
  country: string;
  price: number;
  generation: number;
  renewable: number;
  balancing: number;
  import: number;
  export: number;
  solar: number;
  wind: number;
  hydro: number;
  nuclear: number;
  coal: number;
  gas: number;
  biomass: number;
  upward: number;
  downward: number;
  volume: number;
  netFlow: number;
  capture: number;
  volatility: number;
  negative: number;
  [key: string]: string | number;
};
export type MarketQuery = {
  country?: string;
  days?: number;
  resolution?: string;
  date?: string;
};
const round = (n: number) => Math.round(n * 100) / 100;
export function generationBreakdown(
  generation: number,
  renewable: number,
  solarFactor: number,
  country = "BG",
) {
  const renewableMw = Math.round((generation * renewable) / 100);
  const biomass = Math.round(generation * 0.021);
  const wind = Math.round(generation * 0.06);
  const solar = Math.round(
    Math.min(renewableMw - biomass - wind, generation * solarFactor * 0.23),
  );
  const hydro = renewableMw - solar - wind - biomass;
  const nuclearShare: Record<string, number> = {
    BG: 0.313,
    RO: 0.2,
    RS: 0,
    HU: 0.43,
    GR: 0,
    SK: 0.58,
    PL: 0,
    CZ: 0.36,
  };
  const nuclear = Math.round(
    Math.min(
      generation - renewableMw,
      generation * (nuclearShare[country] || 0),
    ),
  );
  const fossil = generation - renewableMw - nuclear;
  const gasFraction: Record<string, number> = {
    BG: 0.333,
    RO: 0.65,
    RS: 0.12,
    HU: 0.9,
    GR: 0.82,
    SK: 0.65,
    PL: 0.11,
    CZ: 0.22,
  };
  const gas = Math.round(fossil * (gasFraction[country] || 0.33));
  return { solar, wind, hydro, nuclear, coal: fossil - gas, gas, biomass };
}
export function generateMarketRows({
  country = "BG",
  days = 1,
  resolution = "hourly",
  date,
}: MarketQuery = {}): MarketRow[] {
  const market = countries.find((c) => c.code === country) || countries[0];
  const end = new Date(
    (date || new Date().toISOString().slice(0, 10)) + "T00:00:00Z",
  );
  const aggregate = resolution === "monthly" || resolution === "daily";
  const step = resolution === "quarter-hourly" ? 0.25 : 1;
  const count = Math.max(1, Math.round((days * 24) / step));
  const rows: MarketRow[] = [];
  for (let i = 0; i < count; i++) {
    const t = new Date(
      end.getTime() - (days - 1) * 86400000 + i * step * 3600000,
    );
    const h = t.getUTCHours() + t.getUTCMinutes() / 60;
    const dayIndex = Math.floor(t.getTime() / 86400000);
    const seed = market.code.charCodeAt(0) + market.code.charCodeAt(1);
    const seasonal = Math.sin(dayIndex / 58) * 7;
    const variation = Math.sin(dayIndex * 0.37 + seed) * 3;
    const solarFactor = Math.max(0, Math.sin(((h - 6) / 13) * Math.PI));
    const shape =
      12 * Math.exp(-(((h - 8) / 2.8) ** 2)) +
      30 * Math.exp(-(((h - 19) / 2.4) ** 2)) -
      22 * solarFactor -
      5 * Math.cos((h / 24) * Math.PI * 2);
    const negativeEvent =
      (country === "GR" || country === "RO" || country === "PL") &&
      dayIndex % 9 === 0 &&
      h >= 11 &&
      h <= 14;
    const price = round(
      negativeEvent
        ? -4.8 - Math.sin(h) * 3
        : market.price +
            shape +
            seasonal +
            variation +
            Math.sin((dayIndex * 24 + h) * 0.75 + seed) * 2.1,
    );
    const generation = Math.round(
      market.generation *
        (0.9 + 0.14 * solarFactor + 0.035 * Math.sin(h / 3 + seed)),
    );
    const renewable = round(
      Math.min(
        85,
        Math.max(
          8,
          market.renewable +
            (solarFactor - 0.6) * 17 +
            Math.sin(dayIndex / 4) * 3,
        ),
      ),
    );
    const mix = generationBreakdown(
      generation,
      renewable,
      solarFactor,
      market.code,
    );
    const imports = Math.round(
      320 + 120 * Math.sin(h / 4 + seed) + solarFactor * 100,
    );
    const exports = Math.round(830 + 170 * Math.cos(h / 5) + solarFactor * 120);
    rows.push({
      timestamp: t.toISOString(),
      label:
        days > 1
          ? t.toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              timeZone: "UTC",
            }) +
            " " +
            `${String(t.getUTCHours()).padStart(2, "0")}:00`
          : `${String(t.getUTCHours()).padStart(2, "0")}:${String(t.getUTCMinutes()).padStart(2, "0")}`,
      country: market.code,
      price,
      generation,
      renewable,
      balancing: round(price * 1.21 + 6 * Math.sin(h / 2)),
      import: imports,
      export: exports,
      ...mix,
      renewableGeneration: mix.solar + mix.wind + mix.hydro + mix.biomass,
      upward: round(price * 1.27 + 5),
      downward: round(price * 0.71 - 4),
      volume: Math.round(90 + 35 * Math.sin(h / 3) + 20 * solarFactor),
      netFlow: exports - imports,
      capture: round(price * (0.78 + solarFactor * 0.08)),
      volatility: round(
        12 + 5 * Math.sin((dayIndex * 24 + h) / 4) + solarFactor * 8,
      ),
      negative: price < 0 ? 1 : 0,
    });
  }
  if (aggregate) {
    const groups = new Map<string, MarketRow[]>();
    rows.forEach((r) => {
      const key = r.timestamp.slice(0, resolution === "monthly" ? 7 : 10);
      const group = groups.get(key) || [];
      group.push(r);
      groups.set(key, group);
    });
    return [...groups.entries()].map(([, group]) => {
      const sample = { ...group[0] };
      for (const key of Object.keys(sample)) {
        if (typeof sample[key] === "number")
          sample[key] = round(
            group.reduce((s, r) => s + Number(r[key]), 0) /
              (key === "negative" || key === "volume" ? 1 : group.length),
          );
      }
      sample.label = new Date(sample.timestamp).toLocaleDateString("en-GB", {
        ...(resolution === "monthly"
          ? { month: "short", year: "2-digit" }
          : { day: "2-digit", month: "short" }),
        timeZone: "UTC",
      });
      return sample;
    });
  }
  return rows;
}
export function withLiveSnapshot(
  row: MarketRow,
  snapshot: LiveSnapshot,
): MarketRow {
  if (row.country === "RO") return { ...row, price: snapshot.roPrice };
  if (row.country !== "BG") return row;
  const generation = Math.round(snapshot.generation * 1000);
  const mix = generationBreakdown(
    generation,
    snapshot.renewable,
    snapshot.solar / generation / 0.23,
    "BG",
  );
  return {
    ...row,
    price: snapshot.price,
    generation,
    renewable: snapshot.renewable,
    ...mix,
    renewableGeneration: mix.solar + mix.wind + mix.hydro + mix.biomass,
    netFlow: snapshot.flow,
    export: row.import + snapshot.flow,
  };
}
export type LiveSnapshot = {
  timestamp: string;
  price: number;
  generation: number;
  renewable: number;
  flow: number;
  roPrice: number;
  solar: number;
  sequence: number;
};
export function liveSnapshot(time = Date.now()): LiveSnapshot {
  const t = time / 5000;
  return {
    timestamp: new Date(time).toISOString(),
    price: round(87.42 + Math.sin(t / 8) * 0.43 + Math.sin(t / 3) * 0.12),
    generation: round(5.84 + Math.sin(t / 11) * 0.035),
    renewable: round(41.7 + Math.sin(t / 13) * 0.19),
    flow: Math.round(684 + Math.sin(t / 10) * 12),
    roPrice: round(92.31 + Math.sin(t / 9) * 0.37),
    solar: Math.round(1240 + Math.sin(t / 12) * 17),
    sequence: Math.floor(t),
  };
}
export const formatNumber = (n: number, digits = 2) =>
  new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);
export function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const columns = Object.keys(rows[0]);
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
