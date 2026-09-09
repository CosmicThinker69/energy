export type Report = {
  id: string;
  title: string;
  type: string;
  date: string;
  description: string;
  read: string;
  sections: string[][];
};
export const reports: Report[] = [
  {
    id: "weekly-outlook",
    title: "Southeast Europe: weekly market outlook",
    type: "Market outlook",
    date: "2026-09-07",
    description:
      "Price convergence, interconnector utilization, and renewable supply across the region.",
    read: "8 min read",
    sections: [
      [
        "Executive perspective",
        "Regional day-ahead markets are showing a narrower spread as solar production offsets daytime demand. Bulgaria continues to trade below the eight-market reference average, while Hungary retains an import premium. These observations describe the simulated demonstration dataset.",
      ],
      [
        "Price formation",
        "The mock profile places the daily trough around solar noon and the high during the evening ramp. Hourly settlement prices should be interpreted alongside scheduled exchanges and the availability of flexible generation.",
      ],
      [
        "Interconnections",
        "The Bulgaria–Greece corridor remains a significant export route in the scenario. Regional price convergence is sensitive to available cross-border capacity; scheduled power flows are distinct from physical measurements.",
      ],
      [
        "Next week’s watchlist",
        "Monitor the evening ramp, renewable forecast revisions, and changes in import requirements. Use the regional comparison dashboard to inspect price spreads and the Data Explorer to compare individual intervals.",
      ],
    ],
  },
  {
    id: "renewable-capture",
    title: "The renewable capture price perspective",
    type: "Renewables research",
    date: "2026-09-05",
    description:
      "What solar-heavy hours mean for captured revenues and daily price shape.",
    read: "6 min read",
    sections: [
      [
        "Solar and price shape",
        "In this simulation, solar output peaks near midday while energy prices soften. Renewable capture price is shown as an illustrative discounted market price; it is not an asset-specific revenue calculation.",
      ],
      [
        "The evening transition",
        "As solar generation falls, flexible supply meets the evening demand peak. The modeled profile reflects this relationship with a higher price around 19:00 UTC.",
      ],
      [
        "Analytical approach",
        "Compare hourly generation with day-ahead prices, then inspect the spread between average and capture prices in Advanced Market Intelligence. Export the selected records to perform a weighted calculation outside the demo.",
      ],
    ],
  },
  {
    id: "negative-prices",
    title: "Negative prices: frequency and duration",
    type: "Deep dive",
    date: "2026-09-03",
    description:
      "A closer look at negative-price episodes in renewable-rich bidding zones.",
    read: "10 min read",
    sections: [
      [
        "When prices turn negative",
        "The simulated dataset includes occasional negative midday intervals in Greece, Romania, and Poland. These are deterministic scenarios designed to demonstrate the analytics and do not represent observed market events.",
      ],
      [
        "Measuring exposure",
        "Frequency counts intervals below zero. Duration multiplies this count by the interval length. Daily and monthly averages may hide brief negative episodes, so use hourly or 15-minute resolution when assessing duration.",
      ],
      [
        "Explore the scenario",
        "Open Negative Price Analysis, select Greece, and choose a 30-day hourly window. The underlying table and CSV export make every modeled negative interval available for review.",
      ],
    ],
  },
  {
    id: "cross-border",
    title: "Cross-border capacity and regional spreads",
    type: "Regional intelligence",
    date: "2026-09-01",
    description:
      "How scheduled exchanges connect national electricity markets.",
    read: "7 min read",
    sections: [
      [
        "A connected market",
        "National energy balances depend on domestic generation, consumption, and cross-border exchanges. The demo network illustrates the major connections among eight European bidding zones.",
      ],
      [
        "Reading the flow dashboard",
        "Imports and exports are positive directional totals. Net exports are exports minus imports. Positive net flow represents an exporting market in the selected interval.",
      ],
      [
        "Interpreting spreads",
        "A sustained price difference may indicate transmission constraints, differing supply mixes, or different demand profiles. The demonstration does not model network constraints or produce trading recommendations.",
      ],
    ],
  },
];
