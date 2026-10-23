"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { ScratchLayer } from "@/components/scratch-layer";

type PublicPrize = {
  title: string;
  description: string;
};

type Campaign = {
  slug: string;
  title: string;
  description: string;
  prizes: PublicPrize[];
};

type PlayResult = {
  play_id: string;
  won: boolean;
  prize: PublicPrize | null;
};

const DEFAULT_CAMPAIGN = "raspadinha-da-sorte";
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isPublicPrize(value: unknown): value is PublicPrize {
  return (
    typeof value === "object" &&
    value !== null &&
    "title" in value &&
    typeof value.title === "string" &&
    "description" in value &&
    typeof value.description === "string"
  );
}

function parseCampaign(value: unknown): Campaign | null {
  if (
    typeof value !== "object" ||
    value === null ||
    !("slug" in value) ||
    typeof value.slug !== "string" ||
    !("title" in value) ||
    typeof value.title !== "string" ||
    !("description" in value) ||
    typeof value.description !== "string" ||
    !("prizes" in value) ||
    !Array.isArray(value.prizes) ||
    !value.prizes.every(isPublicPrize)
  ) {
    return null;
  }
  return {
    slug: value.slug,
    title: value.title,
    description: value.description,
    prizes: value.prizes,
  };
}

function parsePlayResult(value: unknown): PlayResult | null {
  if (
    typeof value !== "object" ||
    value === null ||
    !("play_id" in value) ||
    typeof value.play_id !== "string" ||
    !uuidPattern.test(value.play_id) ||
    !("won" in value) ||
    typeof value.won !== "boolean" ||
    !("prize" in value) ||
    (value.prize !== null && !isPublicPrize(value.prize)) ||
    (value.won && value.prize === null) ||
    (!value.won && value.prize !== null)
  ) {
    return null;
  }
  return {
    play_id: value.play_id,
    won: value.won,
    prize: value.prize,
  };
}

