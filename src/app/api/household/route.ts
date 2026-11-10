import { z } from "zod";
import {
  authenticate,
  jsonBody,
  reply,
  failure,
  HttpError,
} from "@/lib/server";
import { emptyState } from "@/domain/commands";
const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    name: z.string().trim().min(1).max(100),
    names: z.tuple([
      z.string().trim().min(1).max(60),
      z.string().trim().min(1).max(60),
    ]),
  }),
  z.object({ action: z.literal("invite"), email: z.email() }),
  z.object({ action: z.literal("join"), token: z.string().min(60).max(100) }),
]);
export async function POST(req: Request) {
  try {
    const { db, user } = await authenticate(req);
    const c = schema.parse(await jsonBody(req));
    let result;
    if (c.action === "create") {
      const state = emptyState();
      state.names = c.names;
      result = await db.rpc("create_household", {
        p_name: c.name,
        p_document: state,
      });
    } else if (c.action === "join") {
      result = await db.rpc("join_household", { p_token: c.token });
    } else {
      const { data: member } = await db
        .from("household_members")
        .select("household_id")
        .eq("user_id", user.id)
        .single();
      if (!member) throw new HttpError(403, "Espaço não encontrado.");
      result = await db.rpc("issue_invite", {
        p_household: member.household_id,
        p_email: c.email,
      });
    }
    if (result.error) throw new Error(result.error.message);
    return reply({ ok: true, result: result.data });
  } catch (e) {
    return failure(e);
  }
}
