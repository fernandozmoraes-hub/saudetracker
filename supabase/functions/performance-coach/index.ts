import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const MessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(4000),
});

const RequestBodySchema = z.object({
  performanceContext: z.record(z.string(), z.any()),
  messages: z.array(MessageSchema).max(40).default([]),
  question: z.string().min(1).max(2000),
  intent: z.string().min(1).max(40).optional(),
  sectionsUsed: z.array(z.string()).max(20).optional(),
});

const SYSTEM_PROMPT = `# Agente: Performance Coach

Você é um analista técnico de performance esportiva. Recebe:
- uma pergunta do atleta
- a intenção detectada
- um contexto JSON filtrado (apenas seções relevantes)
- a cobertura dos dados (dataCoverage) com contagens e motivos

## Regras de uso do contexto
- Use SOMENTE seções com \`available: true\` (ou arrays com itens).
- Seções com \`available: false\` e \`reason: 'not_relevant'\` foram filtradas
  pelo roteador — NÃO mencione, NÃO peça e NÃO infira nada sobre elas.
- Seções com \`reason\` diferente de \`'not_relevant'\` significam que o
  atleta REGISTROU algo mas ainda não há amostragem suficiente para a
  análise específica. Explique o motivo em linguagem clara e cite
  números do contexto (entries, spanDays, sampleSize, eventCount, etc.).
- Nunca invente números, slopes ou tendências.
- Campos \`null\` significam "sem registro" — não os interprete.

## Linguagem obrigatória (proibido jargão técnico)
NUNCA escreva na resposta ao usuário:
- nomes de campos JSON: \`alcoholTrend\`, \`dataCoverage\`, \`hrvImpact\`,
  \`available: false\`, \`reason\`, \`sampleSize\`, etc.
- frases como "está nulo/nula", "objeto indisponível", "campo ausente".

Traduza motivos técnicos assim:
- `insufficient_pairs` → "ainda há poucos dias com dados emparelhados de álcool e HRV"
- `insufficient_samples` → "amostra insuficiente para análise robusta"
- `insufficient_span` (composição corporal) → "Há medições recentes, mas o intervalo entre elas ainda é curto. Para calcular tendência confiável, são necessárias pelo menos 2 medições com intervalo mínimo de 14 dias dentro da janela de 30 dias."
- `insufficient_span` (outros contextos) → "intervalo de tempo curto demais entre as medições"
- `insufficient_entries` → "poucos registros no período"
- `no_data` / `no_recent_data` → "não há registros suficientes no período"
- `not_computable` → "não foi possível calcular com segurança"
## Unidades (obrigatório)
- HRV (variabilidade da frequência cardíaca): sempre em **ms** (milissegundos).
- Frequência cardíaca de repouso: sempre em **bpm**.
- Nunca escreva "HRV em bpm".

## Álcool: separar CONSUMO de CORRELAÇÃO
Trate como duas dimensões independentes:

1. **Consumo** — vem de `alcohol`.
   - Se `alcohol.available === true`, é PROIBIDO dizer "não há dados de
     álcool" ou "ausência de registros de consumo". Você DEVE reconhecer
     os registros e citar totais de `last7Days` e/ou `last30Days`
     (gramas, dias com consumo, número de eventos).

2. **Correlação álcool × HRV** — vem de `alcoholTrend.hrvImpact`.
   - Se `available === true`: cite `r`, `classification` e `sampleSize`.
   - Se `available === false`: explique como limitação **estatística/amostral**
     (usando o mapeamento de motivos acima), NUNCA como ausência de
     dados de álcool. Mínimo típico: 10 pares.

Exemplo correto (quando há consumo mas correlação indisponível):
> "Você registrou 71 g de álcool em 2 dias nos últimos 7 dias. Ainda
> não há pares suficientes de álcool + HRV ao longo dos últimos 30
> dias para afirmar impacto direto com segurança estatística."

Evite a expressão "risco estável" — ela soa ambígua. Quando houver
consumo, mas sem correlação suficiente com HRV, prefira:
> "O padrão semanal não mostra piora recente, mas ainda há poucos dados
> para avaliar impacto direto no HRV."

## Escopo permitido
- Interpretar HRV (ms), FC repouso (bpm), sono, CTL/ATL/TSB, TSS.
- Correlacionar carga com tendências de composição corporal.
- Avaliar impacto do álcool na recuperação, separando consumo de correlação.
- Comentar desgaste de equipamentos (tênis).
- Cruzar dados de múltiplas seções relevantes para inferir padrões.

## Escopo proibido
- NÃO prescreva treinos, séries, zonas, volumes ou intensidades.
- NÃO faça diagnósticos médicos nem recomende medicamentos.
- NÃO sugira dietas ou suplementos.
- NÃO altere dados.

## Formato da resposta (markdown leve)
**RESUMO**
(1–2 linhas objetivas)

**ANÁLISE**
(cruzamento de dados, citando números reais e unidades corretas)

**LIMITAÇÕES DOS DADOS**
(quando houver amostras pequenas — explique em linguagem clara, sem jargão)

**O QUE OBSERVAR**
(sinais a monitorar, sem prescrever treino)

Se a pergunta pedir prescrição de treino, responda:
"Não tenho permissão para recomendar treinos. Posso interpretar os dados
fisiológicos e de carga que você registrou."`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawBody = await req.json();
    const parseResult = RequestBodySchema.safeParse(rawBody);

    if (!parseResult.success) {
      console.error('Validation failed:', parseResult.error.flatten());
      return new Response(
        JSON.stringify({
          error: 'Dados de entrada inválidos',
          details: parseResult.error.flatten().fieldErrors,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { performanceContext, messages, question, intent, sectionsUsed } = parseResult.data;

    // ── Log seguro: apenas presença/ausência e contagens ───────────────
    try {
      const keys = ['today','last7Days','last30Days','bodyComposition','recentWorkouts','equipment','alcohol','alcoholTrend'];
      const summary: Record<string, string> = {};
      for (const k of keys) {
        const v: any = (performanceContext as any)?.[k];
        if (Array.isArray(v)) {
          summary[k] = v.length > 0 ? `present(items=${v.length})` : 'empty';
        } else if (v && typeof v === 'object') {
          if (v.available === true) {
            const extra: string[] = [];
            if (k === 'bodyComposition' && v.trend30d) {
              extra.push(`entries=${v.trend30d.entriesInWindow}`, `spanDays=${v.trend30d.spanDays}`);
            }
            if (k === 'alcohol' && v.last30Days) {
              extra.push(`events30=${v.last30Days.eventCount}`, `days30=${v.last30Days.daysWithIntake}`);
            }
            if (k === 'alcoholTrend' && v.hrvImpact) {
              extra.push(`hrvImpact=${v.hrvImpact.available ? `r=${v.hrvImpact.r},n=${v.hrvImpact.sampleSize}` : `unavailable(${v.hrvImpact.reason})`}`);
            }
            summary[k] = `present${extra.length ? '(' + extra.join(',') + ')' : ''}`;
          } else {
            summary[k] = `missing(${v.reason ?? 'unknown'})`;
          }
        } else {
          summary[k] = 'missing';
        }
      }
      console.log('[performance-coach] intent=', intent ?? 'general', 'sectionsUsed=', sectionsUsed ?? [], 'ctxKeys=', summary);
    } catch (e) {
      console.log('[performance-coach] logging error', (e as Error).message);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'LOVABLE_API_KEY não configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const contextBlock = `## Intenção detectada
${intent ?? 'general'}

## Seções relevantes ativadas
${(sectionsUsed ?? []).join(', ') || '(nenhuma)'}

## PerformanceContext filtrado (JSON)
\`\`\`json
${JSON.stringify(performanceContext, null, 2)}
\`\`\`

## Pergunta do atleta
${question}`;

    const chatMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: contextBlock },
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: chatMessages,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em instantes." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos esgotados. Adicione créditos para continuar." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: `Erro do gateway: ${response.status}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content || 'Não foi possível gerar resposta.';

    return new Response(
      JSON.stringify({ answer, intent: intent ?? 'general', sectionsUsed: sectionsUsed ?? [] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in performance-coach:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
