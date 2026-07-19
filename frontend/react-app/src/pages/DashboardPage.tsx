import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BrandLogo } from "../components/BrandLogo";
import { API_URL, readError } from "../lib/api";
import type { Session } from "../types";
import "./DashboardPage.css";
import "./UploadSelector.css";

type DiscrepancyType =
  | "MATCHED"
  | "MISSING_PAYMENT"
  | "ORPHAN_PAYMENT"
  | "AMOUNT_MISMATCH"
  | "DUPLICATE_PAYMENT"
  | "DUPLICATE_ORDER"
  | "CURRENCY_MISMATCH";
type DashboardDiscrepancy = {
  id: string;
  orderId: string | null;
  paymentReference: string | null;
  type: DiscrepancyType;
  severity: "LOW" | "MEDIUM" | "HIGH";
  amountAtRisk: number;
  currency: string;
  createdAt: string;
};
type DashboardData = {
  upload: {
    id: string;
    createdAt: string;
    ordersFileName: string | null;
    paymentsFileName: string | null;
  } | null;
  metrics: {
    totalOrders: number;
    totalPayments: number;
    totalValueReconciled: number;
    totalValueInDispute: number;
    moneyAtRisk: number;
  };
  breakdown: { type: DiscrepancyType; count: number; valueAtRisk: number }[];
  reconciliations: DashboardDiscrepancy[];
  discrepancies: DashboardDiscrepancy[];
};
type UploadSummary = {
  id: string;
  status: "PROCESSING" | "COMPLETED" | "FAILED";
  createdAt: string;
  ordersFileName: string | null;
  paymentsFileName: string | null;
  _count: { orders: number; payments: number; reconciliations: number };
};
type DashboardPageProps = { session: Session; onSignOut: () => void };

const typeMeta: Record<DiscrepancyType, { color: string; label: string }> = {
  MATCHED: { color: "#5f9d55", label: "Matched" },
  MISSING_PAYMENT: { color: "#df6b55", label: "Missing payment" },
  ORPHAN_PAYMENT: { color: "#d77852", label: "Orphan payment" },
  AMOUNT_MISMATCH: { color: "#e7a941", label: "Amount mismatch" },
  DUPLICATE_PAYMENT: { color: "#718ddd", label: "Duplicate payment" },
  DUPLICATE_ORDER: { color: "#54a18a", label: "Duplicate order" },
  CURRENCY_MISMATCH: { color: "#8b6dc6", label: "Currency mismatch" },
};

const money = (value: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);

