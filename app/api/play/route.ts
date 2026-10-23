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
    !("campaignSlug" in body) ||
    !("participantToken" in body) ||
    typeof body.campaignSlug !== "string" ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(body.campaignSlug) ||
    body.campaignSlug.length > 80 ||
    typeof body.participantToken !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      body.participantToken,
    )
  ) {
    return NextResponse.json({ error: "Dados da jogada inválidos." }, { status: 400 });
  }

  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase.rpc("play_scratchcard", {
      p_campaign_slug: body.campaignSlug,
      p_participant_token: body.participantToken,
    });

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Este dispositivo já participou desta campanha." },
          { status: 409 },
        );
      }
      if (error.code === "P0002") {
        return NextResponse.json(
          { error: "Esta campanha não está disponível para jogar." },
          { status: 410 },
        );
      }
      if (error.code === "22023") {
        return NextResponse.json(
          { error: "A configuração da campanha não permite esta jogada." },
          { status: 422 },
        );
      }
      console.error("Unable to play scratchcard:", error.message);
      return NextResponse.json(
        { error: "Não foi possível registrar sua jogada." },
        { status: 500 },
      );
    }

    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Supabase is not configured") {
      return NextResponse.json(
        { error: "O serviço de campanhas ainda não foi configurado." },
        { status: 503 },
      );
    }
    console.error("Unexpected scratchcard failure:", error);
    return NextResponse.json(
      { error: "Não foi possível registrar sua jogada." },
      { status: 500 },
    );
  }
}
