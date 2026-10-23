"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type CampaignRow = {
  id: string;
  slug: string;
  title: string;
  description: string;
  status: "draft" | "active" | "paused" | "ended";
  starts_at: string;
  ends_at: string;
  created_at: string;
};

type PrizeRow = {
  id: string;
  campaign_id: string;
  title: string;
  description: string;
  probability: number;
  quantity: number | null;
  awarded_count: number;
  is_active: boolean;
};

type PlayRow = {
  id: string;
  campaign_id: string;
  prize_id: string | null;
  prize_title_snapshot: string | null;
  prize_description_snapshot: string | null;
  created_at: string;
};

type RedemptionRow = {
  id: string;
  play_id: string;
  full_name: string;
  email: string;
  status: "pending" | "approved" | "redeemed" | "rejected";
  created_at: string;
};

type CampaignForm = {
  title: string;
  slug: string;
  description: string;
  startsAt: string;
  endsAt: string;
};

type PrizeForm = {
  campaignId: string;
  title: string;
  description: string;
  probability: string;
  quantity: string;
  isActive: boolean;
};

const emptyCampaign: CampaignForm = {
  title: "",
  slug: "",
  description: "",
  startsAt: "",
  endsAt: "",
};

const emptyPrize: PrizeForm = {
  campaignId: "",
  title: "",
  description: "",
  probability: "",
  quantity: "",
  isActive: true,
};