export function DashboardPage({ session, onSignOut }: DashboardPageProps) {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [uploads, setUploads] = useState<UploadSummary[]>([]);
  const [selectedUploadId, setSelectedUploadId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isReconciling, setIsReconciling] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"All" | DiscrepancyType>("All");
  const [activeType, setActiveType] = useState<"All" | DiscrepancyType>("All");

  const loadDashboard = async (uploadId = selectedUploadId) => {
    setIsLoading(true);
    setError("");
    try {
      const query = uploadId ? `?uploadId=${encodeURIComponent(uploadId)}` : "";
      const response = await fetch(`${API_URL}/dashboard${query}`, {
        headers: { Authorization: `Bearer ${session.token}` },
      });
      if (response.status === 401) {
        onSignOut();
        navigate("/sign-in", { replace: true });
        return;
      }
      if (!response.ok) throw new Error(await readError(response));
      setDashboard((await response.json()) as DashboardData);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The dashboard could not be loaded.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const runReconciliation = async () => {
    const uploadId = selectedUploadId || dashboard?.upload?.id;
    if (!uploadId) return;
    setIsReconciling(true);
    setError("");
    try {
      const response = await fetch(
        `${API_URL}/reconciliations/${encodeURIComponent(uploadId)}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${session.token}` },
        },
      );
      if (response.status === 401) {
        onSignOut();
        navigate("/sign-in", { replace: true });
        return;
      }
      if (!response.ok) throw new Error(await readError(response));
      await loadDashboard(uploadId);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The reconciliation could not be run.",
      );
    } finally {
      setIsReconciling(false);
    }
  };

  useEffect(() => {
    let isCurrent = true;
    void fetch(`${API_URL}/dashboard`, {
      headers: { Authorization: `Bearer ${session.token}` },
    })
      .then(async (response) => {
        if (response.status === 401) {
          onSignOut();
          navigate("/sign-in", { replace: true });
          return null;
        }
        if (!response.ok) throw new Error(await readError(response));
        return response.json() as Promise<DashboardData>;
      })
      .then((data) => {
        if (isCurrent && data) setDashboard(data);
      })
      .catch((caught: unknown) => {
        if (isCurrent)
          setError(
            caught instanceof Error
              ? caught.message
              : "The dashboard could not be loaded.",
          );
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });
    void fetch(`${API_URL}/uploads`, {
      headers: { Authorization: `Bearer ${session.token}` },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(await readError(response));
        return response.json() as Promise<UploadSummary[]>;
      })
      .then((data) => {
        if (isCurrent) setUploads(data);
      })
      .catch((caught: unknown) => {
        if (isCurrent)
          setError(
            caught instanceof Error
              ? caught.message
              : "The upload list could not be loaded.",
          );
      });
    return () => {
      isCurrent = false;
    };
  }, [navigate, onSignOut, session.token]);

  const selectedType = activeType === "All" ? filter : activeType;
  const discrepancies = useMemo(
    () => dashboard?.discrepancies ?? [],
    [dashboard],
  );
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    return discrepancies.filter((item) => {
      const matchesType = selectedType === "All" || item.type === selectedType;
      const haystack = `${item.id} ${item.orderId ?? ""} ${item.paymentReference ?? ""} ${typeMeta[item.type].label}`.toLowerCase();
      return matchesType && haystack.includes(normalizedQuery);
    });
  }, [discrepancies, normalizedQuery, selectedType]);
  const breakdown = dashboard?.breakdown ?? [];
  const maxCount = Math.max(1, ...breakdown.map((item) => item.count));
  const missingPayment = breakdown.find(
    (item) => item.type === "MISSING_PAYMENT",
  );
  const missingPaymentShare =
    dashboard?.metrics.moneyAtRisk && missingPayment
      ? Math.round(
          (missingPayment.valueAtRisk / dashboard.metrics.moneyAtRisk) * 100,
        )
      : 0;
  const highestRisk = discrepancies[0];
  const activeUploadId = selectedUploadId || dashboard?.upload?.id || "";
  const completedUploads = uploads.filter(
    (upload) => upload.status === "COMPLETED",
  );

  return (
    <main className="app-shell dashboard-shell">
      <header className="topbar">
        <BrandLogo dark />
        <div className="account">
          <nav className="topnav">
            <Link className="active" to="/dashboard">
              Dashboard
            </Link>
            <Link to="/upload">Import</Link>
          </nav>
          <span>{session.user.name || session.user.email}</span>
          <button onClick={onSignOut}>Sign out</button>
        </div>
      </header>
      <section className="dashboard-workspace">
        <div className="dashboard-heading">
          <div>
            <p className="eyebrow">Reconciliation overview</p>
            <h1>Here’s what needs attention.</h1>
            <p>
              {dashboard?.upload
                ? "Monitor the latest completed import and move straight to the records behind its exceptions."
                : "Import orders and payments to start reconciling your data."}
            </p>
          </div>
          <div className="reporting-period">
            <span className="live-dot" />
            {isLoading
              ? "Updating…"
              : dashboard?.upload
                ? "Latest completed import"
                : "No completed import"}
            <button
              onClick={() => void loadDashboard()}
              disabled={isLoading}
              aria-label="Refresh dashboard"
            >
              ↻
            </button>
          </div>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {isLoading ? (
          <div className="dashboard-loading">Loading reconciliation data…</div>
        ) : (
          <>
            <section className="panel upload-run-panel">
              <div>
                <p className="section-label">Choose an import</p>
                <h2>Run reconciliation for an upload</h2>
                <p>
                  Select a completed CSV import to view its individual records
                  and refresh its saved insights.
                </p>
              </div>
              <div className="upload-run-controls">
                <select
                  value={activeUploadId}
                  onChange={(event) => {
                    setSelectedUploadId(event.target.value);
                    setQuery("");
                    setFilter("All");
                    setActiveType("All");
                    void loadDashboard(event.target.value);
                  }}
                  aria-label="Select upload"
                >
                  <option value="" disabled>
                    {completedUploads.length
                      ? "Select an upload"
                      : "No completed uploads"}
                  </option>
                  {completedUploads.map((upload) => (
                    <option key={upload.id} value={upload.id}>
                      {new Date(upload.createdAt).toLocaleString()} ·{" "}
                      {upload._count.orders} orders · {upload._count.payments}{" "}
                      payments
                    </option>
                  ))}
                </select>
                <button
                  className="primary-button"
                  onClick={() => void runReconciliation()}
                  disabled={!activeUploadId || isReconciling}
                >
                  {isReconciling ? "Reconciling…" : "Run reconciliation"}
                </button>
              </div>
            </section>
            <section className="metric-grid" aria-label="Headline figures">
              <Metric
                label="Total orders"
                value={String(dashboard?.metrics.totalOrders ?? 0)}
                hint="Latest import"
              />
              <Metric
                label="Total payments"
                value={String(dashboard?.metrics.totalPayments ?? 0)}
                hint="Latest import"
              />
              <Metric
                label="Value reconciled"
                value={money(dashboard?.metrics.totalValueReconciled ?? 0)}
                hint="Exact matches"
                positive
              />
              <Metric
                label="Value in dispute"
                value={money(dashboard?.metrics.totalValueInDispute ?? 0)}
                hint="Amount and currency exceptions"
                warn
              />
              <Metric
                label="Money at risk"
                value={money(dashboard?.metrics.moneyAtRisk ?? 0)}
                hint="Requires review"
                danger
              />
            </section>
            <section className="insight-grid">
              <article className="panel breakdown-panel">
                <div className="panel-heading">
                  <div>
                    <p className="section-label">Exceptions by type</p>
                    <h2>What kind of problems?</h2>
                  </div>
                  <span className="muted-total">
                    {discrepancies.length} total
                  </span>
                </div>
                {breakdown.length > 0 ? (
                  <>
                    <div
                      className="chart-list"
                      role="img"
                      aria-label="Bar chart showing discrepancy counts by type"
                    >
                      {breakdown.map((item) => (
                        <button
                          className={`chart-row ${activeType === item.type ? "selected" : ""}`}
                          key={item.type}
                          onClick={() =>
                            setActiveType(
                              activeType === item.type ? "All" : item.type,
                            )
                          }
                        >
                          <span className="chart-label">
                            <i
                              style={{ background: typeMeta[item.type].color }}
                            />
                            {typeMeta[item.type].label}
                          </span>
                          <span className="chart-track">
                            <span
                              style={{
                                width: `${(item.count / maxCount) * 100}%`,
                                background: typeMeta[item.type].color,
                              }}
                            />
                          </span>
                          <strong>{item.count}</strong>
                          <em>{money(item.valueAtRisk)}</em>
                        </button>
                      ))}
                    </div>
                    <p className="chart-note">
                      Select a category to focus the discrepancy table.
                    </p>
                  </>
                ) : (
                  <p className="chart-note dashboard-empty-copy">
                    No discrepancies were found in this import.
                  </p>
                )}
              </article>
              <article className="panel priority-panel">
                <p className="section-label">Triage queue</p>
                <h2>Which ones first?</h2>
                {highestRisk ? (
                  <>
                    <p className="priority-copy">
                      {missingPayment ? (
                        <>
                          Start with missing payments: they make up{" "}
                          <strong>{missingPaymentShare}%</strong> of the value
                          currently at risk.
                        </>
                      ) : (
                        <>Start with the largest exception by value at risk.</>
                      )}
                    </p>
                    <div className="priority-stat">
                      <span>Highest-risk record</span>
                      <strong>
                        {highestRisk.orderId ??
                          highestRisk.paymentReference ??
                          "Unlinked record"}{" "}
                        <em>
                          {money(
                            highestRisk.amountAtRisk,
                            highestRisk.currency,
                          )}
                        </em>
                      </strong>
                    </div>
                    {missingPayment && (
                      <button
                        className="text-button"
                        onClick={() => {
                          setActiveType("MISSING_PAYMENT");
                          setFilter("All");
                        }}
                      >
                        View missing payments <span>→</span>
                      </button>
                    )}
                  </>
                ) : (
                  <p className="priority-copy">
                    No exceptions need review in this import.
                  </p>
                )}
              </article>
            </section>
            <section className="panel discrepancies-panel">
              <div className="table-heading">
                <div>
                  <p className="section-label">Discrepancy register</p>
                  <h2>Investigate individual records</h2>
                  <p>
                    {filtered.length}{" "}
                    {filtered.length === 1 ? "record" : "records"} shown
                    {selectedType !== "All"
                      ? ` · ${typeMeta[selectedType].label}`
                      : ""}
                  </p>
                </div>
                <div className="table-controls">
                  <label className="search-field">
                    <span>⌕</span>
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search order, payment, or ID"
                      aria-label="Search discrepancies"
                    />
                  </label>
                  <select
                    value={filter}
                    onChange={(event) => {
                      setFilter(event.target.value as "All" | DiscrepancyType);
                      setActiveType("All");
                    }}
                    aria-label="Filter discrepancies by type"
                  >
                    <option value="All">All types</option>
                    {breakdown.map((item) => (
                      <option key={item.type} value={item.type}>
                        {typeMeta[item.type].label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Reconciliation</th>
                      <th>Order / payment</th>
                      <th>Issue</th>
                      <th>Amount at risk</th>
                      <th>Detected</th>
                      <th>Severity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <strong>{item.id}</strong>
                        </td>
                        <td>
                          <strong>{item.orderId ?? "No order found"}</strong>
                          <span>
                            {item.paymentReference ?? "No payment found"}
                          </span>
                        </td>
                        <td>
                          <span
                            className="issue-tag"
                            style={
                              {
                                "--tag-color": typeMeta[item.type].color,
                              } as CSSProperties
                            }
                          >
                            {typeMeta[item.type].label}
                          </span>
                        </td>
                        <td className="amount-cell">
                          {money(item.amountAtRisk, item.currency)}
                          <span>{item.currency}</span>
                        </td>
                        <td>{new Date(item.createdAt).toLocaleDateString()}</td>
                        <td>
                          <span
                            className={`status-pill ${item.severity === "HIGH" ? "open" : ""}`}
                          >
                            {item.severity}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filtered.length === 0 && (
                  <div className="empty-state">
                    No discrepancies match that search or filter.
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </section>
    </main>
  );
}

function Metric({
  label,
  value,
  hint,
  positive,
  warn,
  danger,
}: {
  label: string;
  value: string;
  hint: string;
  positive?: boolean;
  warn?: boolean;
  danger?: boolean;
}) {
  return (
    <article
      className={`metric-card ${positive ? "positive" : ""} ${warn ? "warn" : ""} ${danger ? "danger" : ""}`}
    >
      <p>{label}</p>
      <strong>{value}</strong>
      <span>{hint}</span>
    </article>
  );
}
