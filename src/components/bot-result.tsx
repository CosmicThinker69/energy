"use client";

import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { BotAnswer } from "@/lib/bot";

function ResultChart({ table }: { table: NonNullable<BotAnswer["table"]> }) {
  if (table.rows.length < 2 || !table.numeric.length) return null;
  const year = table.columns.find((column) => /^(year|година)$/i.test(column));
  const label =
    year || table.columns.find((column) => !table.numeric.includes(column));
  if (!label) return null;
  const values = table.numeric
    .filter((column) => column !== label && !/^(published|id)$/i.test(column))
    .slice(0, 4);
  if (!values.length) return null;
  const labelIndex = table.columns.indexOf(label);
  const category =
    year &&
    table.columns.find(
      (column) => column !== year && !table.numeric.includes(column),
    );
  let series: { key: string; label: string }[];
  let data: Record<string, string | number | boolean | null>[];
  if (category && values.length === 1) {
    const categoryIndex = table.columns.indexOf(category);
    const valueIndex = table.columns.indexOf(values[0]);
    const categories = [
      ...new Set(table.rows.map((row) => row[categoryIndex])),
    ].slice(0, 8);
    series = categories.map((value, i) => ({
      key: `value${i}`,
      label: String(value),
    }));
    data = [...new Set(table.rows.map((row) => row[labelIndex]))]
      .sort()
      .map((value) => ({
        label: String(value),
        ...Object.fromEntries(
          categories.map((cat, i) => [
            `value${i}`,
            table.rows.find(
              (row) => row[labelIndex] === value && row[categoryIndex] === cat,
            )?.[valueIndex] ?? null,
          ]),
        ),
      }));
  } else {
    series = values.map((value, i) => ({ key: `value${i}`, label: value }));
    data = table.rows.map((row) => ({
      label: String(row[labelIndex] ?? ""),
      ...Object.fromEntries(
        values.map((value, i) => [
          `value${i}`,
          row[table.columns.indexOf(value)],
        ]),
      ),
    }));
  }
  const colors = [
    "var(--mint)",
    "var(--cyan)",
    "var(--violet)",
    "var(--amber)",
    "var(--rose)",
    "var(--blue)",
    "var(--pink)",
    "var(--slate)",
  ];
  const Chart = year ? LineChart : BarChart;
  return (
    <div
      className="bot-chart"
      role="img"
      aria-label={`Chart of ${series.map((s) => s.label).join(", ")} by ${label}. Values are available in the result table.`}
    >
      <ResponsiveContainer width="100%" height={280}>
        <Chart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: "var(--muted)", fontSize: 12 }}
          />
          <YAxis tick={{ fill: "var(--muted)", fontSize: 12 }} width={64} />
          <Tooltip
            contentStyle={{
              background: "var(--panel)",
              borderColor: "var(--border)",
              color: "var(--text)",
            }}
          />
          <Legend />
          {series.map((s, i) =>
            year ? (
              <Line
                key={s.key}
                dataKey={s.key}
                name={s.label}
                stroke={colors[i]}
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            ) : (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                fill={colors[i]}
                isAnimationActive={false}
              />
            ),
          )}
        </Chart>
      </ResponsiveContainer>
    </div>
  );
}

export function BotResult({ result }: { result: BotAnswer }) {
  return (
    <div className="bot-result">
      <div className="bot-prose">
        <Markdown
          remarkPlugins={[remarkGfm]}
          skipHtml
          disallowedElements={["img"]}
          components={{
            pre: ({ children }) => <pre tabIndex={0}>{children}</pre>,
            a: ({ children, href }) => (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            ),
            table: ({ children }) => (
              <div className="table-scroll">
                <table>{children}</table>
              </div>
            ),
          }}
        >
          {result.answer}
        </Markdown>
      </div>
      {result.table && result.table.rows.length > 0 && (
        <>
          <ResultChart table={result.table} />
          <div
            className="table-scroll bot-result-table"
            tabIndex={0}
            role="region"
            aria-label="Query result table"
          >
            <table>
              <caption>Query results</caption>
              <thead>
                <tr>
                  {result.table.columns.map((column, i) => (
                    <th key={i} scope="col">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.table.rows.map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) => (
                      <td key={j}>{cell === null ? "—" : String(cell)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {result.sql && (
        <details>
          <summary>SQL used</summary>
          <pre tabIndex={0}>
            <code>{result.sql}</code>
          </pre>
        </details>
      )}
      {result.sql_error && (
        <p className="bot-query-warning">
          The table query could not be completed. Check the cited excerpts
          before using this answer.
        </p>
      )}
      {result.sources.length > 0 && (
        <details>
          <summary>Sources ({result.sources.length})</summary>
          <ul className="bot-sources">
            {result.sources.map((source, i) => (
              <li key={i}>
                <strong>{source.citation}</strong>
                <p>{source.text}</p>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
