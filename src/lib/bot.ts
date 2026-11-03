export type BotDocument = { name: string; tables: number };
export type BotStatus = {
  llm_ok: boolean;
  chunks: number;
  tables: number;
};
export type BotAnswer = {
  answer: string;
  route: string;
  sql: string | null;
  sql_error: string | null;
  table: {
    columns: string[];
    rows: (string | number | boolean | null)[][];
    numeric: string[];
  } | null;
  sources: { citation: string; kind: string; score: number; text: string }[];
};
