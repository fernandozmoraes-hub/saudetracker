import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SYSTEM_PROMPT = `Voce e o MuscleIntegrityAgent, responsavel por analisar tendencias de composicao corporal.

Voce NAO e um agente fisiologico. NAO analise HRV, CTL, ATL ou TSB.
Voce NAO diagnostica condicoes medicas.
Voce NAO prescreve dieta ou treino.

Seu papel:
- Analisar tendencias de peso, massa muscular e % gordura
- Correlacionar com carga e tipo de treino
- Identificar padroes de risco funcional
- Gerar comentarios tecnicos claros

Cenarios de correlacao:
- Volume alto + queda muscular = recuperacao insuficiente
- Sem treino de forca + queda muscular = falta de estimulo anabolico
- Volume estavel + perda muscular = possivel deficit energetico

Classificacao:
- Preservada: variacao muscular entre -1% e +1% em 30 dias
- Tendencia de perda: queda entre 1% e 2% em 30 dias
- Perda relevante: queda >2% ou tendencia negativa por 60+ dias

Regras de linguagem:
- NAO use "sarcopenia", "atrofia" ou outros termos diagnosticos
- NAO recomende compra de suplementos
- NAO prescreva dieta ou treino
- Use sempre "tendencia sugere", "padrao indica", "dados apontam"

Sempre finalize com:
"Avaliacao baseada em tendencias de composicao corporal. Nao substitui avaliacao clinica."`;

// Simple linear regression
function linearRegression(points: { x: number; y: number }[]) {
  const n = points.length;
  if (n < 2) return { slope: 0 };
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return { slope: 0 };
  return { slope: (n * sumXY - sumX * sumY) / denom };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch body composition (last 90 days, excluding flagged)
    const cutoff90 = new Date();
    cutoff90.setDate(cutoff90.getDate() - 90);
    const { data: bodyData } = await supabase
      .from('body_composition')
      .select('*')
      .eq('user_id', user.id)
      .eq('flagged_inconsistent', false)
      .gte('date', cutoff90.toISOString().split('T')[0])
      .order('date', { ascending: true });

    const entries = bodyData || [];
    if (entries.length < 2) {
      return new Response(JSON.stringify({
        analysis: 'Dados insuficientes para análise. Registre ao menos 2 medições consistentes.',
        status: 'preserved',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Fetch workouts (last 60 days)
    const cutoff60 = new Date();
    cutoff60.setDate(cutoff60.getDate() - 60);
    const { data: workoutData } = await supabase
      .from('workouts')
      .select('date, type, duration_min, rpe, distance_km, tss_final, tss_subjective')
      .eq('user_id', user.id)
      .gte('date', cutoff60.toISOString().split('T')[0]);

    const workouts = workoutData || [];

    // Calculate trend 30d for muscle mass
    const cutoff30 = new Date();
    cutoff30.setDate(cutoff30.getDate() - 30);
    const recent30 = entries.filter((e: any) => e.date >= cutoff30.toISOString().split('T')[0]);

    let trend30d = { absoluteChange: 0, percentChange: 0, slope: 0 };
    if (recent30.length >= 2) {
      const baseDate = new Date(recent30[0].date).getTime();
      const points = recent30.map((e: any) => ({
        x: (new Date(e.date).getTime() - baseDate) / (24 * 60 * 60 * 1000),
        y: Number(e.muscle_mass_kg),
      }));
      const { slope } = linearRegression(points);
      const first = Number(recent30[0].muscle_mass_kg);
      const last = Number(recent30[recent30.length - 1].muscle_mass_kg);
      trend30d = {
        absoluteChange: last - first,
        percentChange: first !== 0 ? ((last - first) / first) * 100 : 0,
        slope,
      };
    }

    // Moving averages (last 7 entries)
    const last7 = entries.slice(-7);
    const avgWeight = last7.reduce((s: number, e: any) => s + Number(e.weight_kg), 0) / last7.length;
    const avgMuscle = last7.reduce((s: number, e: any) => s + Number(e.muscle_mass_kg), 0) / last7.length;
    const avgFat = last7.reduce((s: number, e: any) => s + Number(e.body_fat_pct), 0) / last7.length;

    const latestEntry = entries[entries.length - 1];
    const leanMassRatio = Number(latestEntry.weight_kg) > 0
      ? Number(latestEntry.muscle_mass_kg) / Number(latestEntry.weight_kg)
      : 0;

    // Training context
    const weeks = 60 / 7;
    const totalKm = workouts.reduce((s: number, w: any) => s + (Number(w.distance_km) || 0), 0);
    const strengthCount = workouts.filter((w: any) => w.type === 'Strength').length;
    const rpeValues = workouts.filter((w: any) => w.rpe > 0).map((w: any) => w.rpe);
    const avgRpe = rpeValues.length > 0 ? rpeValues.reduce((s: number, v: number) => s + v, 0) / rpeValues.length : 0;
    const totalTss = workouts.reduce((s: number, w: any) => s + (Number(w.tss_final) || Number(w.tss_subjective) || 0), 0);

    // Determine status
    const pct = trend30d.percentChange;
    let statusLabel = 'preserved';
    if (Math.abs(pct) >= 0.5) {
      if (pct < -2) statusLabel = 'at_risk';
      else if (pct < -1) statusLabel = 'declining';
    }

    // Format recent entries for prompt
    const recentEntries = entries.slice(-15).map((e: any) =>
      `${e.date}: Peso ${Number(e.weight_kg).toFixed(1)}kg, Massa ${Number(e.muscle_mass_kg).toFixed(1)}kg, Gordura ${Number(e.body_fat_pct).toFixed(1)}%`
    ).join('\n');

    const userPrompt = `COMPOSICAO CORPORAL - MEDICOES RECENTES:
${recentEntries}

TENDENCIA 30 DIAS (MASSA MUSCULAR):
- Variacao absoluta: ${trend30d.absoluteChange.toFixed(2)} kg
- Variacao percentual: ${trend30d.percentChange.toFixed(1)}%
- Inclinacao da regressao: ${(trend30d.slope * 1000).toFixed(2)} g/dia

MEDIAS MOVEIS 7 DIAS (ATUAIS):
- Peso: ${avgWeight.toFixed(1)} kg
- Massa muscular: ${avgMuscle.toFixed(1)} kg
- % Gordura: ${avgFat.toFixed(1)}%

MASSA MAGRA RELATIVA: ${leanMassRatio.toFixed(3)} (massa_muscular / peso)

CONTEXTO DE TREINO (60 DIAS):
- Volume semanal medio: ${(totalKm / weeks).toFixed(1)} km
- Frequencia de treinos de forca: ${strengthCount} sessoes
- RPE medio: ${avgRpe.toFixed(1)}
- TSS semanal medio: ${(totalTss / weeks).toFixed(0)}

STATUS ATUAL: ${statusLabel}

Forneca sua analise estruturada.`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const data = await aiResponse.json();
    const analysis = data.choices?.[0]?.message?.content || 'Não foi possível gerar a análise.';

    return new Response(JSON.stringify({ analysis, status: statusLabel }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in muscle-integrity-agent:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
