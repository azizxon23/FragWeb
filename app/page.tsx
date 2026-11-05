"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Search,
  Heart,
  Plus,
  MapPin,
  ChevronDown,
  X,
  Check,
  Leaf,
  MessageCircle,
  SlidersHorizontal,
  Sparkles,
  ArrowLeft,
  Package,
  ShieldCheck,
  Menu,
  Camera,
  User,
  ExternalLink,
} from "lucide-react";
import { catalog, demos, identify, type Listing } from "@/lib/catalog";
import { messages, type MessageKey } from "@/lib/i18n";
import {
  apiJson,
  ApiError,
  errorInfo,
  errorText,
  type ErrorInfo,
} from "@/lib/errors";
import { validateForm, focusInvalid } from "@/lib/form-validation";
import AccountPanel, { SellerProfile } from "./account-panel";
import AdminPanel from "./admin-panel";
import type { Profile, AccountData, PublicProfile } from "@/lib/account-types";
const cities = [
  "Tashkent",
  "Samarkand",
  "Bukhara",
  "Andijan",
  "Namangan",
  "Fergana",
  "Nukus",
  "Qarshi",
  "Jizzakh",
  "Navoi",
  "Termez",
  "Urgench",
  "Gulistan",
];
const cityNames: Record<string, string[]> = {
  Tashkent: ["Tashkent", "Ташкент", "Toshkent"],
  Samarkand: ["Samarkand", "Самарканд", "Samarqand"],
  Bukhara: ["Bukhara", "Бухара", "Buxoro"],
  Andijan: ["Andijan", "Андижан", "Andijon"],
  Namangan: ["Namangan", "Наманган", "Namangan"],
  Fergana: ["Fergana", "Фергана", "Farg‘ona"],
  Nukus: ["Nukus", "Нукус", "Nukus"],
  Qarshi: ["Qarshi", "Карши", "Qarshi"],
  Jizzakh: ["Jizzakh", "Джизак", "Jizzax"],
  Navoi: ["Navoi", "Навои", "Navoiy"],
  Termez: ["Termez", "Термез", "Termiz"],
  Urgench: ["Urgench", "Ургенч", "Urganch"],
  Gulistan: ["Gulistan", "Гулистан", "Guliston"],
};
type Modal =
  | "sell"
  | "finder"
  | "how"
  | "privacy"
  | "profile"
  | "admin"
  | "publicProfile"
  | null;
declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        initData: string;
        ready: () => void;
        expand: () => void;
        openTelegramLink: (url: string) => void;
      };
    };
  }
}
function Bottle({
  brand,
  name,
  color,
  index = 0,
}: {
  brand: string;
  name: string;
  color: string;
  index?: number;
}) {
  const id = "b" + index + name.replace(/\W/g, "");
  return (
    <svg
      className="bottle-art"
      viewBox="0 0 260 260"
      role="img"
      aria-label={brand + " " + name + " illustration"}
    >
      <defs>
        <linearGradient id={id}>
          <stop stopColor={color} />
          <stop offset=".45" stopColor={color} stopOpacity=".78" />
          <stop offset=".53" stopColor={color} />
          <stop offset="1" stopColor={color} stopOpacity=".9" />
        </linearGradient>
        <filter id={id + "shadow"}>
          <feGaussianBlur stdDeviation="7" />
        </filter>
      </defs>
      <ellipse
        cx="133"
        cy="225"
        rx="56"
        ry="9"
        fill="#594c49"
        opacity=".17"
        filter={`url(#${id}shadow)`}
      />
      <g
        transform={index % 3 === 1 ? "rotate(-7 130 135)" : "rotate(5 130 135)"}
      >
        <rect
          x="94"
          y="34"
          width="72"
          height="42"
          rx={index % 2 ? "3" : "10"}
          fill="#29262a"
        />
        <path
          d="M101 39v31m8-31v31m8-31v31m8-31v31m8-31v31m8-31v31m8-31v31m8-31v31"
          stroke="#8b8378"
          strokeOpacity=".22"
        />
        <rect x="114" y="76" width="32" height="13" fill="#c0a16f" />
        <rect
          x={index % 3 === 2 ? "78" : "69"}
          y="86"
          width={index % 3 === 2 ? "104" : "122"}
          height="132"
          rx={index % 3 === 1 ? "30" : "9"}
          fill={`url(#${id})`}
          stroke="#fff"
          strokeOpacity=".4"
          strokeWidth="2"
        />
        <path
          d="M80 101v99"
          stroke="white"
          strokeOpacity=".23"
          strokeWidth="4"
        />
        <rect
          x="82"
          y="126"
          width="96"
          height="61"
          fill={index % 2 ? "#f0e8d8" : "#28272b"}
          stroke="#c7ac7d"
          strokeWidth=".7"
        />
        <text
          x="130"
          y="145"
          textAnchor="middle"
          fill={index % 2 ? "#3a3330" : "#dfcdab"}
          fontSize={brand.length > 18 ? "6.2" : "8"}
          fontFamily="Georgia"
          letterSpacing="1"
        >
          {brand.toUpperCase()}
        </text>
        <text
          x="130"
          y="163"
          textAnchor="middle"
          fill={index % 2 ? "#3a3330" : "#eee3cb"}
          fontSize={name.length > 20 ? "5.8" : "8"}
          fontFamily="Georgia"
        >
          {name.length > 26 ? name.slice(0, 25) : name}
        </text>
        <text
          x="130"
          y="176"
          textAnchor="middle"
          fill="#a69072"
          fontSize="4.7"
          letterSpacing="1.5"
        >
          EAU DE PARFUM
        </text>
      </g>
    </svg>
  );
}
export default function Home() {
  const [lang, setLang] = useState(0);
  const t = (k: MessageKey) => messages[k][lang];
  const cn = (c: string) => cityNames[c]?.[lang] || c;
  const [items, setItems] = useState<Listing[]>([]),
    [loaded, setLoaded] = useState(false),
    [err, setErr] = useState(false);
  const [query, setQuery] = useState(""),
    [gender, setGender] = useState("all"),
    [city, setCity] = useState(""),
    [sort, setSort] = useState("newest"),
    [view, setView] = useState("all"),
    [favorites, setFavorites] = useState<string[]>([]),
    [modal, setModal] = useState<Modal>(null),
    [selected, setSelected] = useState<Listing | null>(null),
    [signedIn, setSignedIn] = useState(false),
    [myItems, setMyItems] = useState<Listing[]>([]),
    [finder, setFinder] = useState(""),
    [toast, setToast] = useState("");
  const [step, setStep] = useState(0),
    [form, setForm] = useState<Record<string, string>>({
      gender: "unisex",
      city: "Tashkent",
      condition: "box",
      phone: "+998",
    }),
    [photos, setPhotos] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [formErr, setFormErr] = useState<ErrorInfo | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null),
    [isAdmin, setIsAdmin] = useState(false),
    [profileLoading, setProfileLoading] = useState(true),
    [returnToSell, setReturnToSell] = useState(false),
    [fieldErrors, setFieldErrors] = useState<Record<string, ErrorInfo>>({}),
    [publicProfile, setPublicProfile] = useState<PublicProfile | null>(null),
    [publicError, setPublicError] = useState<ErrorInfo | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  function headers(): Record<string, string> {
    return window.Telegram?.WebApp.initData
      ? { "x-telegram-init-data": window.Telegram.WebApp.initData }
      : {};
  }
  async function refresh() {
    try {
      const r = await fetch("/api/listings");
      if (!r.ok) throw Error();
      setItems(await r.json());
      setErr(false);
    } catch {
      setErr(true);
    } finally {
      setLoaded(true);
    }
  }
  useEffect(() => {
    try {
      const l = localStorage.getItem("fragweb-language");
      if (l && [0, 1, 2].includes(+l)) setLang(+l);
      setFavorites(JSON.parse(localStorage.getItem("fragweb-saved") || "[]"));
    } catch {}
    window.Telegram?.WebApp.ready();
    window.Telegram?.WebApp.expand();
    refresh();
    fetch("/api/me", { headers: headers() })
      .then(apiJson<{ signedIn: boolean; isAdmin: boolean }>)
      .then(async (d) => {
        setSignedIn(d.signedIn);
        setIsAdmin(d.isAdmin);
        if (d.signedIn) {
          const a = await apiJson<AccountData>(
            await fetch("/api/profile", { headers: headers() }),
          );
          setProfile(a.profile);
          setIsAdmin(a.isAdmin);
          if (a.profile)
            setForm((v) => ({
              ...v,
              seller: a.profile!.displayName,
              phone: a.profile!.phone,
              telegram: a.profile!.telegram,
              city: a.profile!.city,
            }));
        }
        const params = new URLSearchParams(window.location.search);
        if (params.has("profile")) setModal("profile");
        if (params.has("sell")) setModal("sell");
      })
      .catch(() => setToast(t("error")))
      .finally(() => setProfileLoading(false));
  }, []);
  useEffect(() => {
    document.documentElement.lang = ["en", "ru", "uz"][lang];
  }, [lang]);
  useEffect(() => {
    if (modal || selected) {
      dialog.current?.showModal();
      document.body.style.overflow = "hidden";
    } else {
      dialog.current?.close();
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [modal, selected]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  const allItems = items.length ? items : loaded && !err ? demos : [];
  const source =
    view === "my"
      ? myItems
      : view === "saved"
        ? allItems.filter((p) => favorites.includes(p.id))
        : allItems;
  const shown = source
    .filter(
      (p) =>
        (gender === "all" || p.gender === gender) &&
        (!city || p.city === city) &&
        (!query ||
          (p.brand + " " + p.name).toLowerCase().includes(query.toLowerCase())),
    )
    .sort((a, b) =>
      sort === "low"
        ? a.price - b.price
        : sort === "high"
          ? b.price - a.price
          : b.createdAt - a.createdAt,
    );
  const money = (v: number) =>
    new Intl.NumberFormat(["en-US", "ru-RU", "uz-UZ"][lang]).format(v);
  function favorite(id: string) {
    const next = favorites.includes(id)
      ? favorites.filter((x) => x !== id)
      : [...favorites, id];
    setFavorites(next);
    localStorage.setItem("fragweb-saved", JSON.stringify(next));
  }
  function scrollGrid() {
    document
      .getElementById("collection")
      ?.scrollIntoView({ behavior: "smooth" });
  }
  async function my() {
    setView("my");
    scrollGrid();
    if (!signedIn) {
      setModal("sell");
      return;
    }
    try {
      const r = await fetch("/api/listings?mine=1", { headers: headers() });
      if (!r.ok) throw Error();
      setMyItems(await r.json());
    } catch {
      setToast(t("error"));
    }
  }
  function close() {
    if (busy) return;
    setSelected(null);
    setModal(null);
    setFormErr(null);
  }
  function openSell() {
    setStep(0);
    setFormErr(null);
    setFieldErrors({});
    if (signedIn && !profile && !profileLoading) {
      setReturnToSell(true);
      setModal("profile");
      return;
    }
    setModal("sell");
  }
  function openAccount() {
    setReturnToSell(false);
    setModal("profile");
  }
  function savedProfile(data: AccountData) {
    setProfile(data.profile);
    setIsAdmin(data.isAdmin);
    if (data.profile)
      setForm((v) => ({
        ...v,
        seller: data.profile!.displayName,
        phone: data.profile!.phone,
        telegram: data.profile!.telegram,
        city: data.profile!.city,
      }));
    setModal(returnToSell ? "sell" : null);
    setStep(0);
    setToast(t("profileSaved"));
  }
  async function showSeller(id: string) {
    setSelected(null);
    setModal("publicProfile");
    setPublicProfile(null);
    setPublicError(null);
    try {
      setPublicProfile(
        await apiJson<PublicProfile>(
          await fetch("/api/profiles/" + id, { headers: headers() }),
        ),
      );
    } catch (e) {
      setPublicError(errorInfo(e));
    }
  }
  const matches = identify(finder);
  function choose(p: (typeof catalog)[number]) {
    setForm({ ...form, brand: p.brand, name: p.name, gender: p.gender });
    openSell();
  }
  async function upload(files: FileList | null) {
    if (!files) return;
    setFormErr(null);
    if (photos.length + files.length > 4) {
      setFormErr({ code: "photos" });
      return;
    }
    setBusy(true);
    const added: string[] = [];
    try {
      for (const photo of Array.from(files)) {
        if (photo.size > 5 * 1024 * 1024)
          throw new ApiError({ code: "photoSize" });
        if (!["image/jpeg", "image/png", "image/webp"].includes(photo.type))
          throw new ApiError({ code: "photoType" });
        const data = new FormData();
        data.append("photo", photo);
        const result = await apiJson<{ url: string }>(
          await fetch("/api/uploads", {
            method: "POST",
            headers: headers(),
            body: data,
          }),
        );
        added.push(result.url);
      }
    } catch (e) {
      setFormErr(errorInfo(e));
    } finally {
      setPhotos((v) => [...v, ...added]);
      setBusy(false);
    }
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormErr(null);
    const element = e.currentTarget;
    const problems = validateForm(element);
    if (step === 0 && Number(form.remaining) > Number(form.size))
      problems.remaining = { code: "volume", field: "remaining" };
    setFieldErrors(problems);
    if (Object.keys(problems).length) {
      focusInvalid(element, problems);
      return;
    }
    if (step === 0) {
      setStep(1);
      return;
    }
    if (!photos.length) {
      setFormErr({ code: "photos" });
      return;
    }
    if (!profile) {
      setFormErr({ code: "profileRequired" });
      return;
    }
    setBusy(true);
    try {
      await apiJson(
        await fetch("/api/listings", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...headers() },
          body: JSON.stringify({
            ...form,
            telegram: form.telegram?.replace(/^@/, ""),
            price: Number(form.price),
            size: Number(form.size),
            remaining: Number(form.remaining),
            photos,
          }),
        }),
      );
      setModal(null);
      setToast(t("success"));
      setPhotos([]);
      setForm((v) => ({
        ...v,
        brand: "",
        name: "",
        description: "",
        price: "",
        size: "",
        remaining: "",
      }));
      await refresh();
      setView("all");
      scrollGrid();
    } catch (e) {
      const info = errorInfo(e);
      setFormErr(info);
      if (info.field) {
        setFieldErrors({ [info.field]: info });
        if (
          [
            "brand",
            "name",
            "price",
            "size",
            "remaining",
            "description",
          ].includes(info.field)
        )
          setStep(0);
      }
    } finally {
      setBusy(false);
    }
  }
  async function markSold(p: Listing) {
    try {
      const r = await fetch("/api/listings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...headers() },
        body: JSON.stringify({ id: p.id }),
      });
      if (!r.ok) throw Error();
      setMyItems(
        myItems.map((x) => (x.id === p.id ? { ...x, status: "sold" } : x)),
      );
      await refresh();
    } catch {
      setToast(t("error"));
    }
  }
  const field = (
    name: string,
    label: MessageKey,
    props: Record<string, unknown> = {},
  ) => (
    <label className="field">
      {t(label)}
      <input
        name={name}
        value={form[name] || ""}
        onChange={(e) => {
          setForm({ ...form, [name]: e.target.value });
          setFieldErrors((v) => {
            const next = { ...v };
            delete next[name];
            return next;
          });
        }}
        required
        minLength={props.type ? undefined : 2}
        aria-invalid={!!fieldErrors[name]}
        aria-describedby={
          fieldErrors[name] ? "listing-" + name + "-error" : undefined
        }
        {...props}
      />
      {fieldErrors[name] && (
        <span className="field-error" id={"listing-" + name + "-error"}>
          {errorText(fieldErrors[name], lang)}
        </span>
      )}
    </label>
  );
  const cityOptions = (
    <>
      {cities.map((c) => (
        <option key={c} value={c}>
          {cn(c)}
        </option>
      ))}
    </>
  );
  return (
    <>
      <div className="topbar">
        <span>
          <MapPin size={12} />{" "}
          {lang === 1
            ? "Узбекистан"
            : lang === 2
              ? "O‘zbekiston"
              : "Uzbekistan"}
        </span>
        <p>{t("eyebrow")}</p>
        <span>
          UZS <ChevronDown size={11} />
        </span>
      </div>
      <header className="nav shell">
        <a href="/" className="logo" aria-label="FragWeb home">
          frag<span>web</span>
          <i>✳︎</i>
        </a>
        <nav>
          <button
            onClick={() => {
              setView("all");
              scrollGrid();
            }}
          >
            {t("navBrowse")}
          </button>
          <button onClick={() => setModal("how")}>{t("how")}</button>
        </nav>
        <div className="nav-actions">
          <select
            className="language"
            aria-label="Language"
            value={lang}
            onChange={(e) => {
              setLang(+e.target.value);
              localStorage.setItem("fragweb-language", e.target.value);
            }}
          >
            <option value={0}>EN</option>
            <option value={1}>RU</option>
            <option value={2}>UZ</option>
          </select>
          <button
            className={view === "saved" ? "icon-button active" : "icon-button"}
            onClick={() => {
              setView(view === "saved" ? "all" : "saved");
              scrollGrid();
            }}
            aria-label={t("saved")}
          >
            <Heart size={21} />
            {favorites.length > 0 && <b>{favorites.length}</b>}
          </button>
          <button
            className="icon-button account"
            onClick={openAccount}
            aria-label={t("profile")}
          >
            <User size={20} />
          </button>
          {isAdmin && (
            <button
              className="icon-button admin-link"
              onClick={() => setModal("admin")}
              aria-label={t("adminPanel")}
            >
              <ShieldCheck size={20} />
            </button>
          )}
          <button className="primary sell-nav" onClick={openSell}>
            <Plus size={17} />
            {t("sell")}
          </button>
        </div>
      </header>
      <main>
        <section className="hero shell">
          <div className="hero-copy">
            <div className="eyebrow">
              <span /> {t("eyebrow")}
            </div>
            <h1>
              {t("hero1")}
              <br />
              {t("hero2")}
              <br />
              <em>{t("hero3")}</em>
            </h1>
            <p>{t("heroDesc")}</p>
            <div className="hero-buttons">
              <button
                className="primary"
                onClick={() => {
                  setView("all");
                  scrollGrid();
                }}
              >
                {t("explore")}
                <ArrowUpRight size={19} />
              </button>
              <button className="text-button" onClick={openSell}>
                {t("sell")}
                <ArrowRight size={16} />
              </button>
            </div>
            <div className="hero-foot">
              <span className="mini-bottles">♧</span>
              <span>{t("benefit2")}</span>
              <span className="small-star">✧</span>
            </div>
          </div>
          <div className="hero-photo">
            <img src="/images/hero.jpg" alt={t("heroAlt")} />
            <span className="photo-label">{t("photoTop")}</span>
            <div className="hero-sticker">
              <Sparkles size={21} />
              <span>{t("seal")}</span>
              <i>fragweb</i>
            </div>
            <span className="image-caption">{t("photoBottom")}</span>
          </div>
        </section>
        <section className="benefits shell">
          <div>
            <Package size={20} />
            <span>{t("benefit1")}</span>
          </div>
          <div>
            <MessageCircle size={20} />
            <span>{t("benefit2")}</span>
          </div>
          <div>
            <Leaf size={20} />
            <span>{t("benefit3")}</span>
          </div>
        </section>
        <section id="collection" className="collection shell">
          <div className="collection-heading">
            <div>
              <div className="eyebrow">{t("collection")}</div>
              <h2>
                {view === "saved"
                  ? t("saved")
                  : view === "my"
                    ? t("my")
                    : t("gridTitle")}
              </h2>
              <p>{t("gridDesc")}</p>
            </div>
            <button
              className="finder-button"
              onClick={() => setModal("finder")}
            >
              <Sparkles size={17} />
              {t("find")}
              <ArrowUpRight size={16} />
            </button>
          </div>
          <div className="filter-row">
            <div className="search">
              <Search size={18} />
              <input
                ref={searchRef}
                aria-label={t("search")}
                placeholder={t("search")}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button aria-label={t("clear")} onClick={() => setQuery("")}>
                  <X size={15} />
                </button>
              )}
            </div>
            <div className="location-filter">
              <MapPin size={17} />
              <select
                aria-label={t("city")}
                value={city}
                onChange={(e) => setCity(e.target.value)}
              >
                <option value="">{t("allCities")}</option>
                {cityOptions}
              </select>
            </div>
            <div className="sort-filter">
              <SlidersHorizontal size={17} />
              <select
                aria-label={t("sort")}
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="newest">{t("newest")}</option>
                <option value="low">{t("low")}</option>
                <option value="high">{t("high")}</option>
              </select>
            </div>
          </div>
          <div className="category-row">
            <div className="tabs">
              {["all", "women", "men", "unisex"].map((g) => (
                <button
                  className={gender === g ? "selected" : ""}
                  key={g}
                  onClick={() => setGender(g)}
                >
                  {t(g as MessageKey)}
                </button>
              ))}
            </div>
            <span>
              {shown.length} {t("results")}
            </span>
          </div>
          {err && (
            <div role="alert" className="notice error">
              {t("error")} <button onClick={refresh}>↻</button>
            </div>
          )}
          {loaded && !err && !items.length && view !== "my" && (
            <div className="notice">
              <span className="notice-dot" />
              {t("preview")}
            </div>
          )}
          {!loaded ? (
            <div className="empty">{t("loading")}</div>
          ) : shown.length === 0 ? (
            <div className="empty">
              <Search size={30} />
              <h3>{t("empty")}</h3>
              <p>{t("emptyDesc")}</p>
              <button
                className="outline"
                onClick={() => {
                  setQuery("");
                  setCity("");
                  setGender("all");
                  if (view === "saved") setView("all");
                }}
              >
                {t("clear")}
              </button>
            </div>
          ) : (
            <div className="product-grid">
              {shown.map((p, i) => {
                const match = catalog.find((c) => c.name === p.name);
                return (
                  <article className="product" key={p.id}>
                    <div className={`product-image tone-${i % 4}`}>
                      <button
                        className="product-open"
                        onClick={() => setSelected(p)}
                        aria-label={p.brand + " " + p.name}
                      >
                        {p.photos.length ? (
                          <img src={p.photos[0]} alt={p.brand + " " + p.name} />
                        ) : (
                          <Bottle
                            brand={p.brand}
                            name={p.name}
                            color={match?.color || "#8d7565"}
                            index={i}
                          />
                        )}
                      </button>
                      <span className="volume-badge">
                        {Math.round((p.remaining / p.size) * 100)}% {t("left")}
                      </span>
                      <button
                        className={
                          favorites.includes(p.id)
                            ? "save-button is-saved"
                            : "save-button"
                        }
                        aria-label={t("saved") + ": " + p.name}
                        aria-pressed={favorites.includes(p.id)}
                        onClick={() => favorite(p.id)}
                      >
                        <Heart
                          size={17}
                          fill={
                            favorites.includes(p.id) ? "currentColor" : "none"
                          }
                        />
                      </button>
                      {p.demo && <span className="demo-tag">{t("demo")}</span>}
                    </div>
                    <button
                      className="product-title"
                      onClick={() => setSelected(p)}
                    >
                      <span>{p.brand}</span>
                      <h3>{p.name}</h3>
                    </button>
                    <div className="product-meta">
                      <span>
                        {p.remaining} / {p.size} ml
                      </span>
                      <span>·</span>
                      <span>{t(p.condition === "box" ? "box" : "bottle")}</span>
                    </div>
                    <div className="product-bottom">
                      <strong>
                        {money(p.price)}{" "}
                        <small>{lang === 2 ? "so‘m" : "UZS"}</small>
                      </strong>
                      <span>
                        <MapPin size={12} />
                        {cn(p.city)}
                      </span>
                    </div>
                    {view === "my" &&
                      (p.status === "sold" ? (
                        <span className="sold">{t("sold")}</span>
                      ) : (
                        <button
                          className="text-button"
                          onClick={() => markSold(p)}
                        >
                          {t("markSold")}
                          <Check size={15} />
                        </button>
                      ))}
                  </article>
                );
              })}
            </div>
          )}
          <div className="sell-banner">
            <div className="banner-art">✳︎</div>
            <div>
              <div className="eyebrow">FRAGWEB</div>
              <h3>{t("listingTitle")}</h3>
              <p>{t("listingDesc")}</p>
            </div>
            <button className="primary" onClick={openSell}>
              {t("sell")}
              <Plus size={18} />
            </button>
          </div>
        </section>
      </main>
      <footer className="shell">
        <div>
          <a href="/" className="logo">
            frag<span>web</span>
            <i>✳︎</i>
          </a>
          <p>{t("footer")}</p>
        </div>
        <div className="footer-links">
          <button onClick={openAccount}>{t("profile")}</button>
          {isAdmin && (
            <button onClick={() => setModal("admin")}>{t("adminPanel")}</button>
          )}
          <button onClick={my}>{t("my")}</button>
          <button onClick={() => setModal("how")}>{t("how")}</button>
          <button onClick={() => setModal("privacy")}>{t("privacy")}</button>
          <a
            href="https://github.com/azizxon23/FragWeb"
            target="_blank"
            rel="noreferrer"
          >
            GitHub <ArrowUpRight size={12} />
          </a>
        </div>
        <div className="footer-base">
          <span>© {new Date().getFullYear()} FragWeb</span>
          <span>{t("build")}</span>
          <span>EN / RU / UZ</span>
        </div>
      </footer>
      <dialog
        className={modal === "admin" ? "wide" : ""}
        ref={dialog}
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
        aria-labelledby="dialog-title"
      >
        <div className="dialog-inner">
          <button
            className="close"
            aria-label={t("close")}
            onClick={close}
            disabled={busy}
          >
            <X size={20} />
          </button>
          {modal === "profile" ? (
            <AccountPanel
              key={profile?.id || "new"}
              lang={lang}
              headers={headers}
              profile={profile}
              isAdmin={isAdmin}
              signedIn={signedIn}
              onSave={savedProfile}
              onMy={() => {
                close();
                my();
              }}
              onAdmin={() => setModal("admin")}
              cityName={cn}
            />
          ) : modal === "admin" ? (
            <AdminPanel lang={lang} headers={headers} cityName={cn} />
          ) : modal === "publicProfile" ? (
            <>
              {publicError ? (
                <>
                  <h2 id="dialog-title">{t("publicProfile")}</h2>
                  <p className="notice error">{errorText(publicError, lang)}</p>
                </>
              ) : publicProfile ? (
                <SellerProfile
                  profile={publicProfile}
                  lang={lang}
                  cityName={cn}
                />
              ) : (
                <h2 id="dialog-title">{t("loading")}</h2>
              )}
            </>
          ) : selected ? (
            <>
              <div className="detail-art tone-1">
                {selected.photos.length ? (
                  <img src={selected.photos[0]} alt={selected.name} />
                ) : (
                  <Bottle
                    brand={selected.brand}
                    name={selected.name}
                    color={
                      catalog.find((p) => p.name === selected.name)?.color ||
                      "#76605a"
                    }
                  />
                )}
              </div>
              {selected.photos.length > 1 && (
                <div className="detail-photos">
                  {selected.photos.map((photo) => (
                    <a
                      href={photo}
                      target="_blank"
                      rel="noreferrer"
                      key={photo}
                    >
                      <img src={photo} alt={selected.name} />
                    </a>
                  ))}
                </div>
              )}
              <div className="eyebrow detail-brand">{selected.brand}</div>
              <h2 id="dialog-title">{selected.name}</h2>
              <p className="detail-price">
                {money(selected.price)} <small>UZS</small>
              </p>
              <div className="detail-specs">
                <span>
                  {selected.remaining} / {selected.size} ml
                </span>
                <span>
                  {t(selected.condition === "box" ? "box" : "bottle")}
                </span>
                <span>
                  <MapPin size={14} /> {cn(selected.city)}
                </span>
              </div>
              <h4>{t("about")}</h4>
              <p className="detail-description">
                {selected.demo ? t("demoNote") : selected.description}
              </p>
              {catalog.find((p) => p.name === selected.name) && (
                <a
                  className="external"
                  href={catalog.find((p) => p.name === selected.name)!.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Fragrantica <ExternalLink size={14} />
                </a>
              )}
              <div className="seller-row">
                <span className="avatar">{selected.seller[0]}</span>
                <div>
                  <small>{t("seller")}</small>
                  <strong>{selected.seller}</strong>
                </div>
                {selected.profileId && (
                  <button
                    className="outline"
                    onClick={() => showSeller(selected.profileId!)}
                  >
                    {t("viewProfile")}
                    <ArrowUpRight size={13} />
                  </button>
                )}
              </div>
              {!selected.demo && (
                <a
                  className="primary full"
                  href={`https://t.me/${selected.telegram}?text=${encodeURIComponent(selected.name + " · FragWeb")}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle size={18} />
                  {t("contact")}
                  <ArrowUpRight size={17} />
                </a>
              )}
              <p className="fine-print">{t("note")}</p>
            </>
          ) : modal === "sell" ? (
            <>
              <div className="eyebrow">{t("sell")}</div>
              <h2 id="dialog-title">
                {t(signedIn ? "listingTitle" : "signIn")}
              </h2>
              <p className="dialog-desc">
                {t(signedIn ? "listingDesc" : "signDesc")}
              </p>
              {!signedIn ? (
                <a
                  className="primary full"
                  href="/signin-with-chatgpt?return_to=%2F%3Fsell%3D1"
                  target="_top"
                >
                  {t("signinBtn")}
                  <ArrowRight size={17} />
                </a>
              ) : profileLoading ? (
                <p>{t("loading")}</p>
              ) : !profile ? (
                <>
                  <p className="notice">{t("profileForSelling")}</p>
                  <button
                    className="primary full"
                    onClick={() => {
                      setReturnToSell(true);
                      setModal("profile");
                    }}
                  >
                    {t("completeProfile")}
                    <ArrowRight size={17} />
                  </button>
                </>
              ) : profile.status === "suspended" ? (
                <p className="notice error">
                  {errorText({ code: "suspended" }, lang)}
                </p>
              ) : (
                <>
                  <div className="steps">
                    <span className={step === 0 ? "current" : ""}>
                      01 · {t("details")}
                    </span>
                    <span className={step === 1 ? "current" : ""}>
                      02 · {t("seller")}
                    </span>
                  </div>
                  <form onSubmit={submit} key={step} noValidate>
                    {step === 0 ? (
                      <>
                        <button
                          type="button"
                          className="finder-tip"
                          onClick={() => {
                            setFinder(
                              form.brand
                                ? form.brand + " " + (form.name || "")
                                : "",
                            );
                            setModal("finder");
                          }}
                        >
                          <Sparkles size={16} />
                          {t("finderLink")}
                        </button>
                        <div className="form-grid">
                          {field("brand", "brand", { maxLength: 80 })}
                          {field("name", "perfume", { maxLength: 100 })}
                          <label className="field">
                            {t("gender")}
                            <select
                              name="gender"
                              value={form.gender}
                              onChange={(e) =>
                                setForm({ ...form, gender: e.target.value })
                              }
                            >
                              {["women", "men", "unisex"].map((g) => (
                                <option value={g} key={g}>
                                  {t(g as MessageKey)}
                                </option>
                              ))}
                            </select>
                          </label>
                          {field("price", "price", {
                            type: "number",
                            min: 1000,
                            max: 100000000,
                            step: 1,
                          })}
                          {field("size", "size", {
                            type: "number",
                            min: 1,
                            max: 2000,
                          })}
                          {field("remaining", "remaining", {
                            type: "number",
                            min: 1,
                            max: 2000,
                          })}
                        </div>
                        <label className="field">
                          {t("condition")}
                          <select
                            name="condition"
                            value={form.condition}
                            onChange={(e) =>
                              setForm({ ...form, condition: e.target.value })
                            }
                          >
                            <option value="box">{t("box")}</option>
                            <option value="bottle">{t("bottle")}</option>
                          </select>
                        </label>
                        <label className="field">
                          {t("description")}
                          <textarea
                            name="description"
                            aria-invalid={!!fieldErrors.description}
                            aria-describedby={
                              fieldErrors.description
                                ? "listing-description-error"
                                : undefined
                            }
                            required
                            minLength={15}
                            maxLength={2000}
                            placeholder={t("descHelp")}
                            value={form.description || ""}
                            onChange={(e) => {
                              setForm({ ...form, description: e.target.value });
                              setFieldErrors((v) => {
                                const next = { ...v };
                                delete next.description;
                                return next;
                              });
                            }}
                          />
                          {fieldErrors.description && (
                            <span
                              className="field-error"
                              id="listing-description-error"
                            >
                              {errorText(fieldErrors.description, lang)}
                            </span>
                          )}
                        </label>
                      </>
                    ) : (
                      <>
                        <div className="seller-summary">
                          <div>
                            <strong>{profile.displayName}</strong>
                            <span>
                              {cn(profile.city)} · @{profile.telegram}
                            </span>
                            <small>{t("contactProfile")}</small>
                          </div>
                          <button
                            type="button"
                            className="outline"
                            onClick={() => {
                              setReturnToSell(true);
                              setModal("profile");
                            }}
                          >
                            {t("editProfile")}
                          </button>
                        </div>
                        <p className="fine-print">{t("private")}</p>
                        <label className="field">
                          {t("photos")}
                          <span className="upload">
                            <Camera size={23} />
                            <strong>{t("upload")}</strong>
                            <span>{t("photoHelp")}</span>
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              multiple
                              disabled={busy}
                              onChange={(e) => upload(e.target.files)}
                            />
                          </span>
                        </label>
                        <div className="photo-thumbs">
                          {photos.map((photo, i) => (
                            <div key={photo}>
                              <img src={photo} alt={`Photo ${i + 1}`} />
                              <button
                                type="button"
                                aria-label={t("removePhoto")}
                                disabled={busy}
                                onClick={() =>
                                  setPhotos(photos.filter((x) => x !== photo))
                                }
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                        <label className="consent">
                          <input
                            type="checkbox"
                            name="consent"
                            aria-invalid={!!fieldErrors.consent}
                            required
                          />
                          {t("agree")}
                        </label>
                        {fieldErrors.consent && (
                          <p className="field-error">
                            {errorText(fieldErrors.consent, lang)}
                          </p>
                        )}
                      </>
                    )}
                    {formErr && (
                      <p className="notice error" role="alert">
                        {errorText(formErr, lang)}
                      </p>
                    )}
                    <div className="form-actions">
                      {step === 1 && (
                        <button
                          className="outline"
                          type="button"
                          onClick={() => setStep(0)}
                          disabled={busy}
                        >
                          <ArrowLeft size={16} />
                          {t("back")}
                        </button>
                      )}
                      <button className="primary" type="submit" disabled={busy}>
                        {busy
                          ? t("photoUploading")
                          : t(step === 0 ? "next" : "publish")}
                        <ArrowRight size={17} />
                      </button>
                    </div>
                  </form>
                </>
              )}
            </>
          ) : modal === "finder" ? (
            <>
              <span className="modal-icon">
                <Sparkles size={24} />
              </span>
              <h2 id="dialog-title">{t("find")}</h2>
              <p className="dialog-desc">{t("findDesc")}</p>
              <div className="search finder-search">
                <Search size={18} />
                <input
                  autoFocus
                  placeholder="e.g. Creed Aventus"
                  value={finder}
                  onChange={(e) => setFinder(e.target.value)}
                />
              </div>
              <p className="fine-print">{t("findHint")}</p>
              <div className="finder-results">
                {matches.map((p) => (
                  <div key={p.id}>
                    <span
                      className="match-dot"
                      style={{ background: p.color }}
                    />
                    <div>
                      <small>{p.brand}</small>
                      <strong>{p.name}</strong>
                      <a href={p.url} target="_blank" rel="noreferrer">
                        Fragrantica <ExternalLink size={12} />
                      </a>
                    </div>
                    <button className="outline" onClick={() => choose(p)}>
                      {t("use")}
                      <Plus size={14} />
                    </button>
                  </div>
                ))}
                {finder.length > 1 && !matches.length && (
                  <p>{t("findEmpty")}</p>
                )}
              </div>
            </>
          ) : modal === "how" ? (
            <>
              <div className="eyebrow">{t("how")}</div>
              <h2 id="dialog-title">{t("howTitle")}</h2>
              <div className="how-steps">
                {[1, 2, 3].map((n) => (
                  <div key={n}>
                    <span>0{n}</span>
                    <div>
                      <h3>{t(("step" + n) as MessageKey)}</h3>
                      <p>{t(("step" + n + "Desc") as MessageKey)}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="fine-print">{t("note")}</p>
              <button
                className="primary full"
                onClick={() => {
                  close();
                  scrollGrid();
                }}
              >
                {t("explore")}
                <ArrowRight size={18} />
              </button>
            </>
          ) : (
            <>
              <h2 id="dialog-title">{t("privacy")}</h2>
              <p className="dialog-desc">{t("privacyText")}</p>
              <a
                className="external"
                href="https://github.com/azizxon23/FragWeb/issues"
                target="_blank"
                rel="noreferrer"
              >
                GitHub <ExternalLink size={15} />
              </a>
            </>
          )}
        </div>
      </dialog>
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          {toast}
          <button aria-label={t("close")} onClick={() => setToast("")}>
            <X size={16} />
          </button>
        </div>
      )}
    </>
  );
}
