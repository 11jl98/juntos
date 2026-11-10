import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { emptyState } from "../src/domain/commands";
test("RLS isolates households; invitations bind email; CAS rejects stale writes and deduplicates", async () => {
  const db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('email',current_setting('request.jwt.claim.email',true)) $$;grant usage on schema auth to authenticated;grant execute on all functions in schema auth to authenticated;`,
  );
  await db.exec(await readFile("supabase/migrations/001_initial.sql", "utf8"));
  const a = "00000000-0000-0000-0000-000000000001",
    b = "00000000-0000-0000-0000-000000000002",
    c = "00000000-0000-0000-0000-000000000003";
  await db.query("insert into auth.users values ($1,$2),($3,$4),($5,$6)", [
    a,
    "a@test.com",
    b,
    "b@test.com",
    c,
    "c@test.com",
  ]);
  async function asUser(id: string, email: string) {
    await db.exec("reset role");
    await db.query(
      "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.email',$2,false)",
      [id, email],
    );
    await db.exec("set role authenticated");
  }
  await asUser(a, "a@test.com");
  const created = await db.query<{ create_household: string }>(
    "select public.create_household($1,$2::jsonb)",
    ["Nosso lar", JSON.stringify(emptyState())],
  );
  const hid = created.rows[0].create_household;
  assert.equal((await db.query("select * from finance_state")).rows.length, 1);
  const token = (
    await db.query<{ issue_invite: string }>(
      "select public.issue_invite($1,$2)",
      [hid, "b@test.com"],
    )
  ).rows[0].issue_invite;
  await asUser(c, "c@test.com");
  assert.equal((await db.query("select * from finance_state")).rows.length, 0);
  await assert.rejects(db.query("select join_household($1)", [token]));
  await assert.rejects(db.query("update finance_state set revision=10"));
  await asUser(b, "b@test.com");
  await db.query("select join_household($1)", [token]);
  assert.equal(
    (await db.query("select * from household_members")).rows.length,
    2,
  );
  await assert.rejects(db.query("select join_household($1)", [token]));
  await asUser(a, "a@test.com");
  await assert.rejects(
    db.query("select issue_invite($1,$2)", [hid, "c@test.com"]),
  );
  await db.exec("reset role;set role service_role");
  const request = "10000000-0000-0000-0000-000000000001";
  await db.query("select save_finance($1,$2,$3,$4,$5::jsonb,$6)", [
    hid,
    a,
    0,
    request,
    JSON.stringify(emptyState()),
    "budget",
  ]);
  await db.query("select save_finance($1,$2,$3,$4,$5::jsonb,$6)", [
    hid,
    a,
    0,
    request,
    JSON.stringify(emptyState()),
    "budget",
  ]);
  assert.equal(
    (await db.query<{ revision: number }>("select revision from finance_state"))
      .rows[0].revision,
    1,
  );
  await assert.rejects(
    db.query("select save_finance($1,$2,$3,$4,$5::jsonb,$6)", [
      hid,
      b,
      0,
      "10000000-0000-0000-0000-000000000002",
      JSON.stringify(emptyState()),
      "budget",
    ]),
  );
  await assert.rejects(
    db.query("select save_finance($1,$2,$3,$4,$5::jsonb,$6)", [
      hid,
      c,
      1,
      "10000000-0000-0000-0000-000000000003",
      JSON.stringify(emptyState()),
      "budget",
    ]),
  );
  await db.close();
});
