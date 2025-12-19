import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `Você é um treinador experiente em atletas master (50+), especializado em saúde, longevidade e progressão sustentável.

Seu papel é avaliar diariamente o progresso do treino, com base em dados fisiológicos, carga e percepção subjetiva.

Você NÃO deve prescrever treinos específicos, aumentar carga, sugerir intensidade ou substituir métricas objetivas.

Você DEVE:
- Interpretar HRV, sono, FC de repouso e carga (TSS, ATL, CTL, TSB)
- Avaliar risco de fadiga excessiva ou overreaching
- Comentar decisões acertadas ou sinais de alerta
- Sugerir ajustes gerais (ex.: manter, reduzir, priorizar recuperação)

Regras de segurança (obrigatórias):
- Se TSB < −15, sempre sinalizar alto risco
- Se HRV estiver em estado "Critical" por 2 ou mais dias consecutivos, nunca sugerir intensidade
- Se sono < 6 horas, priorizar recuperação

Formato da resposta:
- 1 parágrafo curto (3–5 linhas)
- Linguagem clara, objetiva e técnica
- Sem motivação genérica
- Sem termos vagos

Classifique o dia como: 🟢 Seguro, 🟡 Atenção, ou 🔴 Alto Risco

O objetivo é apoiar decisões conscientes, preservar saúde e permitir evolução consistente ao longo do tempo.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { analysisData, triggerResult } = await req.json();
    
    console.log('AI Coach request received:', { triggerResult });
    
    // If blocked, return default message
    if (triggerResult.classification === 'blocked') {
      console.log('Request blocked due to insufficient data');
      return new Response(JSON.stringify({ 
        analysis: 'Dados insuficientes para avaliação segura.',
        classification: 'blocked'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY is not configured');
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build the user prompt with the data
    const userPrompt = `Analise os seguintes dados do atleta:

**Dados de hoje:**
- HRV: ${analysisData.today.hrv} ms (Status: ${analysisData.today.hrvStatus})
- FC de repouso: ${analysisData.today.restingHr} bpm
- Sono: ${analysisData.today.sleepHours}h (Qualidade: ${analysisData.today.sleepQuality}/5)
${analysisData.today.bodyBattery ? `- Body Battery: ${analysisData.today.bodyBattery}/100` : ''}
${analysisData.today.mood ? `- Humor: ${analysisData.today.mood}/5` : ''}

**Carga de Treino:**
- ATL (Fadiga aguda 7d): ${analysisData.trainingLoad.atl}
- CTL (Fitness crônico 42d): ${analysisData.trainingLoad.ctl}
- TSB (Form): ${analysisData.trainingLoad.tsb}

**Tendências:**
- Baseline HRV 7d: ${analysisData.trends.hrvBaseline7d} ms
- HRV vs Baseline: ${analysisData.trends.hrvVsBaseline > 0 ? '+' : ''}${analysisData.trends.hrvVsBaseline.toFixed(1)}%
- Dias consecutivos com HRV Critical: ${analysisData.trends.consecutiveCriticalDays}
- Dias consecutivos com sono < 6h: ${analysisData.trends.consecutiveLowSleepDays}
- Tendência ATL 5d: ${analysisData.trends.atlTrend5d}

**Classificação prévia dos gatilhos:** ${triggerResult.classification.toUpperCase()}
${triggerResult.reasons.length > 0 ? `Motivos: ${triggerResult.reasons.join(', ')}` : ''}

**Treinos recentes (últimos 7 dias):**
${analysisData.recentWorkouts.length > 0 
  ? analysisData.recentWorkouts.map((w: any) => `- ${w.date}: ${w.type}, ${w.durationMin}min, RPE ${w.rpe}, TSS ${w.tssSubjective}`).join('\n')
  : '- Nenhum treino registrado'}

Forneça sua avaliação seguindo o formato especificado.`;

    console.log('Calling Lovable AI Gateway...');
    
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ 
          error: "Limite de requisições excedido. Tente novamente mais tarde." 
        }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ 
          error: "Créditos insuficientes. Adicione créditos na sua conta." 
        }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const analysis = data.choices?.[0]?.message?.content || 'Não foi possível gerar a análise.';
    
    console.log('AI analysis generated successfully');

    return new Response(JSON.stringify({ 
      analysis,
      classification: triggerResult.classification
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ai-coach function:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
