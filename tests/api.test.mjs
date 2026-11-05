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
      bindings: { FRAGWEB_ADMIN_EMAILS: "owner@example.test" },
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
    async function call(path, method = "GET", body, identity, lang = "en") {
      const headers = { "x-fragweb-language": lang };
      if (method !== "GET") headers.origin = "https://fragweb.test";
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
      return mf.dispatchFetch("https://fragweb.test" + path, {
        method,
        headers,
        body,
      });
    }
    assert.equal((await call("/api/admin")).status, 401);
    assert.equal(
      (await call("/api/admin", "GET", undefined, "seller")).status,
      403,
    );
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
