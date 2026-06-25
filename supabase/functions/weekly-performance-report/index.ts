import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const RequestSchema = z.object({
  weeklyContext: z.record(z.string(), z.any()),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const SYSTEM_PROMPT = `# Agente: Relatório Semanal de Performance

Você é um analista técnico de performance esportiva. Recebe um WeeklyPerformanceContext
em JSON com 6 blocos (recovery, load, workouts, alcohol, bodyComposition, equipment) e
um mapa dataCoverage indicando quais blocos têm dados suficientes.

## Regras absolutas
- Use SOMENTE blocos com \`available: true\`.
- Para qualquer bloco com \`available: false\` (\`insufficient_data\` ou \`no_data\`),
  escreva literalmente "Dados insuficientes para análise." na seção correspondente.
- NUNCA invente números, slopes ou tendências.
- NÃO prescreva treinos, séries, zonas, volumes ou intensidades.
- NÃO faça diagnósticos médicos nem recomende dietas, suplementos ou medicamentos.
- NÃO emita julgamento sobre o consumo de álcool — apenas descreva impacto fisiológico observável.
- Campos \`null\` significam "sem registro" — ignore-os.

## Estrutura OBRIGATÓRIA da resposta (markdown, exatamente nesta ordem)

**📌 Resumo Executivo**
(máx. 5 linhas — como foi a semana)

**❤️ Recuperação**
(HRV, sono, FC repouso — citar números reais)

**🏃 Carga de Treino**
(CTL/ATL/TSB inicial→final, volume, TSS — explicar evolução)

**💪 Composição Corporal**
(peso, massa muscular, gordura — apenas se houver dados)

**🍷 Consumo de Álcool**
(frequência e impacto fisiológico — sem julgamento)

**👟 Equipamentos**
(tênis próximos do limite — alertas se houver)

**🔍 Principais Insights**
(3 a 5 insights cruzando blocos disponíveis)

**⚠️ Pontos de Atenção**
(somente se existirem; caso contrário OMITA esta seção inteira)

**🎯 Conclusão**
(síntese final, máx. 5 linhas)`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claims?.claims) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rawBody = await req.json();
    const parseResult = RequestSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return new Response(
        JSON.stringify({
          error: 'Dados de entrada inválidos',
          details: parseResult.error.flatten().fieldErrors,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { weeklyContext, periodStart, periodEnd } = parseResult.data;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'LOVABLE_API_KEY não configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const sectionsUsed = Object.entries(weeklyContext.dataCoverage ?? {})
      .filter(([, v]) => v === true)
      .map(([k]) => k);

    const userBlock = `## Período analisado
${periodStart} → ${periodEnd}

## Blocos com dados disponíveis
${sectionsUsed.join(', ') || '(nenhum)'}

## WeeklyPerformanceContext (JSON)
\`\`\`json
${JSON.stringify(weeklyContext, null, 2)}
\`\`\`

Gere o relatório semanal seguindo exatamente a estrutura obrigatória.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userBlock },
        ],
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
    const report = data.choices?.[0]?.message?.content;
    if (!report) {
      return new Response(
        JSON.stringify({ error: 'Resposta vazia do modelo' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ report, sectionsUsed, periodStart, periodEnd }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in weekly-performance-report:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
