import { pbkdf2Sync } from "node:crypto";
import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { Miniflare } from "miniflare";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("profile privacy, localized validation, listing ownership and admin moderation", async () => {
  const temporary = await mkdtemp(join(tmpdir(), "fragweb-api-"));
  let mf;
  try {
    await build({
      entryPoints: ["tests/fixtures/api-worker.ts"],
      outfile: join(temporary, "worker.mjs"),
      bundle: true,
      format: "esm",
      platform: "browser",
      external: ["cloudflare:workers"],
      logLevel: "silent",
    });
    mf = new Miniflare({
      modules: true,
      modulesRoot: temporary,
      rootPath: temporary,
      scriptPath: join(temporary, "worker.mjs"),
      compatibilityDate: "2026-05-15",
      compatibilityFlags: ["nodejs_compat"],
      d1Databases: ["DB"],
      r2Buckets: ["BUCKET"],
      bindings: { FRAGWEB_OWNER_EMAIL: "owner@example.test", FRAGWEB_OWNER_PASSWORD_HASH: "pbkdf2$test-salt$" + pbkdf2Sync("owner-test-password", "test-salt", 100000, 32, "sha256").toString("hex") },
    });
    const db = await mf.getD1Database("DB");
    for (const file of (await readdir("drizzle"))
      .filter((x) => x.endsWith(".sql"))
      .sort()) {
      const sql = await readFile(join("drizzle", file), "utf8");
      for (const statement of sql
        .split("--> statement-breakpoint")
        .flatMap((s) => s.split(";"))
        .map((s) => s.trim())
        .filter(Boolean))
        await db.prepare(statement).run();
    }
    const profiles = {
      seller: {
        displayName: "Test Seller",
        phone: "+998901234567",
        telegram: "test_seller",
        city: "Tashkent",
        bio: "I enjoy fragrances.",
      },
      other: {
        displayName: "Other Seller",
        phone: "+998907654321",
        telegram: "other_seller",
        city: "Bukhara",
        bio: "",
      },
    };
    const cookies = {};
    async function call(path, method = "GET", body, identity, lang = "en") {
      const headers = { "x-fragweb-language": lang };
      if (method !== "GET") headers.origin = "https://fragweb.test";
      if (identity && cookies[identity]) headers.cookie = cookies[identity];
      if (identity) {
        headers["oai-authenticated-user-id"] = identity;
        headers["oai-authenticated-user-email"] =
          identity === "owner"
            ? "owner@example.test"
            : `${identity}@example.test`;
      }
      if (body instanceof FormData) {
        const encoded = new Request("https://fragweb.test", {
          method: "POST",
          body,
        });
        headers["content-type"] = encoded.headers.get("content-type");
        body = await encoded.arrayBuffer();
      } else if (body !== undefined) {
        headers["content-type"] = "application/json";
        body = JSON.stringify(body);
      }
      const response = await mf.dispatchFetch("https://fragweb.test" + path, {
        method,
        headers,
        body,
      });
      const cookie=response.headers.get('set-cookie');
      if(identity && cookie) { const entry=cookie.split(';')[0], key=entry.split('=')[0]; cookies[identity]=[...(cookies[identity]||'').split('; ').filter(x=>x && !x.startsWith(key+'=')),entry].join('; '); }
      return response;
    }
    assert.equal((await call("/api/admin")).status, 401);
    assert.equal((await call('/api/listings', 'POST', {}, undefined)).status, 401);
    assert.equal((await call('/api/uploads', 'POST', {}, undefined)).status, 401);
    assert.equal((await call('/api/admin', 'GET', undefined, 'owner')).status, 403, 'owner identity needs separate admin session');
    assert.equal((await call('/api/admin/session', 'POST', {email:'owner@example.test',password:'owner-test-password'}, 'seller')).status, 403, 'claimed owner email cannot impersonate admin');
    assert.equal((await call('/api/admin/session', 'POST', {email:'owner@example.test',password:'wrong'}, 'owner', 'uz')).status, 403);
    const login = await call('/api/admin/session', 'POST', {email:'owner@example.test',password:'owner-test-password'}, 'owner');
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie');
    for (const flag of ['HttpOnly','Secure','SameSite=Strict']) assert.ok(cookie.includes(flag));
    cookies.owner = cookie.split(';')[0];
    assert.equal("isAdmin" in (await (await call('/api/me','GET',undefined,'owner')).json()), false, 'marketplace never exposes admin role');
    assert.equal((await call('/api/admin','GET',undefined,'seller')).status, 403);

    assert.equal(
      (await call("/api/admin", "GET", undefined, "seller")).status,
      403,
    );
    assert.equal((await call('/api/profile','GET',undefined,'owner')).status,401,'admin session cannot bypass marketplace password');
    assert.equal((await call('/api/account','POST',{mode:'signup',email:'seller@example.test',password:'seller-password-123',confirmPassword:'seller-password-123',displayName:'Test Seller'})).status,401,'signup requires verified email ownership');
    for(const who of ['seller','other']) {
      const registered=await call('/api/account','POST',{mode:'signup',email:who+'@example.test',password:who+'-password-123',confirmPassword:who+'-password-123',displayName:who+' account'},who);
      assert.equal(registered.status,201,await registered.text());
      const duplicate=await call('/api/account','POST',{mode:'signup',email:who.toUpperCase()+'@EXAMPLE.TEST',password:'different-password',confirmPassword:'different-password',displayName:'Duplicate'},who);
      assert.equal(duplicate.status,409,'normalized email cannot be registered twice');
    }
    assert.equal((await (await call('/api/admin','GET',undefined,'owner')).json()).stats.users,2,'registration appears immediately in admin users');
    assert.equal((await call('/api/account','POST',{mode:'signup',email:'seller@example.test',password:'second-identity-pwd',confirmPassword:'second-identity-pwd',displayName:'Spoofed'},'other')).status,401);
    let response = await call(
      "/api/profile",
      "PUT",
      { ...profiles.seller, phone: "wrong" },
      "seller",
      "ru",
    );
    let result = await response.json();
    assert.equal(response.status, 400);
    assert.equal(result.code, "phone");
    assert.match(result.error, /Введите/);
    response = await call(
      "/api/profile",
      "PUT",
      { ...profiles.seller, phone: "wrong" },
      "seller",
      "uz",
    );
    assert.match((await response.json()).error, /raqam/);
    response = await call(
      "/api/profile",
      "PUT",
      {
        ...profiles.seller,
        role: "admin",
        status: "active",
        email: "owner@example.test",
      },
      "seller",
    );
    assert.equal(response.status, 200);
    const seller = (await response.json()).profile;
    assert.equal(seller.email, "seller@example.test");
    assert.equal("ownerId" in seller, false);
    await call("/api/profile", "PUT", profiles.other, "other");
    assert.equal(
      (await call("/api/admin", "GET", undefined, "seller")).status,
      403,
      "role injection must not grant admin",
    );
    const publicUser = await (await call("/api/profiles/" + seller.id)).json();
    for (const secret of ["phone", "email", "ownerId", "status"])
      assert.equal(secret in publicUser, false, secret);
    const userDetail=await call('/api/admin/users/'+seller.id,'GET',undefined,'owner');
    assert.equal(userDetail.status,200);const detail=await userDetail.json();
    assert.equal(detail.profile.role,'user');assert.equal(detail.passwordConfigured,true);
    assert.equal(detail.profile.phone,profiles.seller.phone);assert.equal('ownerId' in detail.profile,false);
    assert.equal((await call('/api/admin/users/'+seller.id,'GET',undefined,'seller')).status,403);
    const userRows=await (await call('/api/admin','GET',undefined,'owner')).json();
    assert.ok(userRows.rows.every(x=>x.role==='user' && !('isAdmin' in x)));
    const data = new FormData();
    data.append(
      "photo",
      new File(
        [
          Buffer.from(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZK0AAAAASUVORK5CYII=",
            "base64",
          ),
        ],
        "bottle.png",
        { type: "image/png" },
      ),
    );
    response = await call("/api/uploads", "POST", data, "seller");
    assert.equal(response.status, 200);
    const photo = (await response.json()).url;
    assert.equal((await call(photo)).status, 200);
    const avatar=await call('/api/uploads?purpose=avatar','POST',data,'seller');assert.equal(avatar.status,200);const avatarUrl=(await avatar.json()).url;
    assert.equal((await call('/api/profile','PUT',{...profiles.seller,avatar:avatarUrl},'other')).status,400,'cannot reuse another user avatar');
    assert.equal((await call('/api/profile','PUT',{...profiles.seller,avatar:photo},'seller')).status,400,'listing photos are not avatar uploads');
    assert.equal((await call('/api/profile','PUT',{...profiles.seller,avatar:avatarUrl},'seller')).status,200);
    assert.equal((await (await call('/api/profiles/'+seller.id)).json()).avatar,avatarUrl);
    const listing = {
      brand: "Creed",
      name: "Aventus",
      gender: "men",
      size: 100,
      remaining: 80,
      price: 1500000,
      condition: "box",
      description: "Original bottle with its box.",
      photos: [photo],
      seller: "Spoofed Name",
      phone: "+998900000000",
      telegram: "spoofed",
      city: "Nukus",
    };
    response = await call(
      "/api/listings",
      "POST",
      { ...listing, remaining: 110 },
      "seller",
      "uz",
    );
    result = await response.json();
    assert.equal(response.status, 400);
    assert.equal(result.code, "volume");
    assert.match(result.error, /oshmasligi/);
    response = await call("/api/listings", "POST", listing, "other", "ru");
    assert.equal(response.status, 400, "cannot use another seller photo");
    response = await call("/api/listings", "POST", listing, "seller");
    assert.equal(response.status, 201);
    const listingId = (await response.json()).id;
    let rows = await (await call("/api/listings")).json();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].seller, "Test Seller");
    assert.equal(rows[0].profileId, seller.id);
    for (const secret of ["phone", "email", "ownerId"])
      assert.equal(secret in rows[0], false, secret);
    assert.equal(
      (await call("/api/listings", "PATCH", { id: listingId }, "other")).status,
      404,
    );
    response = await call("/api/admin", "GET", undefined, "owner");
    result = await response.json();
    assert.equal(response.status, 200);
    assert.equal(result.stats.users, 2);
    assert.equal(
      result.rows.find((p) => p.id === seller.id).phone,
      profiles.seller.phone,
    );
    assert.equal(
      (
        await call(
          "/api/admin",
          "PATCH",
          {
            action: "moderateListing",
            id: listingId,
            visibility: "hidden",
            reason: "Testing moderation",
          },
          "seller",
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await call(
          "/api/admin",
          "PATCH",
          {
            action: "moderateListing",
            id: listingId,
            visibility: "hidden",
            reason: "Testing moderation",
          },
          "owner",
        )
      ).status,
      200,
    );
    assert.equal((await (await call("/api/listings")).json()).length, 0);
    await call(
      "/api/admin",
      "PATCH",
      {
        action: "moderateListing",
        id: listingId,
        visibility: "visible",
        reason: "Restoring test listing",
      },
      "owner",
    );
    assert.equal((await (await call("/api/listings")).json()).length, 1);
    await call(
      "/api/admin",
      "PATCH",
      {
        action: "userStatus",
        id: seller.id,
        status: "suspended",
        reason: "Testing suspension",
      },
      "owner",
    );
    assert.equal((await (await call("/api/listings")).json()).length, 0);
    assert.equal((await call("/api/profiles/" + seller.id)).status, 404);
    assert.equal(
      (await call("/api/listings", "POST", listing, "seller")).status,
      403,
    );
    assert.equal(
      (await call("/api/profile", "PUT", profiles.seller, "seller")).status,
      403,
    );
    assert.equal(
      (await call("/api/uploads", "POST", data, "seller")).status,
      403,
    );
    await call(
      "/api/admin",
      "PATCH",
      {
        action: "userStatus",
        id: seller.id,
        status: "active",
        reason: "Restoring test account",
      },
      "owner",
    );
    await call(
      "/api/profile",
      "PUT",
      { ...profiles.seller, displayName: "Updated Seller", city: "Samarkand" },
      "seller",
    );
    rows = await (await call("/api/listings")).json();
    assert.equal(rows[0].seller, "Updated Seller");
    assert.equal(rows[0].city, "Samarkand");
    assert.equal((await call('/api/account','POST',{mode:'signup',email:'owner@example.test',password:'marketplace-owner-password',confirmPassword:'marketplace-owner-password',displayName:'Owner'},'owner')).status,201);
    await call(
      "/api/profile",
      "PUT",
      { ...profiles.other, displayName: "Owner" },
      "owner",
    );
    const ownerProfile = (
      await (await call("/api/profile", "GET", undefined, "owner")).json()
    ).profile;
    assert.equal(
      (
        await call(
          "/api/admin",
          "PATCH",
          {
            action: "userStatus",
            id: ownerProfile.id,
            status: "suspended",
            reason: "Should be rejected",
          },
          "owner",
        )
      ).status,
      403,
    );
    const audit = await (
      await call("/api/admin?section=audit", "GET", undefined, "owner")
    ).json();
    assert.equal(audit.rows.length, 4);
    assert.ok(audit.rows.every((row) => row.reason));
    assert.equal(
      (await call("/api/listings", "PATCH", { id: listingId }, "seller"))
        .status,
      200,
    );
    assert.equal((await (await call("/api/listings")).json()).length, 0);
    assert.equal(
      (
        await call(
          "/api/admin?section=users&page=999",
          "GET",
          undefined,
          "owner",
        )
      ).status,
      200,
    );
    // Admin team provisioning uses separate identities, including ones without seller profiles.
    assert.equal((await call('/api/admin/accounts','POST',{email:'newadmin@example.test',password:'new-admin-password',reason:'Appoint test administrator'},'owner')).status,200);
    assert.equal((await call('/api/admin/accounts','POST',{email:'newadmin@example.test',password:'replacement-password',reason:'Duplicate cannot reset password'},'owner')).status,409);
    let adminLogin=await call('/api/admin/session','POST',{email:'newadmin@example.test',password:'new-admin-password'},'newadmin');
    assert.equal(adminLogin.status,200); cookies.newadmin=adminLogin.headers.get('set-cookie').split(';')[0];
    assert.equal((await call('/api/admin','GET',undefined,'newadmin')).status,200);
    cookies.other=cookies.newadmin;
    assert.equal((await call('/api/admin','GET',undefined,'other')).status,403,'sessions bound to verified identity');
    delete cookies.other;
    assert.equal((await call('/api/admin/accounts','POST',{email:'secondadmin@example.test',password:'second-admin-password',reason:'Delegated administrator addition'},'newadmin')).status,200);
    assert.equal((await call('/api/admin/accounts','DELETE',{email:'owner@example.test',reason:'Cannot remove protected owner'},'newadmin')).status,403);
    assert.equal((await call('/api/admin/accounts','DELETE',{email:'newadmin@example.test',reason:'Cannot revoke own access'},'newadmin')).status,403);
    assert.equal((await call('/api/admin/accounts','DELETE',{email:'newadmin@example.test',reason:'Revoke test administrator'},'owner')).status,200);
    assert.equal((await call('/api/admin','GET',undefined,'newadmin')).status,403,'revocation invalidates active session immediately');
    assert.equal((await call('/api/admin/session','POST',{email:'newadmin@example.test',password:'new-admin-password'},'newadmin')).status,403,'revoked account cannot sign back in');
    const team=await (await call('/api/admin/accounts','GET',undefined,'owner')).json();
    assert.ok(team.rows.some(x=>x.isOwner));
    assert.ok(team.rows.every(x=>!('passwordHash' in x)&&!('addedBy' in x)));
    assert.equal((await call('/api/admin/accounts','POST',{email:'evil@example.test',password:'evil-test-password',reason:'Must deny normal accounts'},'seller')).status,403);
    for(let i=0;i<6;i++) {
      const limited=await call('/api/admin/session','POST',{email:'limited@example.test',password:'incorrect'},'limited','ru');
      assert.equal(limited.status,i===5?429:403);
      if(i===5) assert.match((await limited.json()).error,/попыток/);
    }
    const sessions=await db.prepare('SELECT * FROM admin_sessions').all();
    assert.ok(sessions.results.every(x=>!x.token_hash.includes(cookies.owner.split('=')[1])),'only token digests stored');
    await db.prepare('UPDATE admin_sessions SET expires_at = 0 WHERE owner_id = ?').bind('chatgpt:owner').run();
    assert.equal((await call('/api/admin','GET',undefined,'owner')).status,403,'expired sessions denied');
    adminLogin=await call('/api/admin/session','POST',{email:'owner@example.test',password:'owner-test-password'},'owner');
    cookies.owner=adminLogin.headers.get('set-cookie').split(';')[0];
    assert.equal((await call('/api/admin/session','DELETE',undefined,'owner')).status,200);
    assert.equal((await call('/api/admin','GET',undefined,'owner')).status,403,'logout invalidates existing token');
    // Password login works without a platform sign-in; logout removes access.
    await call('/api/account','DELETE',undefined,'seller');
    assert.equal((await call('/api/profile','GET',undefined,'seller')).status,401,'verified identity alone cannot log in');
    assert.equal((await call('/api/account','POST',{mode:'login',email:'seller@example.test',password:'wrong-password-123'},'seller','ru')).status,401);
    const directLogin=await mf.dispatchFetch('https://fragweb.test/api/account',{method:'POST',headers:{origin:'https://fragweb.test','content-type':'application/json'},body:JSON.stringify({mode:'login',email:'  SELLER@EXAMPLE.TEST ',password:'seller-password-123'})});
    assert.equal(directLogin.status,200);const nativeCookie=directLogin.headers.get('set-cookie').split(';')[0];
    assert.equal((await mf.dispatchFetch('https://fragweb.test/api/profile',{headers:{cookie:nativeCookie}})).status,200);
    assert.equal((await mf.dispatchFetch('https://fragweb.test/api/admin',{headers:{cookie:nativeCookie}})).status,401);
    const userAccount=await db.prepare('SELECT password_hash FROM marketplace_accounts WHERE email = ?').bind('seller@example.test').first();assert.ok(!userAccount.password_hash.includes('seller-password-123'));
    await db.prepare('UPDATE marketplace_sessions SET expires_at = 0').run();
    assert.equal((await mf.dispatchFetch('https://fragweb.test/api/profile',{headers:{cookie:nativeCookie}})).status,401,'expired marketplace session cannot access profile');
    // Preserve pre-existing identity/profile when setting a first password.
    await db.prepare('INSERT INTO profiles (id,owner_id,display_name,email,phone,telegram,city,bio,avatar,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').bind('legacy-profile','chatgpt:legacy','Legacy Seller','legacy@example.test','+998901111111','legacy_user','Tashkent','','','active',1,1).run();
    let existingStatus=await (await call('/api/account','GET',undefined,'legacy')).json();assert.equal(existingStatus.needsSetup,true);
    const legacyBody={email:'legacy@example.test',password:'legacy-password-123',confirmPassword:'legacy-password-123',displayName:'Should not overwrite'};
    assert.equal((await call('/api/account','POST',{...legacyBody,mode:'signup'},'legacy')).status,409,'existing user does not go through new signup');
    assert.equal((await call('/api/account','POST',{...legacyBody,mode:'setup',confirmPassword:'different-password'},'legacy')).status,400);
    assert.equal((await call('/api/account','POST',{...legacyBody,mode:'setup'},'legacy')).status,201);
    assert.equal((await (await call('/api/profile','GET',undefined,'legacy')).json()).profile.id,'legacy-profile');
    assert.equal((await call('/api/account','POST',{...legacyBody,mode:'setup'},'legacy')).status,409,'setup cannot reset an existing password');
    const raceBody={mode:'signup',email:'race@example.test',password:'race-password-123',confirmPassword:'race-password-123',displayName:'Race User'};
    const race=await Promise.all([call('/api/account','POST',raceBody,'race'),call('/api/account','POST',raceBody,'race')]);assert.deepEqual(race.map(x=>x.status).sort(),[201,409]);
    assert.equal((await db.prepare('SELECT count(*) AS n FROM profiles WHERE email = ?').bind('race@example.test').first()).n,1,'concurrent signup cannot create duplicate profiles');
    // Cleanup is narrowly scoped, reversible, owner-only and idempotent.
    const ownerAgain=await call('/api/admin/session','POST',{email:'owner@example.test',password:'owner-test-password'},'owner');assert.equal(ownerAgain.status,200);
    const testId='02d33ddf-b664-4a4b-985d-85aa397f91c9';
    await db.prepare('INSERT INTO listings (id,owner_id,seller,phone,telegram,city,brand,name,gender,size,remaining,price,condition,description,photos,moderation_status,status,created_at) SELECT ?,owner_id,seller,phone,telegram,city,brand,name,gender,size,remaining,price,condition,?,photos,moderation_status,status,? FROM listings WHERE id = ?').bind(testId,'dasjdnasjdnajsndajndasnsj',1793856070769,listingId).run();
    assert.equal((await call('/api/admin/cleanup','POST',{confirm:testId},'seller')).status,403);
    assert.equal((await call('/api/admin/cleanup','POST',{confirm:'wrong'},'owner')).status,400);
    assert.equal((await call('/api/admin/cleanup','POST',{confirm:testId},'owner')).status,200);
    assert.equal((await db.prepare('SELECT status FROM listings WHERE id = ?').bind(testId).first()).status,'archived');
    assert.equal((await db.prepare('SELECT count(*) AS n FROM profiles WHERE id = ?').bind(seller.id).first()).n,1);
    assert.equal((await db.prepare('SELECT count(*) AS n FROM listings WHERE id = ?').bind(listingId).first()).n,1);
    assert.equal((await call('/api/admin/cleanup','POST',{confirm:testId},'owner')).status,200);
    assert.equal((await db.prepare("SELECT count(*) AS n FROM audit_logs WHERE action = 'testListingArchived'").first()).n,1);
    const foreignLogin=await mf.dispatchFetch('https://fragweb.test/api/account',{method:'POST',headers:{origin:'https://evil.test','content-type':'application/json'},body:JSON.stringify({mode:'login',email:'seller@example.test',password:'seller-password-123'})});assert.equal(foreignLogin.status,403);
    const ownerRows=await (await call('/api/admin','GET',undefined,'owner')).json();
    const ownerRow=ownerRows.rows.find(x=>x.id===ownerProfile.id);assert.equal(ownerRow.role,'user');assert.equal('isAdmin' in ownerRow,false);
    const csrf = await mf.dispatchFetch("https://fragweb.test/api/profile", {
      method: "PUT",
      headers: {
        origin: "https://evil.test",
        "oai-authenticated-user-id": "seller",
      },
      body: JSON.stringify(profiles.seller),
    });
    assert.equal(csrf.status, 403);
  } finally {
    if (mf) await mf.dispose();
    await rm(temporary, { recursive: true, force: true });
  }
});
