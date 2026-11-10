"use client";
import { useState } from "react";
import {
  ArrowRight,
  User,
  LogOut,
  MapPin,
  MessageCircle,
  ExternalLink,
} from "lucide-react";
import { messages, type MessageKey } from "@/lib/i18n";
import { apiJson, errorInfo, errorText, type ErrorInfo } from "@/lib/errors";
import { validateForm, focusInvalid } from "@/lib/form-validation";
import { cityValues } from "@/lib/validation";
import type {
  AccountData,
  Profile,
  PublicProfile,
  ApiHeaders,
} from "@/lib/account-types";
type Props = {
  lang: number;
  headers: ApiHeaders;
  profile: Profile | null;
  signedIn: boolean;
  onSave: (data: AccountData) => void;
  onMy: () => void;
  cityName: (city: string) => string;
};
export default function AccountPanel({
  lang,
  headers,
  profile,
  signedIn,
  onSave,
  onMy,
  cityName,
}: Props) {
  const t = (key: MessageKey) => messages[key][lang];
  const [values, setValues] = useState({
    displayName: profile?.displayName || "",
    phone: profile?.phone || "+998",
    telegram: profile?.telegram || "",
    city: profile?.city || "Tashkent",
    bio: profile?.bio || "",
    avatar: profile?.avatar || "",
  });
  const [errors, setErrors] = useState<Record<string, ErrorInfo>>({}),
    [error, setError] = useState<ErrorInfo | null>(null),
    [busy, setBusy] = useState(false);
  async function uploadAvatar(file: File | undefined) {
    if(!file || busy)return;
    if(file.size>5*1024*1024){setError({code:'photoSize'});return;}
    setBusy(true);setError(null);
    try{const body=new FormData();body.set('photo',file);const data=await apiJson<{url:string}>(await fetch('/api/uploads?purpose=avatar',{method:'POST',headers:headers(),body}));setValues(v=>({...v,avatar:data.url}));}catch(e){setError(errorInfo(e));}finally{setBusy(false);}
  }
  const suspended = profile?.status === "suspended";
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const problems = validateForm(form);
    setErrors(problems);
    setError(null);
    if (Object.keys(problems).length) {
      focusInvalid(form, problems);
      return;
    }
    setBusy(true);
    try {
      const data = await apiJson<AccountData>(
        await fetch("/api/profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json", ...headers() },
          body: JSON.stringify({
            ...values,
            telegram: values.telegram.replace(/^@/, ""),
          }),
        }),
      );
      onSave(data);
    } catch (e) {
      const info = errorInfo(e);
      setError(info);
      if (info.field) setErrors({ [info.field]: info });
    } finally {
      setBusy(false);
    }
  }
  const change = (name: keyof typeof values, value: string) => {
    setValues({ ...values, [name]: value });
    setErrors((v) => {
      const next = { ...v };
      delete next[name];
      return next;
    });
  };
  const field = (
    name: keyof typeof values,
    label: MessageKey,
    extra: Record<string, unknown> = {},
  ) => (
    <label className="field">
      {t(label)}
      <input
        name={name}
        value={values[name]}
        onChange={(e) => change(name, e.target.value)}
        required
        aria-invalid={!!errors[name]}
        aria-describedby={
          errors[name] ? "profile-" + name + "-error" : undefined
        }
        {...extra}
      />
      {errors[name] && (
        <span className="field-error" id={"profile-" + name + "-error"}>
          {errorText(errors[name], lang)}
        </span>
      )}
    </label>
  );
  return (
    <>
      <span className="modal-icon">
        <User size={23} />
      </span>
      <h2 id="dialog-title">{t(profile ? "profile" : "profileTitle")}</h2>
      <p className="dialog-desc">{t(signedIn ? "profileDesc" : "signDesc")}</p>
      {!signedIn ? (
        <a
          className="primary full"
          href="/account"
          target="_top"
        >
          {t("loginOrRegister")}
          <ArrowRight size={17} />
        </a>
      ) : (
        <>
          <div className="account-links">
            {profile && (
              <button className="outline" onClick={onMy}>
                {t("goMyListings")}
                <ArrowRight size={14} />
              </button>
            )}
            <button className="signout" disabled={busy} onClick={async()=>{setBusy(true);setError(null);try{await apiJson(await fetch('/api/account',{method:'DELETE',headers:{'Content-Type':'application/json',...headers()}}));window.location.assign('/');}catch(e){setError(errorInfo(e));setBusy(false);}}}><LogOut size={13}/>{t('signOut')}</button>
          </div>
          {profile && (
            <div className="account-badges">
              <span
                className={suspended ? "status-badge danger" : "status-badge"}
              >
                {t(suspended ? "suspendedStatus" : "activeStatus")}
              </span>
              <small>
                {t("memberSince")}{" "}
                {new Date(profile.createdAt).toLocaleDateString(
                  ["en-GB", "ru-RU", "uz-UZ"][lang],
                )}
              </small>
            </div>
          )}
          {suspended && (
            <p className="notice error" role="alert">
              {errorText({ code: "suspended" }, lang)}
            </p>
          )}
          <form onSubmit={save} noValidate>
            <fieldset disabled={busy || suspended}>
              <div className="profile-photo-editor"><div>{values.avatar?<img className="user-avatar" src={values.avatar} alt={values.displayName}/>:<span className="user-avatar placeholder"><User size={28}/></span>}</div><div><label className="field">{t('profilePhoto')}<input type="file" accept="image/jpeg,image/png,image/webp" aria-label={t('choosePhoto')} onChange={e=>{uploadAvatar(e.target.files?.[0]);e.target.value='';}}/></label><small>{t('avatarPhotoHelp')}</small>{values.avatar&&<button className="text-button" type="button" onClick={()=>setValues(v=>({...v,avatar:''}))}>{t('avatarRemovePhoto')}</button>}</div></div>
              <div className="form-grid">
                {field("displayName", "name", { minLength: 2, maxLength: 70 })}
                <label className="field">
                  {t("city")}
                  <select
                    name="city"
                    value={values.city}
                    onChange={(e) => change("city", e.target.value)}
                  >
                    {cityValues.map((c) => (
                      <option value={c} key={c}>
                        {cityName(c)}
                      </option>
                    ))}
                  </select>
                </label>
                {field("phone", "phone", {
                  type: "tel",
                  pattern: "\\+998[0-9]{9}",
                  placeholder: "+998901234567",
                })}
                {field("telegram", "username", {
                  pattern: "@?[a-zA-Z][a-zA-Z0-9_]{4,31}",
                  placeholder: "@username",
                })}
              </div>
              <label className="field">
                {t("bio")}
                <textarea
                  name="bio"
                  maxLength={500}
                  value={values.bio}
                  onChange={(e) => change("bio", e.target.value)}
                />
              </label>
              {error && (
                <p className="notice error" role="alert">
                  {errorText(error, lang)}
                </p>
              )}
              <button className="primary full" type="submit">
                {t(busy ? "saving" : "saveProfile")}
                <ArrowRight size={17} />
              </button>
            </fieldset>
          </form>
        </>
      )}
    </>
  );
}
export function SellerProfile({
  profile,
  lang,
  cityName,
}: {
  profile: PublicProfile;
  lang: number;
  cityName: (c: string) => string;
}) {
  const t = (key: MessageKey) => messages[key][lang];
  return (
    <>
      <div className="profile-avatar">{profile.avatar?<img className="user-avatar" src={profile.avatar} alt={profile.displayName}/>:profile.displayName[0]}</div>
      <div className="eyebrow">{t("publicProfile")}</div>
      <h2 id="dialog-title">{profile.displayName}</h2>
      <div className="detail-specs">
        <span>
          <MapPin size={14} />
          {cityName(profile.city)}
        </span>
        <span>
          {profile.listingCount} {t("activeListings")}
        </span>
      </div>
      <p className="fine-print">
        {t("memberSince")}{" "}
        {new Date(profile.createdAt).toLocaleDateString(
          ["en-GB", "ru-RU", "uz-UZ"][lang],
        )}
      </p>
      <p className="detail-description">{profile.bio || t("noBio")}</p>
      <a
        className="primary full"
        href={`https://t.me/${profile.telegram}`}
        target="_blank"
        rel="noreferrer"
      >
        <MessageCircle size={16} />
        {t("contact")}
        <ExternalLink size={15} />
      </a>
    </>
  );
}
