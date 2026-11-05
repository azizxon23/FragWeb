"use client";
import { useEffect, useRef, useState } from "react";
import {
  ShieldCheck,
  Search,
  ArrowLeft,
  ArrowRight,
  X,
  Users,
  Package,
  EyeOff,
  UserX,
} from "lucide-react";
import { messages, type MessageKey } from "@/lib/i18n";
import { apiJson, errorInfo, errorText, type ErrorInfo } from "@/lib/errors";
import type { ApiHeaders, Profile } from "@/lib/account-types";
import type { Listing } from "@/lib/catalog";
type Audit = {
  id: string;
  action: string;
  targetId: string;
  reason: string;
  createdAt: number;
};
type AdminRow = Partial<Profile & Listing> & {
  id: string;
  isAdmin?: boolean;
  action?: string;
  reason?: string;
  targetId?: string;
};
type Data = {
  stats: {
    users: number;
    suspended: number;
    listings: number;
    active: number;
    hidden: number;
  };
  rows: AdminRow[];
  total: number;
  page: number;
};
type Action =
  | {
      action: "userStatus";
      id: string;
      status: "active" | "suspended";
      label: string;
    }
  | {
      action: "moderateListing";
      id: string;
      visibility: "visible" | "hidden";
      label: string;
    };
export default function AdminPanel({
  lang,
  headers,
  cityName,
}: {
  lang: number;
  headers: ApiHeaders;
  cityName: (city: string) => string;
}) {
  const t = (key: MessageKey) => messages[key][lang];
  const [section, setSection] = useState("users"),
    [query, setQuery] = useState(""),
    [page, setPage] = useState(1),
    [data, setData] = useState<Data | null>(null),
    [error, setError] = useState<ErrorInfo | null>(null),
    [loading, setLoading] = useState(true),
    [pending, setPending] = useState<Action | null>(null),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(false),
    [refresh, setRefresh] = useState(0);
  const counter = useRef(0);
  useEffect(() => {
    const request = ++counter.current;
    setLoading(true);
    setError(null);
    const abort = new AbortController();
    const timer = setTimeout(() => {
      fetch(
        `/api/admin?section=${section}&q=${encodeURIComponent(query)}&page=${page}`,
        { headers: headers(), signal: abort.signal },
      )
        .then(apiJson<Data>)
        .then((result) => {
          if (request === counter.current) setData(result);
        })
        .catch((e) => {
          if (!abort.signal.aborted && request === counter.current)
            setError(errorInfo(e));
        })
        .finally(() => {
          if (request === counter.current && !abort.signal.aborted)
            setLoading(false);
        });
    }, 200);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [section, query, page, refresh, lang]);
  async function apply(e: React.FormEvent) {
    e.preventDefault();
    if (!pending || busy) return;
    if (reason.trim().length < 5 || reason.trim().length > 300) {
      setError({ code: "reason" });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { label, ...action } = pending;
      await apiJson(
        await fetch("/api/admin", {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...headers() },
          body: JSON.stringify({ ...action, reason }),
        }),
      );
      setPending(null);
      setReason("");
      setNotice(true);
      setRefresh((x) => x + 1);
    } catch (e) {
      setError(errorInfo(e));
    } finally {
      setBusy(false);
    }
  }
  function begin(action: Action) {
    setPending(action);
    setReason("");
    setError(null);
    setNotice(false);
  }
  const date = (value: number | undefined) =>
    value
      ? new Date(value).toLocaleString(["en-GB", "ru-RU", "uz-UZ"][lang])
      : "—";
  return (
    <>
      <div className="admin-heading">
        <span className="modal-icon">
          <ShieldCheck size={24} />
        </span>
        <div>
          <div className="eyebrow">FRAGWEB</div>
          <h2 id="dialog-title">{t("adminPanel")}</h2>
        </div>
      </div>
      <p className="dialog-desc">{t("adminDesc")}</p>
      {data && (
        <div className="admin-stats">
          {(
            [
              { key: "totalUsers", value: data.stats.users, Icon: Users },
              {
                key: "totalListings",
                value: data.stats.listings,
                Icon: Package,
              },
              {
                key: "suspendedUsers",
                value: data.stats.suspended,
                Icon: UserX,
              },
              { key: "hiddenListings", value: data.stats.hidden, Icon: EyeOff },
            ] as const
          ).map(({ key, value, Icon }) => (
            <div key={key}>
              <Icon size={18} />
              <strong>{value}</strong>
              <span>{t(key)}</span>
            </div>
          ))}
        </div>
      )}
      <div className="admin-tabs tabs">
        {["users", "listings", "audit"].map((tab) => (
          <button
            className={section === tab ? "selected" : ""}
            key={tab}
            onClick={() => {
              setSection(tab);
              setPage(1);
              setQuery("");
              setPending(null);
              setNotice(false);
            }}
          >
            {t(tab as MessageKey)}
          </button>
        ))}
      </div>
      {section !== "audit" && (
        <div className="search admin-search">
          <Search size={17} />
          <input
            aria-label={t(
              section === "users" ? "adminSearch" : "listingSearch",
            )}
            placeholder={t(
              section === "users" ? "adminSearch" : "listingSearch",
            )}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />
        </div>
      )}
      {section === "users" && (
        <p className="fine-print">
          {t("privateInfo")}
          <br />
          {t("profileOnly")}
        </p>
      )}
      {notice && (
        <p className="notice" role="status">
          {t("actionSaved")}
        </p>
      )}
      {error && (
        <p className="notice error" role="alert">
          {errorText(error, lang)}
        </p>
      )}
      {pending && (
        <form className="moderation-confirm" onSubmit={apply} noValidate>
          <h3>{pending.label}</h3>
          <p>{t("reasonHelp")}</p>
          <label className="field">
            {t("reason")}
            <textarea
              name="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              minLength={5}
              maxLength={300}
              required
              disabled={busy}
            />
          </label>
          <div className="form-actions">
            <button
              className="outline"
              type="button"
              disabled={busy}
              onClick={() => {
                setPending(null);
                setError(null);
              }}
            >
              {t("cancel")}
            </button>
            <button className="primary" type="submit" disabled={busy}>
              {t(busy ? "saving" : "confirm")}
            </button>
          </div>
        </form>
      )}
      <div className="admin-records" aria-busy={loading}>
        {loading ? (
          <p className="empty compact">{t("loading")}</p>
        ) : !error && data?.rows.length === 0 ? (
          <p className="empty compact">{t("noRecords")}</p>
        ) : (
          !error &&
          data?.rows.map((row) => (
            <article className="admin-record" key={row.id}>
              {section === "users" ? (
                <>
                  <div className="record-top">
                    <div>
                      <h3>{row.displayName}</h3>
                      <span
                        className={
                          row.status === "suspended"
                            ? "status-badge danger"
                            : "status-badge"
                        }
                      >
                        {t(
                          row.status === "suspended"
                            ? "suspendedStatus"
                            : "activeStatus",
                        )}
                      </span>
                      {row.isAdmin && (
                        <span className="status-badge admin">
                          {t("administrator")}
                        </span>
                      )}
                    </div>
                    {!row.isAdmin && (
                      <button
                        className="outline"
                        disabled={busy}
                        onClick={() =>
                          begin({
                            action: "userStatus",
                            id: row.id,
                            status:
                              row.status === "suspended"
                                ? "active"
                                : "suspended",
                            label:
                              t(
                                row.status === "suspended"
                                  ? "restoreUser"
                                  : "suspendUser",
                              ) +
                              ": " +
                              row.displayName,
                          })
                        }
                      >
                        {t(
                          row.status === "suspended"
                            ? "restoreUser"
                            : "suspendUser",
                        )}
                      </button>
                    )}
                  </div>
                  <dl className="record-details">
                    <div>
                      <dt>{t("email")}</dt>
                      <dd>{row.email || "—"}</dd>
                    </div>
                    <div>
                      <dt>{t("phone")}</dt>
                      <dd>{row.phone}</dd>
                    </div>
                    <div>
                      <dt>Telegram</dt>
                      <dd>@{row.telegram}</dd>
                    </div>
                    <div>
                      <dt>{t("city")}</dt>
                      <dd>{cityName(row.city || "")}</dd>
                    </div>
                    <div>
                      <dt>{t("memberSince")}</dt>
                      <dd>{date(row.createdAt)}</dd>
                    </div>
                  </dl>
                  {row.bio && <p className="record-bio">{row.bio}</p>}
                </>
              ) : section === "listings" ? (
                <>
                  <div className="record-top">
                    <div>
                      <span className="eyebrow">{row.brand}</span>
                      <h3>{row.name}</h3>
                      <span
                        className={
                          row.moderationStatus === "hidden"
                            ? "status-badge danger"
                            : "status-badge"
                        }
                      >
                        {t(
                          row.moderationStatus === "hidden"
                            ? "hidden"
                            : "visible",
                        )}
                      </span>
                      <span className="status-badge">
                        {t(row.status === "sold" ? "sold" : "activeStatus")}
                      </span>
                    </div>
                    <button
                      className="outline"
                      disabled={busy}
                      onClick={() =>
                        begin({
                          action: "moderateListing",
                          id: row.id,
                          visibility:
                            row.moderationStatus === "hidden"
                              ? "visible"
                              : "hidden",
                          label:
                            t(
                              row.moderationStatus === "hidden"
                                ? "restoreListing"
                                : "hideListing",
                            ) +
                            ": " +
                            row.name,
                        })
                      }
                    >
                      {t(
                        row.moderationStatus === "hidden"
                          ? "restoreListing"
                          : "hideListing",
                      )}
                    </button>
                  </div>
                  <div className="admin-listing-info">
                    {row.photos?.[0] && (
                      <a href={row.photos[0]} target="_blank" rel="noreferrer">
                        <img src={row.photos[0]} alt={row.name} />
                      </a>
                    )}
                    <div>
                      <p>
                        {row.seller} · @{row.telegram} ·{" "}
                        {cityName(row.city || "")}
                      </p>
                      <p>
                        {new Intl.NumberFormat(
                          ["en-US", "ru-RU", "uz-UZ"][lang],
                        ).format(row.price || 0)}{" "}
                        UZS · {row.remaining}/{row.size} ml
                      </p>
                      <p className="record-bio">{row.description}</p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="record-top">
                    <h3>
                      {row.action && row.action in messages
                        ? t(row.action as MessageKey)
                        : row.action}
                    </h3>
                    <small>{date(row.createdAt)}</small>
                  </div>
                  <p className="audit-reason">{row.reason}</p>
                  <small className="record-id">
                    {t("target")}: {row.targetId}
                  </small>
                </>
              )}
            </article>
          ))
        )}
      </div>
      {data && data.total > 20 && !loading && (
        <div className="pagination">
          <button
            className="outline"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            <ArrowLeft size={14} />
            {t("previous")}
          </button>
          <span>
            {t("page")} {page} / {Math.ceil(data.total / 20)}
          </span>
          <button
            className="outline"
            disabled={page * 20 >= data.total}
            onClick={() => setPage(page + 1)}
          >
            {t("next")}
            <ArrowRight size={14} />
          </button>
        </div>
      )}
    </>
  );
}
