import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80) {
    return NextResponse.json({ error: "Campanha inválida." }, { status: 400 });
  }

  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase.rpc("get_public_campaign", {
      p_campaign_slug: slug,
    });

    if (error) {
      console.error("Unable to load campaign:", error.message);
      return NextResponse.json(
        { error: "Não foi possível carregar a campanha." },
        { status: 500 },
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Esta campanha não está disponível." },
        { status: 404 },
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
    console.error("Unexpected campaign loading failure:", error);
    return NextResponse.json(
      { error: "Não foi possível carregar a campanha." },
      { status: 500 },
    );
  }
}
