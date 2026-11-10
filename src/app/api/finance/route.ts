import { z } from "zod";
import {
  authenticate,
  admin,
  failure,
  reply,
  jsonBody,
  HttpError,
} from "@/lib/server";
import { applyCommand } from "@/domain/commands";
import { commandSchema, stateSchema } from "@/domain/types";
import { today } from "@/domain/money";
export const dynamic = "force-dynamic";
const inputSchema = z.object({
  command: commandSchema,
  revision: z.number().int().nonnegative(),
  requestId: z.uuid(),
});
export async function GET(req: Request) {
  try {
    const { db, user } = await authenticate(req);
    const { data: member, error } = await db
      .from("household_members")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error)
      throw new Error("Banco não configurado: aplique a migração SQL.");
    if (!member) return reply({ household: null });
    const [
      { data: row, error: readError },
      { data: members },
      { data: household },
    ] = await Promise.all([
      db
        .from("finance_state")
        .select("*")
        .eq("household_id", member.household_id)
        .single(),
      db
        .from("household_members")
        .select("user_id,slot")
        .eq("household_id", member.household_id),
      db.from("households").select("*").eq("id", member.household_id).single(),
    ]);
    if (readError || !row)
      throw new Error("Não foi possível carregar o espaço.");
    return reply({
      state: stateSchema.parse(row.document),
      revision: row.revision,
      updatedAt: row.updated_at,
      members,
      household,
      slot: member.slot,
    });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: Request) {
  try {
    const { db, user } = await authenticate(req);
    const input = inputSchema.parse(await jsonBody(req));
    const { data: member } = await db
      .from("household_members")
      .select("household_id")
      .eq("user_id", user.id)
      .single();
    if (!member) throw new HttpError(403, "Crie ou entre em um espaço.");
    const service = admin();
    const { data: seen } = await service
      .from("finance_requests")
      .select("request_id")
      .eq("household_id", member.household_id)
      .eq("request_id", input.requestId)
      .eq("actor", user.id)
      .maybeSingle();
    if (seen) return reply({ ok: true, replayed: true });
    const { data: row } = await db
      .from("finance_state")
      .select("*")
      .eq("household_id", member.household_id)
      .single();
    if (!row) throw new HttpError(404, "Espaço não encontrado.");
    if (row.revision !== input.revision)
      throw new HttpError(
        409,
        "Seu parceiro atualizou os dados. Recarregamos o espaço; revise e tente novamente.",
      );
    const state = applyCommand(
      stateSchema.parse(row.document),
      input.command,
      user.id,
      today(),
    );
    const { error } = await service.rpc("save_finance", {
      p_household: member.household_id,
      p_actor: user.id,
      p_revision: input.revision,
      p_request: input.requestId,
      p_document: state,
      p_action: input.command.type,
    });
    if (error)
      throw new HttpError(
        error.message.includes("CONFLICT") ? 409 : 400,
        error.message,
      );
    return reply({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