function localDateTime(daysFromNow: number) {
  const date = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function isRedemptionStatus(value: string): value is RedemptionRow["status"] {
  return value === "pending" || value === "approved" || value === "redeemed" || value === "rejected";
}

export default function AdminPage() {
  const [supabase, setSupabase] = useState<ReturnType<typeof getSupabaseBrowserClient> | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [authLoading, setAuthLoading] = useState(true);
  const [adminAccess, setAdminAccess] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [campaignForm, setCampaignForm] = useState<CampaignForm>(emptyCampaign);
  const [prizeForm, setPrizeForm] = useState<PrizeForm>(emptyPrize);
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [editingCampaignForm, setEditingCampaignForm] = useState<CampaignForm>(emptyCampaign);
  const [editingPrizeId, setEditingPrizeId] = useState<string | null>(null);
  const [editingPrizeForm, setEditingPrizeForm] = useState<PrizeForm>(emptyPrize);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [prizes, setPrizes] = useState<PrizeRow[]>([]);
  const [plays, setPlays] = useState<PlayRow[]>([]);
  const [redemptions, setRedemptions] = useState<RedemptionRow[]>([]);

  useEffect(() => {
    setCampaignForm({
      ...emptyCampaign,
      startsAt: localDateTime(0),
      endsAt: localDateTime(14),
    });

    try {
      const client = getSupabaseBrowserClient();
      setSupabase(client);
      client.auth.getSession().then(({ data, error }) => {
        if (error) {
          setMessage("Não foi possível verificar sua sessão. Tente novamente.");
          console.error("Unable to read admin session:", error.message);
        } else {
          setUserEmail(data.session?.user.email ?? "");
        }
        setAuthLoading(false);
      });

      const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
        setUserEmail(session?.user.email ?? "");
        setAdminAccess(null);
        setCampaigns([]);
        setPrizes([]);
        setPlays([]);
        setRedemptions([]);
      });
      return () => listener.subscription.unsubscribe();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "O painel ainda não foi configurado.",
      );
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!supabase || authLoading || !userEmail) {
      setAdminAccess(false);
      return;
    }

    let current = true;
    setAdminAccess(null);
    supabase.auth.getUser().then(async ({ data, error }) => {
      if (error || !data.user) {
        if (current) setAdminAccess(false);
        return;
      }

      const { data: admin, error: adminError } = await supabase
        .from("admin_users")
        .select("user_id")
        .eq("user_id", data.user.id)
        .maybeSingle();

      if (!current) return;
      if (adminError) {
        console.error("Unable to verify admin access:", adminError.message);
        setMessage("Não foi possível verificar seu acesso administrativo.");
        setAdminAccess(false);
      } else {
        setAdminAccess(Boolean(admin));
      }
    });

    return () => {
      current = false;
    };
  }, [supabase, authLoading, userEmail]);

  useEffect(() => {
    if (!supabase || !userEmail || adminAccess !== true) return;

    let current = true;
    setBusy(true);
    Promise.all([
      supabase.from("campaigns").select("*").order("created_at", { ascending: false }),
      supabase.from("prizes").select("*").order("created_at", { ascending: true }),
      supabase.from("plays").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("redemptions").select("*").order("created_at", { ascending: false }).limit(100),
    ])
      .then(([campaignResult, prizeResult, playResult, redemptionResult]) => {
        const firstError =
          campaignResult.error ??
          prizeResult.error ??
          playResult.error ??
          redemptionResult.error;
        if (firstError) {
          console.error("Unable to load admin dashboard:", firstError.message);
          if (current) setMessage("Não foi possível carregar os dados do painel.");
          return;
        }
        if (!current) return;
        setCampaigns(campaignResult.data ?? []);
        setPrizes(prizeResult.data ?? []);
        setPlays(playResult.data ?? []);
        setRedemptions(redemptionResult.data ?? []);
      })
      .finally(() => {
        if (current) setBusy(false);
      });

    return () => {
      current = false;
    };
  }, [supabase, userEmail, adminAccess]);

  const playsById = useMemo(
    () => new Map(plays.map((play) => [play.id, play])),
    [plays],
  );

  const signIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setMessage("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      console.error("Admin sign-in failed:", error.message);
      setMessage("Não foi possível entrar. Verifique seu e-mail e senha.");
    } else {
      setPassword("");
    }
  };

  const signOut = async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Admin sign-out failed:", error.message);
      setMessage("Não foi possível encerrar a sessão.");
    }
  };

  const createCampaign = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;
    setMessage("");

    const startsAt = Date.parse(campaignForm.startsAt);
    const endsAt = Date.parse(campaignForm.endsAt);
    if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt) || endsAt <= startsAt) {
      setMessage("Informe um período válido, com encerramento posterior ao início.");
      return;
    }

    setBusy(true);
    const { data: userResult, error: userError } = await supabase.auth.getUser();
    if (userError || !userResult.user) {
      setBusy(false);
      setMessage("Sua sessão expirou. Entre novamente.");
      return;
    }

    const { data, error } = await supabase
      .from("campaigns")
      .insert({
        title: campaignForm.title.trim(),
        slug: campaignForm.slug.trim().toLowerCase(),
        description: campaignForm.description.trim(),
        starts_at: new Date(startsAt).toISOString(),
        ends_at: new Date(endsAt).toISOString(),
        created_by: userResult.user.id,
        status: "draft",
      })
      .select("*")
      .single();

    setBusy(false);
    if (error) {
      console.error("Campaign creation failed:", error.message);
      setMessage(
        error.code === "23505"
          ? "Este identificador já está sendo usado. Escolha outro."
          : "Não foi possível criar a campanha. Confira os campos.",
      );
      return;
    }

    setCampaigns((current) => [data, ...current]);
    setPrizeForm((current) => ({ ...current, campaignId: data.id }));
    setCampaignForm({
      ...emptyCampaign,
      startsAt: localDateTime(0),
      endsAt: localDateTime(14),
    });
    setMessage("Campanha criada como rascunho. Adicione brindes e probabilidades para ativá-la.");
  };

  const createPrize = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;
    setMessage("");

    const quantity = prizeForm.quantity.trim() ? Number(prizeForm.quantity) : null;
    const probability = Number(prizeForm.probability);
    const currentProbability = prizes
      .filter((prize) => prize.campaign_id === prizeForm.campaignId && prize.is_active)
      .reduce((sum, prize) => sum + Number(prize.probability), 0);

    if (!campaigns.some((campaign) => campaign.id === prizeForm.campaignId)) {
      setMessage("Selecione uma campanha válida para o brinde.");
      return;
    }
    if (!Number.isFinite(probability) || probability < 0 || probability > 100) {
      setMessage("A probabilidade precisa estar entre 0% e 100%.");
      return;
    }
    if (quantity !== null && (!Number.isInteger(quantity) || quantity < 0)) {
      setMessage("A quantidade deve ser um número inteiro igual ou maior que zero.");
      return;
    }
    if (prizeForm.isActive && currentProbability + probability > 100) {
      setMessage("A soma das probabilidades ativas não pode ultrapassar 100%.");
      return;
    }

    setBusy(true);
    const { data, error } = await supabase
      .from("prizes")
      .insert({
        campaign_id: prizeForm.campaignId,
        title: prizeForm.title.trim(),
        description: prizeForm.description.trim(),
        probability,
        quantity,
        is_active: prizeForm.isActive,
      })
      .select("*")
      .single();

    setBusy(false);
    if (error) {
      console.error("Prize creation failed:", error.message);
      setMessage("Não foi possível adicionar o brinde. Confira a campanha e os valores.");
      return;
    }

    setPrizes((current) => [...current, data]);
    setPrizeForm((current) => ({
      ...emptyPrize,
      campaignId: current.campaignId,
    }));
    setMessage("Brinde adicionado à campanha.");
  };

  const editCampaign = async (campaign: CampaignRow) => {
    if (!supabase) return;
    const startsAt = Date.parse(editingCampaignForm.startsAt);
    const endsAt = Date.parse(editingCampaignForm.endsAt);
    if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt) || endsAt <= startsAt) {
      setMessage("Informe um período válido, com encerramento posterior ao início.");
      return;
    }
    setBusy(true);
    setMessage("");
    const { data, error } = await supabase
      .from("campaigns")
      .update({
        title: editingCampaignForm.title.trim(),
        description: editingCampaignForm.description.trim(),
        starts_at: new Date(startsAt).toISOString(),
        ends_at: new Date(endsAt).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", campaign.id)
      .select("*")
      .single();
    setBusy(false);
    if (error) {
      console.error("Campaign update failed:", error.message);
      setMessage("Não foi possível atualizar a campanha. Confira os campos.");
      return;
    }
    setCampaigns((current) => current.map((item) => item.id === campaign.id ? data : item));
    setEditingCampaignId(null);
    setMessage("Campanha atualizada.");
  };

  const editPrize = async (prize: PrizeRow) => {
    if (!supabase) return;
    const quantity = editingPrizeForm.quantity.trim() ? Number(editingPrizeForm.quantity) : null;
    const probability = Number(editingPrizeForm.probability);
    if (!Number.isFinite(probability) || probability < 0 || probability > 100) {
      setMessage("A probabilidade precisa estar entre 0% e 100%.");
      return;
    }
    if (quantity !== null && (!Number.isInteger(quantity) || quantity < 0)) {
      setMessage("A quantidade deve ser um número inteiro igual ou maior que zero.");
      return;
    }
    const otherActiveProbability = prizes
      .filter((item) => item.campaign_id === prize.campaign_id && item.id !== prize.id && item.is_active)
      .reduce((sum, item) => sum + Number(item.probability), 0);
    if (
      editingPrizeForm.isActive &&
      otherActiveProbability + probability > 100
    ) {
      setMessage("A soma das probabilidades ativas não pode ultrapassar 100%.");
      return;
    }

    setBusy(true);
    setMessage("");
    const { data, error } = await supabase
      .from("prizes")
      .update({
        title: editingPrizeForm.title.trim(),
        description: editingPrizeForm.description.trim(),
        probability,
        quantity,
        is_active: editingPrizeForm.isActive,
      })
      .eq("id", prize.id)
      .select("*")
      .single();
    setBusy(false);
    if (error) {
      console.error("Prize update failed:", error.message);
      setMessage("Não foi possível atualizar o brinde. Confira os campos e o estoque já distribuído.");
      return;
    }
    setPrizes((current) => current.map((item) => item.id === prize.id ? data : item));
    setEditingPrizeId(null);
    setMessage("Brinde atualizado.");
  };

  const beginEditCampaign = (campaign: CampaignRow) => {
    const toLocalInput = (value: string) => {
      const date = new Date(value);
      return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
        .toISOString()
        .slice(0, 16);
    };
    setEditingCampaignId(campaign.id);
    setEditingCampaignForm({
      title: campaign.title,
      slug: campaign.slug,
      description: campaign.description,
      startsAt: toLocalInput(campaign.starts_at),
      endsAt: toLocalInput(campaign.ends_at),
    });
  };

  const beginEditPrize = (prize: PrizeRow) => {
    setEditingPrizeId(prize.id);
    setEditingPrizeForm({
      campaignId: prize.campaign_id,
      title: prize.title,
      description: prize.description,
      probability: String(prize.probability),
      quantity: prize.quantity === null ? "" : String(prize.quantity),
      isActive: prize.is_active,
    });
  };

  const toggleCampaign = async (campaign: CampaignRow) => {
    if (!supabase) return;
    const nextStatus = campaign.status === "active" ? "paused" : "active";
    const campaignPrizes = prizes.filter((prize) => prize.campaign_id === campaign.id && prize.is_active);
    const totalProbability = campaignPrizes.reduce(
      (total, prize) => total + Number(prize.probability),
      0,
    );

    if (nextStatus === "active") {
      if (campaignPrizes.length === 0) {
        setMessage("Adicione ao menos um brinde ativo antes de publicar a campanha.");
        return;
      }
      if (totalProbability > 100) {
        setMessage("A soma das probabilidades não pode ultrapassar 100%.");
        return;
      }
      if (new Date(campaign.ends_at) <= new Date(campaign.starts_at)) {
        setMessage("A data final precisa ser posterior à data inicial.");
        return;
      }
    }

    setBusy(true);
    setMessage("");
    const { data, error } = await supabase
      .from("campaigns")
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq("id", campaign.id)
      .select("*")
      .single();
    setBusy(false);

    if (error) {
      console.error("Campaign status update failed:", error.message);
      setMessage("Não foi possível atualizar o status da campanha.");
      return;
    }

    setCampaigns((current) =>
      current.map((item) => (item.id === campaign.id ? data : item)),
    );
    setMessage(nextStatus === "active" ? "Campanha publicada." : "Campanha pausada.");
  };

  const updateRedemption = async (
    redemption: RedemptionRow,
    status: RedemptionRow["status"],
  ) => {
    if (!supabase) return;
    setBusy(true);
    setMessage("");
    const { error } = await supabase
      .from("redemptions")
      .update({ status })
      .eq("id", redemption.id);
    setBusy(false);

    if (error) {
      console.error("Redemption status update failed:", error.message);
      setMessage("Não foi possível atualizar o status do resgate.");
      return;
    }
    setRedemptions((current) =>
      current.map((item) => (item.id === redemption.id ? { ...item, status } : item)),
    );
  };

  const activeCampaigns = campaigns.filter((campaign) => campaign.status === "active").length;
  const winningPlays = plays.filter((play) => play.prize_id !== null).length;
  const pendingRedemptions = redemptions.filter((item) => item.status === "pending").length;

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <Link className="brand" href="/">
          <span className="brand-mark" aria-hidden="true">S</span>
          <span>Sorte de Casa <small>· painel</small></span>
        </Link>
        {userEmail && (
          <div className="admin-header-actions">
            <span>{userEmail}</span>
            <button type="button" onClick={signOut}>Sair</button>
          </div>
        )}
      </header>

      {authLoading ? (
        <div className="admin-loading" role="status">Verificando sessão…</div>
      ) : !userEmail ? (
        <div className="login-panel">
          <form className="login-form" onSubmit={signIn}>
            <span className="section-kicker">ÁREA RESTRITA</span>
            <h1>Entrar no painel</h1>
            <p>Acesse com a conta de administração cadastrada no Supabase.</p>
            <label>
              E-mail
              <input
                autoComplete="username"
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
              />
            </label>
            <label>
              Senha
              <input
                autoComplete="current-password"
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
            </label>
            <button className="admin-button" type="submit" disabled={busy}>
              {busy ? "Entrando…" : "Entrar"}
            </button>
            {message && <p className="admin-error" role="alert">{message}</p>}
          </form>
        </div>
      ) : adminAccess === null ? (
        <div className="admin-loading" role="status">Verificando permissão administrativa…</div>
      ) : !adminAccess ? (
        <div className="login-panel">
          <div className="login-form">
            <span className="section-kicker">ACESSO NÃO AUTORIZADO</span>
            <h1>Conta sem permissão</h1>
            <p>Peça a um responsável para cadastrar este usuário como administrador no banco de dados.</p>
            {message && <p className="admin-error" role="alert">{message}</p>}
            <button className="admin-button" type="button" onClick={signOut}>Sair</button>
          </div>
        </div>
      ) : (
        <div className="admin-content">
          <div className="admin-title-row">
            <div>
              <span className="section-kicker">VISÃO GERAL</span>
              <h1>Suas campanhas</h1>
            </div>
            <button
              className="admin-button"
              type="button"
              onClick={() => window.location.reload()}
              disabled={busy}
            >
              Atualizar dados
            </button>
          </div>

          <section className="admin-stats" aria-label="Resumo das campanhas">
            <article><span>Campanhas ativas</span><strong>{activeCampaigns}</strong></article>
            <article><span>Jogadas recentes</span><strong>{plays.length}</strong></article>
            <article><span>Jogadas premiadas</span><strong>{winningPlays}</strong></article>
            <article><span>Resgates pendentes</span><strong>{pendingRedemptions}</strong></article>
          </section>

          <section className="admin-panel">
            <h2>Criar campanha</h2>
            <form className="admin-form" onSubmit={createCampaign}>
              <label>
                Nome da campanha
                <input
                  maxLength={120}
                  minLength={3}
                  onChange={(event) => setCampaignForm({ ...campaignForm, title: event.target.value })}
                  required
                  value={campaignForm.title}
                />
              </label>
              <label>
                Identificador do link
                <input
                  maxLength={80}
                  onChange={(event) => setCampaignForm({
                    ...campaignForm,
                    slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, ""),
                  })}
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  placeholder="promocao-de-inauguracao"
                  required
                  value={campaignForm.slug}
                />
              </label>
              <label className="full-width">
                Descrição pública
                <textarea
                  maxLength={500}
                  onChange={(event) => setCampaignForm({ ...campaignForm, description: event.target.value })}
                  value={campaignForm.description}
                />
              </label>
              <label>
                Início
                <input
                  onChange={(event) => setCampaignForm({ ...campaignForm, startsAt: event.target.value })}
                  required
                  type="datetime-local"
                  value={campaignForm.startsAt}
                />
              </label>
              <label>
                Encerramento
                <input
                  onChange={(event) => setCampaignForm({ ...campaignForm, endsAt: event.target.value })}
                  required
                  type="datetime-local"
                  value={campaignForm.endsAt}
                />
              </label>
              <button className="admin-button" type="submit" disabled={busy}>Salvar rascunho</button>
            </form>
          </section>

          <section className="admin-panel admin-section">
            <h2>Adicionar brinde</h2>
            <form className="admin-form" onSubmit={createPrize}>
              <label>
                Campanha
                <select
                  onChange={(event) => setPrizeForm({ ...prizeForm, campaignId: event.target.value })}
                  required
                  value={prizeForm.campaignId}
                >
                  <option value="">Selecione uma campanha</option>
                  {campaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>{campaign.title}</option>
                  ))}
                </select>
              </label>
              <label>
                Nome do brinde
                <input
                  maxLength={100}
                  minLength={2}
                  onChange={(event) => setPrizeForm({ ...prizeForm, title: event.target.value })}
                  required
                  value={prizeForm.title}
                />
              </label>
              <label className="full-width">
                Descrição do brinde
                <textarea
                  maxLength={300}
                  onChange={(event) => setPrizeForm({ ...prizeForm, description: event.target.value })}
                  value={prizeForm.description}
                />
              </label>
              <label>
                Probabilidade de ganhar (%)
                <input
                  min="0"
                  max="100"
                  onChange={(event) => setPrizeForm({ ...prizeForm, probability: event.target.value })}
                  required
                  step="0.01"
                  type="number"
                  value={prizeForm.probability}
                />
              </label>
              <label>
                Quantidade (vazio = sem limite)
                <input
                  min="0"
                  onChange={(event) => setPrizeForm({ ...prizeForm, quantity: event.target.value })}
                  step="1"
                  type="number"
                  value={prizeForm.quantity}
                />
              </label>
              <label className="checkbox-label">
                <input
                  checked={prizeForm.isActive}
                  onChange={(event) => setPrizeForm({ ...prizeForm, isActive: event.target.checked })}
                  type="checkbox"
                />
                Brinde ativo na campanha
              </label>
              <button className="admin-button" type="submit" disabled={busy}>Adicionar brinde</button>
            </form>
          </section>

          {message && <p className="admin-info" role="status">{message}</p>}

          <section className="admin-section">
            <h2>Campanhas</h2>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Campanha</th><th>Período</th><th>Brindes / chances</th><th>Status</th><th>Ação</th></tr></thead>
                <tbody>
                  {campaigns.map((campaign) => {
                    const campaignPrizes = prizes.filter((prize) => prize.campaign_id === campaign.id);
                    const totalProbability = campaignPrizes.reduce((sum, prize) => sum + Number(prize.probability), 0);
                    return (
                      <tr key={campaign.id}>
                        <td>
                          <strong>{campaign.title}</strong>
                          <br />
                          <small>/{campaign.slug}</small>
                        </td>
                        <td>{formatDate(campaign.starts_at)}<br />até {formatDate(campaign.ends_at)}</td>
                        <td>
                          {campaignPrizes.length} brindes
                          <br />
                          <small>{totalProbability.toFixed(2)}% configurados</small>
                        </td>
                        <td><span className={`status-pill status-${campaign.status}`}>{campaign.status}</span></td>
                        <td>
                          <button
                            className="table-action"
                            type="button"
                            onClick={() => {
                              if (editingCampaignId === campaign.id) {
                                setEditingCampaignId(null);
                              } else {
                                beginEditCampaign(campaign);
                              }
                            }}
                            disabled={busy}
                          >
                            {editingCampaignId === campaign.id ? "Fechar edição" : "Editar"}
                          </button>
                          <br />
                          {campaign.status !== "ended" && (
                            <button className="table-action" type="button" onClick={() => toggleCampaign(campaign)} disabled={busy}>
                              {campaign.status === "active" ? "Pausar" : "Ativar"}
                            </button>
                          )}
                          <br />
                          <Link className="table-action" href={`/?campanha=${encodeURIComponent(campaign.slug)}`} target="_blank" rel="noreferrer">
                            Abrir jogo
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                  {campaigns.filter((campaign) => campaign.id === editingCampaignId).map((campaign) => (
                    <tr key={`edit-${campaign.id}`}>
                      <td colSpan={5}>
                        <form
                          className="admin-form table-edit-form"
                          onSubmit={(event) => {
                            event.preventDefault();
                            void editCampaign(campaign);
                          }}
                        >
                          <label>
                            Nome da campanha
                            <input
                              maxLength={120}
                              minLength={3}
                              onChange={(event) => setEditingCampaignForm({ ...editingCampaignForm, title: event.target.value })}
                              required
                              value={editingCampaignForm.title}
                            />
                          </label>
                          <label>
                            Link da campanha
                            <input readOnly value={`/?campanha=${campaign.slug}`} />
                          </label>
                          <label className="full-width">
                            Descrição pública
                            <textarea
                              maxLength={500}
                              onChange={(event) => setEditingCampaignForm({ ...editingCampaignForm, description: event.target.value })}
                              value={editingCampaignForm.description}
                            />
                          </label>
                          <label>
                            Início
                            <input
                              onChange={(event) => setEditingCampaignForm({ ...editingCampaignForm, startsAt: event.target.value })}
                              required
                              type="datetime-local"
                              value={editingCampaignForm.startsAt}
                            />
                          </label>
                          <label>
                            Encerramento
                            <input
                              onChange={(event) => setEditingCampaignForm({ ...editingCampaignForm, endsAt: event.target.value })}
                              required
                              type="datetime-local"
                              value={editingCampaignForm.endsAt}
                            />
                          </label>
                          <div className="form-actions full-width">
                            <button className="admin-button" type="submit" disabled={busy}>Salvar alterações</button>
                            <button className="cancel-button" type="button" onClick={() => setEditingCampaignId(null)}>Cancelar</button>
                          </div>
                        </form>
                      </td>
                    </tr>
                  ))}
                  {campaigns.length === 0 && (
                    <tr><td className="admin-empty" colSpan={5}>Ainda não há campanhas.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="admin-section">
            <h2>Brindes configurados</h2>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Campanha</th><th>Brinde</th><th>Probabilidade</th><th>Estoque</th><th>Status</th><th>Ação</th></tr></thead>
                <tbody>
                  {prizes.map((prize) => (
                    <tr key={prize.id}>
                      <td>{campaigns.find((item) => item.id === prize.campaign_id)?.title ?? "Campanha removida"}</td>
                      <td><strong>{prize.title}</strong></td>
                      <td>{Number(prize.probability).toFixed(2)}%</td>
                      <td>{prize.quantity === null ? "Sem limite" : `${prize.awarded_count} / ${prize.quantity}`}</td>
                      <td><span className={`status-pill ${prize.is_active ? "status-active" : "status-paused"}`}>{prize.is_active ? "Ativo" : "Inativo"}</span></td>
                      <td>
                        <button
                          className="table-action"
                          type="button"
                          onClick={() => {
                            if (editingPrizeId === prize.id) {
                              setEditingPrizeId(null);
                            } else {
                              beginEditPrize(prize);
                            }
                          }}
                          disabled={busy}
                        >
                          {editingPrizeId === prize.id ? "Fechar edição" : "Editar"}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {prizes.filter((prize) => prize.id === editingPrizeId).map((prize) => (
                    <tr key={`edit-${prize.id}`}>
                      <td colSpan={6}>
                        <form
                          className="admin-form table-edit-form"
                          onSubmit={(event) => {
                            event.preventDefault();
                            void editPrize(prize);
                          }}
                        >
                          <label>
                            Nome do brinde
                            <input
                              maxLength={100}
                              minLength={2}
                              onChange={(event) => setEditingPrizeForm({ ...editingPrizeForm, title: event.target.value })}
                              required
                              value={editingPrizeForm.title}
                            />
                          </label>
                          <label>
                            Probabilidade (%)
                            <input
                              min="0"
                              max="100"
                              onChange={(event) => setEditingPrizeForm({ ...editingPrizeForm, probability: event.target.value })}
                              required
                              step="0.01"
                              type="number"
                              value={editingPrizeForm.probability}
                            />
                          </label>
                          <label className="full-width">
                            Descrição
                            <textarea
                              maxLength={300}
                              onChange={(event) => setEditingPrizeForm({ ...editingPrizeForm, description: event.target.value })}
                              value={editingPrizeForm.description}
                            />
                          </label>
                          <label>
                            Quantidade (vazio = sem limite)
                            <input
                              min={prize.awarded_count}
                              onChange={(event) => setEditingPrizeForm({ ...editingPrizeForm, quantity: event.target.value })}
                              step="1"
                              type="number"
                              value={editingPrizeForm.quantity}
                            />
                          </label>
                          <label className="checkbox-label">
                            <input
                              checked={editingPrizeForm.isActive}
                              onChange={(event) => setEditingPrizeForm({ ...editingPrizeForm, isActive: event.target.checked })}
                              type="checkbox"
                            />
                            Brinde ativo na campanha
                          </label>
                          <div className="form-actions full-width">
                            <button className="admin-button" type="submit" disabled={busy}>Salvar brinde</button>
                            <button className="cancel-button" type="button" onClick={() => setEditingPrizeId(null)}>Cancelar</button>
                          </div>
                        </form>
                      </td>
                    </tr>
                  ))}
                  {prizes.length === 0 && (
                    <tr><td className="admin-empty" colSpan={6}>Ainda não há brindes configurados.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="admin-section">
            <h2>Jogadas recentes</h2>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Data</th><th>Campanha</th><th>Resultado</th></tr></thead>
                <tbody>
                  {plays.slice(0, 25).map((play) => {
                    const campaign = campaigns.find((item) => item.id === play.campaign_id);
                    return (
                      <tr key={play.id}>
                        <td>{formatDate(play.created_at)}</td>
                        <td>{campaign?.title ?? "Campanha removida"}</td>
                        <td>{play.prize_title_snapshot ? `Ganhou: ${play.prize_title_snapshot}` : "Não premiada"}</td>
                      </tr>
                    );
                  })}
                  {plays.length === 0 && (
                    <tr><td className="admin-empty" colSpan={3}>As jogadas aparecerão aqui.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="admin-section">
            <h2>Resgates de brindes</h2>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Ganhador</th><th>Brinde</th><th>Enviado em</th><th>Status</th></tr></thead>
                <tbody>
                  {redemptions.map((redemption) => {
                    const play = playsById.get(redemption.play_id);
                    return (
                      <tr key={redemption.id}>
                        <td><strong>{redemption.full_name}</strong><br /><small>{redemption.email}</small></td>
                        <td>{play?.prize_title_snapshot ?? "Brinde premiado"}</td>
                        <td>{formatDate(redemption.created_at)}</td>
                        <td>
                          <select
                            aria-label={`Status do resgate de ${redemption.full_name}`}
                            onChange={(event) => {
                              if (isRedemptionStatus(event.target.value)) {
                                void updateRedemption(redemption, event.target.value);
                              }
                            }}
                            value={redemption.status}
                            disabled={busy}
                          >
                            <option value="pending">Pendente</option>
                            <option value="approved">Aprovado</option>
                            <option value="redeemed">Resgatado</option>
                            <option value="rejected">Recusado</option>
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                  {redemptions.length === 0 && (
                    <tr><td className="admin-empty" colSpan={4}>Nenhum resgate enviado até agora.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
