"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { plans, planName, type Plan } from "@/lib/config";
import { Badge, Icon, Logo } from "./ui";
export function AuthPage({
  mode,
}: {
  mode: "login" | "register" | "forgot" | "reset";
}) {
  const router = useRouter(),
    params = useSearchParams();
  const showSeedAccounts = process.env.NODE_ENV !== "production";
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [showPassword, setShowPassword] = useState(false),
    [complete, setComplete] = useState(false);
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState("");
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    const form = new FormData(e.currentTarget);
    const body = {
      ...Object.fromEntries(form),
      email,
      password,
      remember: form.get("remember") === "on",
      token: params.get("token"),
    };
    if (mode === "reset" && form.get("confirmPassword") !== password) {
      setError("Your passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      if (mode === "forgot") {
        setComplete(true);
      } else if (mode === "reset") {
        setComplete(true);
      } else {
        router.push("/");
        router.refresh();
      }
    } catch (e) {
      setError((e as Error).message || "Connection failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  const demo = (p: Plan) => {
    setEmail(`${p}@demo.com`);
    setPassword("Demo123!");
    setError("");
  };
  return (
    <main
      className={`auth-layout ${mode === "register" ? "register-layout" : ""}`}
      id="main-content"
    >
      <section className="auth-story">
        <Link href="/login" className="brand-link">
          <Logo />
        </Link>
        <div className="auth-story-main">
          <Badge tone="green" dot>
            European energy intelligence
          </Badge>
          <h1>
            A clearer view.
            <br />A better-informed
            <br />
            <span>energy market.</span>
          </h1>
          <p>
            Your connected workspace for electricity prices, generation, and the
            forces moving Europe’s energy markets.
          </p>
          <div className="auth-market-preview">
            <div className="auth-preview-head">
              <div>
                <span className="muted small">Bulgaria · Day-ahead price</span>
                <h2>
                  €87.42 <small>/ MWh</small>
                </h2>
              </div>
              <Badge tone="green">↘ 1.8%</Badge>
            </div>
            <svg
              viewBox="0 0 480 110"
              role="img"
              aria-label="Illustrative daily electricity price curve"
            >
              <defs>
                <linearGradient id="auth-fill" x1="0" x2="0" y1="0" y2="1">
                  <stop stopColor="var(--mint)" stopOpacity=".15" />
                  <stop offset="1" stopColor="var(--mint)" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[25, 55, 85].map((y) => (
                <line
                  key={y}
                  x1="0"
                  x2="480"
                  y1={y}
                  y2={y}
                  stroke="var(--border)"
                  strokeDasharray="3 5"
                />
              ))}
              <path
                d="M0 62 L20 68 L40 58 L60 64 L80 40 L100 44 L120 28 L140 42 L160 48 L180 65 L200 78 L220 83 L240 80 L260 85 L280 68 L300 60 L320 50 L340 35 L360 21 L380 32 L400 24 L420 35 L440 43 L460 39 L480 49 L480 110 L0 110 Z"
                fill="url(#auth-fill)"
              />
              <path
                d="M0 62 L20 68 L40 58 L60 64 L80 40 L100 44 L120 28 L140 42 L160 48 L180 65 L200 78 L220 83 L240 80 L260 85 L280 68 L300 60 L320 50 L340 35 L360 21 L380 32 L400 24 L420 35 L440 43 L460 39 L480 49"
                stroke="var(--mint)"
                strokeWidth="2"
                fill="none"
              />
            </svg>
            <div className="auth-chart-labels">
              <span>00:00</span>
              <span>06:00</span>
              <span>12:00</span>
              <span>18:00</span>
              <span>23:00 UTC</span>
            </div>
            <div className="auth-preview-bottom">
              <span>
                <span className="status-dot" />
                Simulated live market data
              </span>
              <span>8 European markets</span>
            </div>
          </div>
        </div>
        <div className="auth-story-footer">
          <span>Built for the energy perspective.</span>
          <span>© {new Date().getFullYear()} TEMO</span>
        </div>
      </section>
      <section className="auth-form-section">
        <div className="auth-mobile-logo">
          <Logo />
        </div>
        <div className="auth-top-link">
          {mode === "register" ? (
            <>
              Already have an account?{" "}
              <Link href="/login">
                Sign in <Icon name="right" size={14} />
              </Link>
            </>
          ) : (
            <>
              New to TEMO?{" "}
              <Link href="/register">
                Create an account <Icon name="right" size={14} />
              </Link>
            </>
          )}
        </div>
        <div
          className={`auth-form-wrap ${mode === "register" ? "wide-form" : ""}`}
        >
          <span className="auth-form-icon">
            <Icon
              name={mode === "forgot" || mode === "reset" ? "shield" : "zap"}
              size={23}
            />
          </span>
          <h2>
            {mode === "login"
              ? "Welcome back"
              : mode === "register"
                ? "Your market perspective starts here"
                : mode === "forgot"
                  ? "Forgot your password?"
                  : "Set a new password"}
          </h2>
          <p className="auth-subtitle">
            {mode === "login"
              ? "Sign in to your energy intelligence workspace."
              : mode === "register"
                ? "Create your account with Basic access to start."
                : mode === "forgot"
                  ? "Enter your account email to request recovery instructions."
                  : "Choose a strong password for your TEMO account."}
          </p>
          {complete ? (
            <div className="recovery-complete">
              <span className="large-icon">
                <Icon name="check" size={24} />
              </span>
              <h3>
                {mode === "reset"
                  ? "Password updated"
                  : "Recovery request received"}
              </h3>
              <p>
                {mode === "reset"
                  ? "You can now sign in with your new password."
                  : "If an account exists for that email, recovery instructions will be sent."}
              </p>
              <Link href="/login" className="button ghost full">
                Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={submit}>
              {mode === "register" && (
                <>
                  <div className="form-row">
                    <label>
                      First name
                      <input
                        name="firstName"
                        autoComplete="given-name"
                        placeholder="Alex"
                        maxLength={100}
                        required
                      />
                    </label>
                    <label>
                      Last name
                      <input
                        name="lastName"
                        autoComplete="family-name"
                        placeholder="Morgan"
                        maxLength={100}
                        required
                      />
                    </label>
                  </div>
                  <label>
                    Company
                    <input
                      name="company"
                      autoComplete="organization"
                      placeholder="Meridian Energy"
                      maxLength={100}
                      required
                    />
                  </label>
                </>
              )}
              {mode !== "reset" && (
                <label>
                  Work email
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    maxLength={254}
                    required
                  />
                </label>
              )}
              {mode !== "forgot" && (
                <>
                  <label>
                    Password
                    <div className="password-input">
                      <input
                        name="password"
                        aria-label="Password"
                        type={showPassword ? "text" : "password"}
                        autoComplete={
                          mode === "login" ? "current-password" : "new-password"
                        }
                        placeholder={
                          mode === "login"
                            ? "Enter your password"
                            : "Create a password"
                        }
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        minLength={mode === "login" ? 1 : 8}
                        maxLength={128}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={
                          showPassword ? "Hide password" : "Show password"
                        }
                      >
                        {showPassword ? "Hide" : "Show"}
                      </button>
                    </div>
                  </label>
                  {mode !== "login" && (
                    <>
                      <span className="field-help">
                        At least 8 characters, with uppercase, lowercase, and a
                        number.
                      </span>
                      <label>
                        Confirm password
                        <input
                          name="confirmPassword"
                          type={showPassword ? "text" : "password"}
                          autoComplete="new-password"
                          placeholder="Repeat your password"
                          maxLength={128}
                          required
                        />
                      </label>
                    </>
                  )}
                </>
              )}
              {mode === "login" && (
                <div className="form-between">
                  <label className="checkbox-label">
                    <input type="checkbox" name="remember" />
                    Remember me
                  </label>
                  <Link href="/forgot-password">Forgot password?</Link>
                </div>
              )}
              {mode === "register" && (
                <div className="workspace-note">
                  <Icon name="shield" size={18} />
                  <div>
                    <strong>Basic access included</strong>
                    <p>Your new account begins on the Basic plan.</p>
                  </div>
                </div>
              )}
              {error && (
                <div className="form-error" role="alert">
                  <Icon name="warning" size={16} />
                  {error}
                </div>
              )}
              <button
                className="button primary full auth-submit"
                disabled={busy}
              >
                {busy
                  ? "Please wait…"
                  : mode === "login"
                    ? "Sign in to workspace"
                    : mode === "register"
                      ? "Create your account"
                      : mode === "forgot"
                        ? "Get recovery link"
                        : "Update password"}
                <Icon name="right" size={16} />
              </button>
            </form>
          )}
          {mode === "login" && showSeedAccounts && (
            <div className="demo-accounts">
              <div className="divider-label">
                <span>Just looking around?</span>
              </div>
              <p>Choose a seeded test account for an access level.</p>
              <div className="demo-buttons">
                {plans.map((p) => (
                  <button
                    type="button"
                    key={p}
                    className={`button ${email === `${p}@demo.com` ? "selected" : ""}`}
                    onClick={() => demo(p)}
                  >
                    {planName(p)}
                    <Icon name="right" size={12} />
                  </button>
                ))}
              </div>
              <small>
                All seeded accounts use <code>Demo123!</code>
              </small>
            </div>
          )}
          {mode === "forgot" && !complete && (
            <Link href="/login" className="back-link">
              <Icon name="left" size={14} />
              Back to sign in
            </Link>
          )}
          <div className="auth-disclaimer">
            <Icon name="shield" size={14} />
            <span>Secure account access. Market data remains simulated.</span>
          </div>
        </div>
      </section>
    </main>
  );
}
