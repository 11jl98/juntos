import "server-only";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function authenticate(req: Request) {
  const token = req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new HttpError(401, "Entre na sua conta para continuar.");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new HttpError(503, "Supabase ainda não configurado.");
  const db = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user)
    throw new HttpError(401, "Sessão expirada. Entre novamente.");
  if (!data.user.email_confirmed_at)
    throw new HttpError(403, "Confirme seu e-mail antes de continuar.");
  return { db, user: data.user };
}
export function admin() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key || key.startsWith("sb_publishable_"))
    throw new HttpError(
      503,
      "Configure SUPABASE_SECRET_KEY com a secret key do projeto, não com a publishable key.",
    );
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export async function jsonBody(req: Request) {
  const text = await req.text();
  if (new TextEncoder().encode(text).length > 3_500_000)
    throw new HttpError(413, "Envie um lote menor de lançamentos.");
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "Requisição inválida.");
  }
}
export function reply(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      Vary: "Authorization",
    },
  });
}
export function failure(e: unknown) {
  if (e instanceof HttpError) return reply({ error: e.message }, e.status);
  if (e instanceof ZodError)
    return reply(
      {
        error: e.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .slice(0, 3)
          .join("; "),
      },
      400,
    );
  return reply(
    {
      error:
        e instanceof Error
          ? e.message
          : "Não foi possível concluir a operação.",
    },
    400,
  );
}
