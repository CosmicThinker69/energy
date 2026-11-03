"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import type { BotAnswer, BotDocument, BotStatus } from "@/lib/bot";
import { Badge, Icon } from "./ui";
import { BotResult } from "./bot-result";

type Exchange = {
  id: string;
  question: string;
  answer?: BotAnswer;
  error?: string;
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/bot/${path}`, {
    ...init,
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      data.error || "The assistant is unavailable. Please try again.",
    );
  return data as T;
}

export function Assistant({ isAdmin }: { isAdmin: boolean }) {
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [documents, setDocuments] = useState<BotDocument[]>([]);
  const [refreshing, setRefreshing] = useState(true);
  const [connectionError, setConnectionError] = useState("");
  const [question, setQuestion] = useState("");
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [asking, setAsking] = useState(false);
  const [managing, setManaging] = useState(false);
  const [libraryError, setLibraryError] = useState("");
  const [notice, setNotice] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const requestController = useRef<AbortController | null>(null);
  const questionInput = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const activeExchange = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    setRefreshing(true);
    setConnectionError("");
    try {
      const [health, files] = await Promise.all([
        api<BotStatus>("status", { signal }),
        api<BotDocument[]>("documents", { signal }),
      ]);
      if (signal?.aborted) return;
      setStatus(health);
      setDocuments(files);
    } catch (cause) {
      if (signal?.aborted) return;
      setStatus(null);
      setConnectionError(
        cause instanceof Error
          ? cause.message
          : "The assistant is unavailable.",
      );
    } finally {
      if (!signal?.aborted) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => {
      controller.abort();
      requestController.current?.abort();
    };
  }, [refresh]);

  useEffect(() => {
    if (asking) activeExchange.current?.scrollIntoView({ block: "nearest" });
  }, [asking]);

  const hasData = !!status && (status.chunks > 0 || status.tables > 0);
  const canAsk = !!status?.llm_ok && hasData && !managing && !refreshing;

  async function ask(event: FormEvent) {
    event.preventDefault();
    if (!question.trim() || !canAsk || requestController.current) return;
    const id = crypto.randomUUID();
    const text = question.trim();
    const controller = new AbortController();
    requestController.current = controller;
    setAsking(true);
    setQuestion("");
    setExchanges((items) => [...items, { id, question: text }]);
    try {
      const answer = await api<BotAnswer>("ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text }),
        signal: controller.signal,
      });
      setExchanges((items) =>
        items.map((item) => (item.id === id ? { ...item, answer } : item)),
      );
    } catch (cause) {
      if (!controller.signal.aborted)
        setExchanges((items) =>
          items.map((item) =>
            item.id === id
              ? {
                  ...item,
                  error:
                    cause instanceof Error
                      ? cause.message
                      : "Your question could not be answered.",
                }
              : item,
          ),
        );
    } finally {
      requestController.current = null;
      setAsking(false);
    }
  }

  async function upload(files: FileList | null) {
    if (!files?.length || managing || asking) return;
    setLibraryError("");
    setNotice("");
    if (
      [...files].some((file) => !/\.(pdf|xlsx|xlsm|xls|csv)$/i.test(file.name))
    ) {
      setLibraryError("Choose PDF, Excel or CSV files.");
      return;
    }
    if (
      [...files].reduce((sum, file) => sum + file.size, 0) >
      19 * 1024 * 1024
    ) {
      setLibraryError("Keep each upload below 19 MB in total.");
      return;
    }
    const form = new FormData();
    for (const file of files) form.append("files", file);
    setManaging(true);
    try {
      const reports = await api<
        { file: string; chunks: number; tables: number; warnings: string[] }[]
      >("upload", { method: "POST", body: form });
      setNotice(
        reports
          .map(
            (report) =>
              `${report.file}: ${report.chunks} passages, ${report.tables} tables.${report.warnings.length ? ` ${report.warnings.join(" ")}` : ""}`,
          )
          .join(" "),
      );
      await refresh();
    } catch (cause) {
      setLibraryError(
        cause instanceof Error
          ? cause.message
          : "Upload failed. Please try again.",
      );
    } finally {
      setManaging(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function remove(name: string) {
    setManaging(true);
    setLibraryError("");
    setNotice("");
    try {
      await api(`documents/${encodeURIComponent(name)}`, { method: "DELETE" });
      setDeleting(null);
      setNotice(`${name} removed from the library.`);
      await refresh();
    } catch (cause) {
      setLibraryError(
        cause instanceof Error
          ? cause.message
          : "The document could not be removed.",
      );
    } finally {
      setManaging(false);
    }
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Ask TEMO</h1>
          <p>Questions about your research. Answers with sources.</p>
        </div>
        <Badge tone="violet">Premium intelligence</Badge>
      </div>
      <div className="assistant-layout">
        <section
          className="panel assistant-chat"
          aria-label="Research assistant"
        >
          <div className="assistant-toolbar">
            <h2>Research conversation</h2>
            <button
              className="text-button"
              disabled={asking || !exchanges.length}
              onClick={() => setExchanges([])}
            >
              Clear conversation
            </button>
          </div>
          <div
            className="assistant-thread"
            role="log"
            aria-label="Research questions and answers"
            aria-live="polite"
          >
            {!exchanges.length && (
              <div className="assistant-intro">
                <Icon name="book" size={28} />
                <h2>Start with a question</h2>
                <p>
                  Explore market outlooks, compare figures, or find the
                  explanation behind a trend in the shared research library.
                </p>
                <div className="assistant-suggestions">
                  {[
                    "What are the main risks discussed in these reports?",
                    "Compare the growth forecasts in the uploaded documents.",
                  ].map((text) => (
                    <button
                      key={text}
                      disabled={!canAsk}
                      onClick={() => {
                        setQuestion(text);
                        questionInput.current?.focus();
                      }}
                    >
                      {text}
                      <Icon name="right" size={16} />
                    </button>
                  ))}
                </div>
              </div>
            )}
            {exchanges.map((exchange, i) => (
              <div
                className="assistant-exchange"
                key={exchange.id}
                ref={i === exchanges.length - 1 ? activeExchange : undefined}
              >
                <article className="assistant-question">
                  <h3>You</h3>
                  <p>{exchange.question}</p>
                </article>
                <article className="assistant-answer" aria-label="TEMO answer">
                  <h3>
                    <Icon name="sparkles" size={16} />
                    TEMO
                  </h3>
                  {exchange.answer ? (
                    <BotResult result={exchange.answer} />
                  ) : exchange.error ? (
                    <div className="form-error" role="alert">
                      <p>{exchange.error}</p>
                      <button
                        className="text-button"
                        onClick={() => {
                          setQuestion(exchange.question);
                          questionInput.current?.focus();
                        }}
                      >
                        Use question again
                      </button>
                    </div>
                  ) : (
                    <div className="assistant-thinking" role="status">
                      <p>Searching the library and preparing your answer…</p>
                      <div className="skeleton" />
                      <div className="skeleton" />
                    </div>
                  )}
                </article>
              </div>
            ))}
          </div>
          <div className="assistant-composer">
            {refreshing && !status ? (
              <p role="status" className="muted">
                Connecting to the research library…
              </p>
            ) : connectionError ? (
              <p className="form-error" role="alert">
                {connectionError}
              </p>
            ) : !status?.llm_ok ? (
              <p className="bot-query-warning" role="status">
                The answer service is unavailable. Your research library is
                still accessible. Try reconnecting shortly.
              </p>
            ) : !hasData ? (
              <p className="muted">
                {isAdmin
                  ? "Upload a research document to start asking questions."
                  : "The research library is empty. Ask your workspace administrator to add documents."}
              </p>
            ) : null}
            <form onSubmit={ask}>
              <label htmlFor="assistant-question">Your question</label>
              <textarea
                ref={questionInput}
                id="assistant-question"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Ask about the documents in your library…"
                maxLength={8000}
                rows={3}
                disabled={asking || !canAsk}
                aria-describedby="assistant-question-help"
                required
              />
              <div className="assistant-compose-footer">
                <p id="assistant-question-help">
                  Each question is answered independently. Check sources before
                  using an answer.
                </p>
                <button
                  className="button primary"
                  disabled={asking || !canAsk || !question.trim()}
                  type="submit"
                >
                  {asking ? "Preparing answer…" : "Ask TEMO"}
                  <Icon name="right" size={16} />
                </button>
              </div>
            </form>
          </div>
        </section>
        <aside
          className="panel assistant-library"
          aria-label="Shared research library"
        >
          <div className="assistant-toolbar">
            <h2>Research library</h2>
            <button
              className="icon-button"
              aria-label="Reconnect assistant"
              onClick={() => void refresh()}
              disabled={refreshing || asking || managing}
            >
              <Icon name="refresh" />
            </button>
          </div>
          <div className="assistant-library-body">
            <Badge
              dot
              tone={refreshing ? "subtle" : status?.llm_ok ? "green" : "amber"}
            >
              {refreshing
                ? "Connecting"
                : status?.llm_ok
                  ? "Ready"
                  : status
                    ? "Model unavailable"
                    : "Not connected"}
            </Badge>
            <p className="muted">
              Shared with Premium members. Answers use the uploaded documents,
              rather than the live market feed.
            </p>
            {status && (
              <p className="assistant-library-count">
                {status.chunks} passages · {status.tables} tables
              </p>
            )}
            {refreshing && !status ? (
              <div className="skeleton assistant-library-skeleton" />
            ) : !documents.length ? (
              <p className="muted">
                {connectionError
                  ? "Reconnect to view the library."
                  : "No documents uploaded yet."}
              </p>
            ) : (
              <ul className="assistant-document-list">
                {documents.map((document) => (
                  <li key={document.name}>
                    <div className="assistant-document">
                      <Icon name="report" />
                      <span>{document.name}</span>
                      {isAdmin && (
                        <button
                          className="icon-button"
                          aria-label={`Remove ${document.name}`}
                          disabled={managing || asking || !status}
                          onClick={() => setDeleting(document.name)}
                        >
                          <Icon name="close" size={15} />
                        </button>
                      )}
                    </div>
                    {deleting === document.name && (
                      <div className="assistant-delete">
                        <p>Remove this document for everyone?</p>
                        <div>
                          <button
                            className="text-button"
                            disabled={managing}
                            onClick={() => void remove(document.name)}
                          >
                            Remove
                          </button>
                          <button
                            className="text-button"
                            disabled={managing}
                            onClick={() => setDeleting(null)}
                          >
                            Keep document
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {isAdmin && (
              <div className="assistant-upload">
                <label htmlFor="assistant-files">Add research documents</label>
                <input
                  ref={fileInput}
                  id="assistant-files"
                  type="file"
                  multiple
                  accept=".pdf,.xlsx,.xlsm,.xls,.csv"
                  disabled={!status || managing || asking || refreshing}
                  onChange={(event) => void upload(event.target.files)}
                />
                <p className="muted">
                  PDF, Excel or CSV · Up to 19 MB per upload. Uploading the same
                  filename replaces it.
                </p>
                {managing && (
                  <p role="status">
                    Updating the library. Large reports may take several
                    minutes…
                  </p>
                )}
              </div>
            )}
            {libraryError && (
              <p className="form-error" role="alert">
                {libraryError}
              </p>
            )}
            {notice && (
              <p className="assistant-notice" role="status">
                {notice}
              </p>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
