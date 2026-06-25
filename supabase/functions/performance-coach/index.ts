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
- a cobertura dos dados (dataCoverage)

## Regras de uso do contexto
- Use SOMENTE seções com \`available: true\`.
- Seções com \`available: false\` e \`reason: 'not_relevant'\` foram filtradas
  pelo roteador — NÃO mencione, NÃO peça e NÃO infira nada sobre elas.
- Seções com \`reason: 'insufficient_data'\` ou \`'no_data'\` significam que
  o atleta ainda não tem amostragem suficiente: declare explicitamente
  "Dados insuficientes para concluir essa análise" no que depender delas.
- Nunca invente números, slopes ou tendências.
- Campos \`null\` significam "sem registro" — não os interprete.

## Escopo permitido
- Interpretar HRV, FC repouso, sono, CTL/ATL/TSB, TSS.
- Correlacionar carga com tendências de composição corporal.
- Avaliar impacto do álcool na recuperação (HRV/FC).
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
(cruzamento de dados, citando números reais do contexto)

**LIMITAÇÕES DOS DADOS**
(quando houver seções indisponíveis ou amostras pequenas)

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