export default function HomePage() {
  const [campaignSlug, setCampaignSlug] = useState(DEFAULT_CAMPAIGN);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loadingCampaign, setLoadingCampaign] = useState(true);
  const [loadingPlay, setLoadingPlay] = useState(false);
  const [playResult, setPlayResult] = useState<PlayResult | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [submittingRedemption, setSubmittingRedemption] = useState(false);
  const [redemptionSubmitted, setRedemptionSubmitted] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const requestedSlug = new URLSearchParams(window.location.search).get("campanha");
    if (requestedSlug && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(requestedSlug)) {
      setCampaignSlug(requestedSlug);
    }
  }, []);

  useEffect(() => {
    let current = true;
    setLoadingCampaign(true);
    setCampaign(null);
    setMessage("");

    fetch(`/api/campaign/${encodeURIComponent(campaignSlug)}`, { cache: "no-store" })
      .then(async (response) => {
        const result: unknown = await response.json();
        if (!response.ok) {
          const errorText =
            typeof result === "object" &&
            result !== null &&
            "error" in result &&
            typeof result.error === "string"
              ? result.error
              : "Não foi possível abrir esta campanha.";
          throw new Error(errorText);
        }
        const campaignData = parseCampaign(result);
        if (!campaignData) throw new Error("A campanha retornou dados inválidos.");
        return campaignData;
      })
      .then((data) => {
        if (current) setCampaign(data);
      })
      .catch((error: unknown) => {
        if (current) {
          setMessage(
            error instanceof Error ? error.message : "Não foi possível abrir esta campanha.",
          );
        }
      })
      .finally(() => {
        if (current) setLoadingCampaign(false);
      });

    return () => {
      current = false;
    };
  }, [campaignSlug]);

  const startGame = async () => {
    setLoadingPlay(true);
    setMessage("");
    setPlayResult(null);
    setRevealed(false);
    setRedemptionSubmitted(false);

    try {
      const storageKey = `sorte-de-casa:${campaignSlug}`;
      let participantToken = localStorage.getItem(storageKey);
      if (!participantToken) {
        participantToken = crypto.randomUUID();
        localStorage.setItem(storageKey, participantToken);
      }

      const response = await fetch("/api/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignSlug, participantToken }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const errorText =
          typeof result === "object" &&
          result !== null &&
          "error" in result &&
          typeof result.error === "string"
            ? result.error
            : "Não foi possível registrar sua jogada.";
        throw new Error(errorText);
      }
      const playData = parsePlayResult(result);
      if (!playData) throw new Error("O resultado da jogada veio em formato inválido.");
      setPlayResult(playData);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível registrar sua jogada. Verifique sua conexão e tente novamente.",
      );
    } finally {
      setLoadingPlay(false);
    }
  };

  const submitRedemption = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!playResult) return;

    setSubmittingRedemption(true);
    setMessage("");
    try {
      const response = await fetch("/api/redemption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playId: playResult.play_id,
          fullName,
          email,
        }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const errorText =
          typeof result === "object" &&
          result !== null &&
          "error" in result &&
          typeof result.error === "string"
            ? result.error
            : "Não foi possível enviar seus dados.";
        throw new Error(errorText);
      }
      setRedemptionSubmitted(true);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Não foi possível enviar seus dados.",
      );
    } finally {
      setSubmittingRedemption(false);
    }
  };

  return (
    <main className="page-shell">
      <header className="site-header">
        <Link className="brand" href="/" aria-label="Sorte de Casa, início">
          <span className="brand-mark" aria-hidden="true">S</span>
          <span>Sorte de Casa</span>
        </Link>
        <a className="header-link" href="#como-funciona">Como funciona</a>
      </header>

      <section className="hero-section" aria-labelledby="hero-title">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-dot" /> UM PRESENTE PODE ESTAR AQUI</div>
          <h1 id="hero-title">
            Um toque de sorte.
            <br />
            <em>Um brinde especial.</em>
          </h1>
          <p>
            Raspe a cartela e descubra se hoje é o seu dia. Participar é simples,
            gratuito e leva só alguns segundos.
          </p>
          <a className="primary-link" href="#jogar">
            Quero tentar a sorte <span aria-hidden="true">↓</span>
          </a>
          <div className="trust-note">
            <span aria-hidden="true">✦</span> Sem custo para participar
            <span className="trust-divider" />
            Resultado registrado com segurança
          </div>
        </div>

        <div className="hero-art" aria-hidden="true">
          <div className="art-sun" />
          <div className="art-orbit orbit-one" />
          <div className="art-orbit orbit-two" />
          <div className="art-card">
            <div className="art-card-top"><span>SORTE DE CASA</span><span>✳</span></div>
            <div className="art-gift">✦</div>
            <div className="art-card-bottom">RASPE &amp; DESCUBRA</div>
          </div>
          <div className="art-spark spark-one">✳</div>
          <div className="art-spark spark-two">✦</div>
          <div className="art-caption">um carinho<br />em forma de sorte</div>
        </div>
      </section>

      <section className="game-section" id="jogar" aria-labelledby="game-title">
        <div className="section-heading">
          <div>
            <span className="section-kicker">SUA CHANCE COMEÇA AQUI</span>
            <h2 id="game-title">A sua raspadinha</h2>
          </div>
          <div className="campaign-tag"><span /> CAMPANHA PROMOCIONAL</div>
        </div>

        <div className="game-layout">
          <div className="game-card">
            {loadingCampaign ? (
              <div className="loading-state" role="status">Preparando sua raspadinha…</div>
            ) : campaign ? (
              <>
                <div className="game-card-header">
                  <span className="game-label">RASPADINHA PREMIADA</span>
                  <span className="game-spark" aria-hidden="true">✳</span>
                  <h3>{campaign.title}</h3>
                  <p>{campaign.description || "Raspe e descubra se um brinde especial está esperando por você."}</p>
                </div>
                <div className="scratch-card" aria-live="polite">
                  <div className="scratch-result">
                    {!playResult ? (
                      <div className="result-placeholder">
                        <span className="placeholder-star" aria-hidden="true">✦</span>
                        <span>Sua sorte está guardada aqui</span>
                      </div>
                    ) : (
                      <div className={`result-message${playResult.won ? " result-win" : ""}`}>
                        <span className="result-icon" aria-hidden="true">
                          {playResult.won ? "✦" : "♡"}
                        </span>
                        {revealed ? (
                          <>
                            <strong>{playResult.won ? "Você ganhou!" : "Quase!"}</strong>
                            <span>
                              {playResult.won
                                ? playResult.prize?.title
                                : "Continue acompanhando as próximas campanhas."}
                            </span>
                            {playResult.won && playResult.prize?.description && (
                              <small>{playResult.prize.description}</small>
                            )}
                          </>
                        ) : (
                          <>
                            <strong>Resultado pronto</strong>
                            <span>Raspe para descobrir</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  {playResult && !revealed && (
                    <ScratchLayer onReveal={() => setRevealed(true)} />
                  )}
                  {!playResult && (
                    <button
                      className="start-game-button"
                      type="button"
                      onClick={startGame}
                      disabled={loadingPlay}
                    >
                      {loadingPlay ? "Preparando…" : "Começar a jogar"}
                      {!loadingPlay && <span aria-hidden="true">↗</span>}
                    </button>
                  )}
                </div>
                {revealed && playResult?.won && !redemptionSubmitted && (
                  <form className="redemption-form" onSubmit={submitRedemption}>
                    <div>
                      <h4>Seu brinde está quase garantido</h4>
                      <p>Informe seus dados para a equipe da promoção entrar em contato.</p>
                    </div>
                    <label>
                      Nome completo
                      <input
                        autoComplete="name"
                        maxLength={120}
                        name="name"
                        onChange={(event) => setFullName(event.target.value)}
                        required
                        value={fullName}
                      />
                    </label>
                    <label>
                      E-mail
                      <input
                        autoComplete="email"
                        maxLength={254}
                        name="email"
                        onChange={(event) => setEmail(event.target.value)}
                        required
                        type="email"
                        value={email}
                      />
                    </label>
                    <button className="submit-redemption" type="submit" disabled={submittingRedemption}>
                      {submittingRedemption ? "Enviando…" : "Enviar dados para resgate"}
                    </button>
                    <small className="privacy-note">
                      Usaremos estes dados somente para validar e combinar a entrega do brinde.
                    </small>
                  </form>
                )}
                {redemptionSubmitted && (
                  <div className="success-note" role="status">
                    Dados enviados! A equipe da promoção entrará em contato pelo e-mail informado.
                  </div>
                )}
              </>
            ) : (
              <div className="loading-state empty-state" role="status">
                <span className="empty-icon" aria-hidden="true">✳</span>
                <strong>Esta raspadinha ainda não está disponível</strong>
                <span>{message || "Confira o link da campanha e tente novamente."}</span>
              </div>
            )}
            {message && campaign && <p className="error-message" role="alert">{message}</p>}
          </div>

          <aside className="prize-panel">
            <div className="prize-panel-heading">
              <div>
                <span className="section-kicker">MIMOS QUE PODEM SER SEUS</span>
                <h3>O que está em jogo</h3>
              </div>
              <span className="prize-asterisk" aria-hidden="true">✳</span>
            </div>
            {campaign?.prizes.length ? (
              <ul className="prize-list">
                {campaign.prizes.map((prize, index) => (
                  <li key={`${prize.title}-${index}`}>
                    <span className="prize-number">{String(index + 1).padStart(2, "0")}</span>
                    <span className="prize-copy">
                      <strong>{prize.title}</strong>
                      {prize.description && <small>{prize.description}</small>}
                    </span>
                    <span className="prize-arrow" aria-hidden="true">↗</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="prize-empty">
                Os brindes desta campanha serão anunciados em breve.
              </p>
            )}
            <div className="prize-footnote">
              <span aria-hidden="true">✦</span>
              Os brindes estão sujeitos às regras e disponibilidade da campanha.
            </div>
          </aside>
        </div>
      </section>

      <section className="how-section" id="como-funciona">
        <div className="how-intro">
          <span className="section-kicker">SEM COMPLICAÇÃO</span>
          <h2>Três passos.<br /><em>Uma surpresa.</em></h2>
        </div>
        <ol className="steps-list">
          <li><span className="step-index">01</span><div><strong>Entre na campanha</strong><p>Abra o link promocional e confira os brindes disponíveis.</p></div></li>
          <li><span className="step-index">02</span><div><strong>Faça sua jogada</strong><p>Toque em começar e raspe a cartela para revelar o resultado.</p></div></li>
          <li><span className="step-index">03</span><div><strong>Resgate seu brinde</strong><p>Se ganhar, informe seu nome e e-mail para validar a entrega.</p></div></li>
        </ol>
      </section>

      <footer className="site-footer">
        <Link className="brand footer-brand" href="/">
          <span className="brand-mark" aria-hidden="true">S</span>
          <span>Sorte de Casa</span>
        </Link>
        <p>Participação gratuita. Consulte as regras da promoção antes de jogar.</p>
        <Link href="/admin" className="admin-link">Acesso administrativo</Link>
      </footer>
    </main>
  );
}
