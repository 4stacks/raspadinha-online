import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Envie um pedido válido." }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    Array.isArray(body) ||
    !("playId" in body) ||
    !("fullName" in body) ||
    !("email" in body) ||
    typeof body.playId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      body.playId,
    ) ||
    typeof body.fullName !== "string" ||
    body.fullName.trim().length < 2 ||
    body.fullName.trim().length > 120 ||
    typeof body.email !== "string" ||
    body.email.trim().length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())
  ) {
    return NextResponse.json(
      { error: "Confira seu nome e e-mail." },
      { status: 400 },
    );
  }

  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase.rpc("submit_redemption", {
      p_play_id: body.playId,
      p_full_name: body.fullName.trim(),
      p_email: body.email.trim(),
    });

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Os dados deste prêmio já foram enviados." },
          { status: 409 },
        );
      }
      if (error.code === "P0002") {
        return NextResponse.json(
          { error: "Não encontramos uma jogada premiada para este resgate." },
          { status: 404 },
        );
      }
      if (error.code === "22023") {
        return NextResponse.json(
          { error: "Confira os dados informados." },
          { status: 400 },
        );
      }
      console.error("Unable to submit redemption:", error.message);
      return NextResponse.json(
        { error: "Não foi possível enviar seus dados." },
        { status: 500 },
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Supabase is not configured") {
      return NextResponse.json(
        { error: "O serviço de campanhas ainda não foi configurado." },
        { status: 503 },
      );
    }
    console.error("Unexpected redemption failure:", error);
    return NextResponse.json(
      { error: "Não foi possível enviar seus dados." },
      { status: 500 },
    );
  }
}
