import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `Você é o WorkoutEvaluatorAgent, responsável exclusivamente por analisar treinos já realizados.
Não interfira na análise fisiológica diária, que é feita por outro agente.
Seu único papel é avaliar treinos concluídos com base nos dados fornecidos pelo usuário.

Você tem acesso ao histórico de treinos do atleta e deve:
- Comparar o treino atual com a média histórica do mesmo tipo
- Identificar se métricas estão acima ou abaixo do padrão pessoal
- Correlacionar com o estado fisiológico do dia (HRV, sono) quando disponível
- Notar tendências de progressão ou regressão

Ao avaliar treinos de corrida, considere o estado do equipamento (tênis) quando informado:
- Se o desgaste estiver acima de 85%, mencione que a absorção de impacto pode estar comprometida
- Se o desgaste estiver acima de 100%, alerte sobre o risco aumentado de lesões
- Nunca recomende compra de equipamentos
- Apenas comente sobre o impacto potencial no desempenho e recuperação

Diretrizes operacionais:

Avalie apenas treinos já executados.

Não crie planos de treino, não prescreva workouts futuros e não recomende cargas ou volumes.

A análise deve ser baseada nas métricas informadas e no contexto histórico:
- tipo de treino (força, endurance)
- duração (comparar com média histórica)
- intensidade (comparar com padrão pessoal)
- frequência cardíaca (média, máxima e zonas, se existirem)
- percepção subjetiva de esforço (RPE) (comparar com média)
- observações do treino (fadiga, dores, falhas, etc.)
- estado fisiológico do dia (HRV, sono, humor)
- estado do equipamento (tênis) quando for corrida

A saída deve ser estruturada em quatro blocos obrigatórios:

(A) Resumo Técnico do Treino
- descreva o que foi feito
- destaque métricas relevantes
- compare com histórico quando disponível
- não invente dados ausentes

(B) Eficiência e Qualidade
- avalie execução, consistência, intensidade
- destaque pontos fortes
- compare com padrão histórico do atleta
- indique sinais de possível excesso
- nunca prescreva ajustes futuros

(C) Riscos e Red Flags
- identifique sinais de fadiga excessiva
- correlacione com estado fisiológico (HRV baixo, sono ruim)
- identifique combinações não usuais de intensidade/duração
- comente sobre estado do equipamento se relevante
- mencione possíveis impactos fisiológicos, mas sem diagnóstico

(D) Sugestões Gerais Não-Prescritivas
- apenas recomendações genéricas de boas práticas
- sem sugerir treinos futuros
- sem indicar cargas, séries, intervalos ou intensidades específicas
Exemplos aceitáveis:
"considere registrar sua hidratação no próximo treino"
"observe se a fadiga persistir nas próximas sessões"
"monitore como suas pernas reagem após treinos longos"

O agente pode responder perguntas adicionais do usuário sobre o treino analisado, desde que sempre dentro dos limites acima:
- explicar métricas
- interpretar indicadores
- comparar com histórico
- ajudar o usuário a entender seu próprio registro de dados
- sem orientar programação de treino

Tom de resposta:
- técnico e objetivo
- sem emojis
- sem linguagem motivacional
- sem recomendações médicas`;

interface WorkoutData {
  type: string;
  date: string;
  duration_min: number;
  rpe: number;
  avg_hr?: number;
  max_hr?: number;
  distance_km?: number;
  tss_final?: number;
  time_z1_min?: number;
  time_z2_min?: number;
  time_z3_min?: number;
  time_z4_min?: number;
  time_z5_min?: number;
  session_type?: string;
  feeling_after?: string;
  pain_discomfort?: string;
  observations?: string;
  equipment_id?: string;
}

interface EvaluationRequest {
  type: 'evaluate' | 'followup';
  workout?: WorkoutData;
  question?: string;
  previousAnalysis?: {
    summaryTechnical: string;
    efficiencyQuality: string;
    risksRedflags: string;
    generalSuggestions: string;
  };
}

interface HistoricalWorkout {
  date: string;
  duration_min: number;
  rpe: number;
  tss_final: number | null;
  avg_hr: number | null;
  distance_km: number | null;
  time_z1_min: number | null;
  time_z2_min: number | null;
  time_z3_min: number | null;
  time_z4_min: number | null;
  time_z5_min: number | null;
}

interface DailyCheckData {
  hrv: number;
  resting_hr: number;
  sleep_hours: number;
  sleep_quality: number;
  mood: number | null;
  body_battery: number | null;
}

interface UserSettingsData {
  lthr: number | null;
  resting_hr: number | null;
  max_hr: number | null;
}

interface EquipmentContext {
  name: string;
  brand: string | null;
  totalKm: number;
  maxKm: number;
  wearPercentage: number;
  status: string;
  daysInUse: number;
}

interface HistoricalContext {
  recentWorkouts: HistoricalWorkout[] | null;
  dailyCheck: DailyCheckData | null;
  settings: UserSettingsData | null;
  stats: WorkoutStats | null;
  equipment: EquipmentContext | null;
}

interface WorkoutStats {
  avgDuration: number;
  avgRpe: number;
  avgTss: number | null;
  avgHr: number | null;
  maxDuration: number;
  totalWorkouts: number;
  avgDistanceKm: number | null;
}

function average(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function calculateDaysInUse(startDate: string): number {
  const start = new Date(startDate);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - start.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

async function fetchEquipmentContext(
  supabase: SupabaseClient,
  userId: string,
  equipmentId: string
): Promise<EquipmentContext | null> {
  const { data } = await supabase
    .from('equipment')
    .select('name, brand, total_km, max_km, status, start_date')
    .eq('id', equipmentId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!data) return null;

  const wearPercentage = Number(data.max_km) > 0 ? (Number(data.total_km) / Number(data.max_km)) * 100 : 0;
  return {
    name: data.name,
    brand: data.brand,
    totalKm: Number(data.total_km),
    maxKm: Number(data.max_km),
    wearPercentage,
    status: data.status,
    daysInUse: calculateDaysInUse(data.start_date),
  };
}

async function fetchHistoricalContext(
  supabase: SupabaseClient,
  userId: string,
  workoutType: string,
  workoutDate: string,
  equipmentId?: string
): Promise<HistoricalContext> {
  // Fetch last 15 workouts of the same type (excluding current)
  const { data: recentWorkouts } = await supabase
    .from('workouts')
    .select('date, duration_min, rpe, tss_final, avg_hr, distance_km, time_z1_min, time_z2_min, time_z3_min, time_z4_min, time_z5_min')
    .eq('user_id', userId)
    .eq('type', workoutType)
    .neq('date', workoutDate)
    .order('date', { ascending: false })
    .limit(15);

  // Fetch daily check for the workout day
  const { data: dailyCheck } = await supabase
    .from('daily_checks')
    .select('hrv, resting_hr, sleep_hours, sleep_quality, mood, body_battery')
    .eq('user_id', userId)
    .eq('date', workoutDate)
    .maybeSingle();

  // Fetch user settings
  const { data: settings } = await supabase
    .from('user_settings')
    .select('lthr, resting_hr, max_hr')
    .eq('user_id', userId)
    .maybeSingle();

  // Calculate statistics
  let stats: WorkoutStats | null = null;
  if (recentWorkouts && recentWorkouts.length > 0) {
    const durations = recentWorkouts.map(w => Number(w.duration_min));
    const rpes = recentWorkouts.map(w => w.rpe);
    const tssValues = recentWorkouts.map(w => w.tss_final).filter((t): t is number => t !== null);
    const hrValues = recentWorkouts.map(w => w.avg_hr).filter((h): h is number => h !== null);
    const distances = recentWorkouts.map(w => w.distance_km).filter((d): d is number => d !== null);

    stats = {
      avgDuration: average(durations),
      avgRpe: average(rpes),
      avgTss: tssValues.length > 0 ? average(tssValues) : null,
      avgHr: hrValues.length > 0 ? average(hrValues) : null,
      maxDuration: Math.max(...durations),
      totalWorkouts: recentWorkouts.length,
      avgDistanceKm: distances.length > 0 ? average(distances) : null,
    };
  }

  // Fetch equipment context if equipmentId is provided
  let equipmentContext: EquipmentContext | null = null;
  if (equipmentId) {
    equipmentContext = await fetchEquipmentContext(supabase, userId, equipmentId);
  }

  return {
    recentWorkouts: recentWorkouts as HistoricalWorkout[] | null,
    dailyCheck: dailyCheck as DailyCheckData | null,
    settings: settings as UserSettingsData | null,
    stats,
    equipment: equipmentContext,
  };
}

function buildWorkoutPrompt(workout: WorkoutData, context?: HistoricalContext): string {
  const lines: string[] = [];
  
  lines.push(`DADOS DO TREINO REALIZADO:`);
  lines.push(`- Tipo: ${workout.type}`);
  lines.push(`- Data: ${workout.date}`);
  lines.push(`- Duração: ${workout.duration_min} minutos`);
  lines.push(`- RPE (percepção de esforço): ${workout.rpe}/10`);
  
  if (workout.session_type) {
    lines.push(`- Tipo de sessão: ${workout.session_type}`);
  }
  
  if (workout.distance_km) {
    lines.push(`- Distância: ${workout.distance_km.toFixed(2)} km`);
  }
  
  if (workout.avg_hr) {
    lines.push(`- FC média: ${workout.avg_hr} bpm`);
  }
  
  if (workout.max_hr) {
    lines.push(`- FC máxima: ${workout.max_hr} bpm`);
  }
  
  if (workout.tss_final) {
    lines.push(`- TSS (Training Stress Score): ${workout.tss_final.toFixed(0)}`);
  }
  
  // Zone distribution
  const hasZones = workout.time_z1_min || workout.time_z2_min || workout.time_z3_min || workout.time_z4_min || workout.time_z5_min;
  if (hasZones) {
    lines.push(`\nDISTRIBUIÇÃO POR ZONAS DE FC:`);
    if (workout.time_z1_min) lines.push(`- Z1: ${workout.time_z1_min.toFixed(0)} min`);
    if (workout.time_z2_min) lines.push(`- Z2: ${workout.time_z2_min.toFixed(0)} min`);
    if (workout.time_z3_min) lines.push(`- Z3: ${workout.time_z3_min.toFixed(0)} min`);
    if (workout.time_z4_min) lines.push(`- Z4: ${workout.time_z4_min.toFixed(0)} min`);
    if (workout.time_z5_min) lines.push(`- Z5: ${workout.time_z5_min.toFixed(0)} min`);
  }
  
  lines.push(`\nOBSERVAÇÕES DO ATLETA:`);
  
  if (workout.feeling_after) {
    lines.push(`- Sensação após o treino: ${workout.feeling_after}`);
  } else {
    lines.push(`- Sensação após o treino: não informada`);
  }
  
  if (workout.pain_discomfort) {
    lines.push(`- Dores ou desconfortos: ${workout.pain_discomfort}`);
  } else {
    lines.push(`- Dores ou desconfortos: nenhum relatado`);
  }
  
  if (workout.observations) {
    lines.push(`- Observações adicionais: ${workout.observations}`);
  }

  // Add historical context if available
  if (context) {
    // Physiological state on workout day
    if (context.dailyCheck) {
      lines.push(`\nESTADO FISIOLÓGICO NO DIA DO TREINO:`);
      lines.push(`- HRV: ${context.dailyCheck.hrv} ms`);
      lines.push(`- FC de repouso: ${context.dailyCheck.resting_hr} bpm`);
      lines.push(`- Sono: ${context.dailyCheck.sleep_hours.toFixed(1)}h (qualidade: ${context.dailyCheck.sleep_quality}/5)`);
      if (context.dailyCheck.mood) {
        lines.push(`- Humor: ${context.dailyCheck.mood}/5`);
      }
      if (context.dailyCheck.body_battery) {
        lines.push(`- Body Battery: ${context.dailyCheck.body_battery}/100`);
      }
    }

    // Historical comparison
    if (context.stats && context.stats.totalWorkouts > 0) {
      lines.push(`\nCONTEXTO HISTÓRICO (últimos ${context.stats.totalWorkouts} treinos de ${workout.type}):`);
      
      // Duration comparison
      const durationDiff = ((workout.duration_min - context.stats.avgDuration) / context.stats.avgDuration * 100).toFixed(0);
      const durationSign = Number(durationDiff) >= 0 ? '+' : '';
      lines.push(`- Duração média: ${context.stats.avgDuration.toFixed(0)} min (este treino: ${workout.duration_min} min, ${durationSign}${durationDiff}%)`);
      lines.push(`- Duração máxima registrada: ${context.stats.maxDuration.toFixed(0)} min`);
      
      // RPE comparison
      const rpeDiff = (workout.rpe - context.stats.avgRpe).toFixed(1);
      const rpeSign = Number(rpeDiff) >= 0 ? '+' : '';
      lines.push(`- RPE médio: ${context.stats.avgRpe.toFixed(1)} (este treino: ${workout.rpe}, ${rpeSign}${rpeDiff})`);
      
      // TSS comparison if available
      if (context.stats.avgTss && workout.tss_final) {
        const tssDiff = ((workout.tss_final - context.stats.avgTss) / context.stats.avgTss * 100).toFixed(0);
        const tssSign = Number(tssDiff) >= 0 ? '+' : '';
        lines.push(`- TSS médio: ${context.stats.avgTss.toFixed(0)} (este treino: ${workout.tss_final.toFixed(0)}, ${tssSign}${tssDiff}%)`);
      }
      
      // HR comparison if available
      if (context.stats.avgHr && workout.avg_hr) {
        const hrDiff = workout.avg_hr - context.stats.avgHr;
        const hrSign = hrDiff >= 0 ? '+' : '';
        lines.push(`- FC média histórica: ${context.stats.avgHr.toFixed(0)} bpm (este treino: ${workout.avg_hr} bpm, ${hrSign}${hrDiff.toFixed(0)})`);
      }

      // Distance comparison if available
      if (context.stats.avgDistanceKm && workout.distance_km) {
        const distDiff = ((workout.distance_km - context.stats.avgDistanceKm) / context.stats.avgDistanceKm * 100).toFixed(0);
        const distSign = Number(distDiff) >= 0 ? '+' : '';
        lines.push(`- Distância média: ${context.stats.avgDistanceKm.toFixed(2)} km (este treino: ${workout.distance_km.toFixed(2)} km, ${distSign}${distDiff}%)`);
      }
    }

    // User settings for reference
    if (context.settings) {
      lines.push(`\nCONFIGURAÇÕES DO ATLETA:`);
      if (context.settings.lthr) {
        lines.push(`- LTHR configurado: ${context.settings.lthr} bpm`);
      }
      if (context.settings.max_hr) {
        lines.push(`- FC máxima configurada: ${context.settings.max_hr} bpm`);
      }
    }

    // Equipment context
    if (context.equipment) {
      lines.push(`\nEQUIPAMENTO UTILIZADO:`);
      lines.push(`- Tênis: ${context.equipment.name}${context.equipment.brand ? ` (${context.equipment.brand})` : ''}`);
      lines.push(`- Km acumulados: ${context.equipment.totalKm.toFixed(0)} / ${context.equipment.maxKm} km (${context.equipment.wearPercentage.toFixed(0)}% de uso)`);
      lines.push(`- Status: ${context.equipment.status}`);
      lines.push(`- Dias de uso: ${context.equipment.daysInUse}`);
      
      if (context.equipment.wearPercentage >= 100) {
        lines.push(`- ⚠️ ALERTA: Tênis acima do limite recomendado de quilometragem!`);
      } else if (context.equipment.wearPercentage >= 85) {
        lines.push(`- ⚠️ ATENÇÃO: Tênis com mais de 85% da vida útil`);
      }
    }
  }
  
  lines.push(`\nCom base nos dados acima e no contexto histórico, forneça sua análise estruturada nos 4 blocos obrigatórios (A, B, C, D).`);
  
  return lines.join('\n');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'User not authenticated' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const requestData: EvaluationRequest = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let userPrompt: string;
    let tools: any[] | undefined;
    let toolChoice: any | undefined;

    if (requestData.type === 'evaluate') {
      if (!requestData.workout) {
        return new Response(
          JSON.stringify({ error: 'Workout data required for evaluation' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch historical context from database
      console.log(`Fetching historical context for user ${user.id}, workout type: ${requestData.workout.type}, equipment: ${requestData.workout.equipment_id || 'none'}`);
      const historicalContext = await fetchHistoricalContext(
        supabaseClient,
        user.id,
        requestData.workout.type,
        requestData.workout.date,
        requestData.workout.equipment_id
      );
      console.log(`Found ${historicalContext.stats?.totalWorkouts || 0} historical workouts, daily check: ${historicalContext.dailyCheck ? 'yes' : 'no'}, equipment: ${historicalContext.equipment ? historicalContext.equipment.name : 'none'}`);
      
      userPrompt = buildWorkoutPrompt(requestData.workout, historicalContext);
      
      // Use tool calling to get structured output
      tools = [
        {
          type: "function",
          function: {
            name: "workout_evaluation",
            description: "Retorna a avaliação estruturada do treino nos 4 blocos obrigatórios, incluindo comparações com o histórico",
            parameters: {
              type: "object",
              properties: {
                summaryTechnical: {
                  type: "string",
                  description: "(A) Resumo Técnico do Treino - descrição objetiva do que foi feito, métricas relevantes, comparação com histórico"
                },
                efficiencyQuality: {
                  type: "string",
                  description: "(B) Eficiência e Qualidade - avaliação da execução, consistência, intensidade, pontos fortes, comparação com padrão pessoal"
                },
                risksRedflags: {
                  type: "string",
                  description: "(C) Riscos e Red Flags - sinais de fadiga excessiva, correlação com estado fisiológico (HRV, sono), combinações não usuais"
                },
                generalSuggestions: {
                  type: "string",
                  description: "(D) Sugestões Gerais Não-Prescritivas - recomendações genéricas de boas práticas"
                }
              },
              required: ["summaryTechnical", "efficiencyQuality", "risksRedflags", "generalSuggestions"],
              additionalProperties: false
            }
          }
        }
      ];
      toolChoice = { type: "function", function: { name: "workout_evaluation" } };
      
    } else if (requestData.type === 'followup') {
      if (!requestData.question || !requestData.previousAnalysis) {
        return new Response(
          JSON.stringify({ error: 'Question and previous analysis required for follow-up' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      userPrompt = `ANÁLISE ANTERIOR DO TREINO:

(A) Resumo Técnico:
${requestData.previousAnalysis.summaryTechnical}

(B) Eficiência e Qualidade:
${requestData.previousAnalysis.efficiencyQuality}

(C) Riscos e Red Flags:
${requestData.previousAnalysis.risksRedflags}

(D) Sugestões Gerais:
${requestData.previousAnalysis.generalSuggestions}

---

PERGUNTA DO ATLETA:
${requestData.question}

Responda a pergunta de forma técnica e objetiva, sem emojis, sem linguagem motivacional, e sem recomendar treinos ou cargas.`;
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid request type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${requestData.type} request for user ${user.id}`);

    const requestBody: any = {
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt }
      ]
    };

    if (tools) {
      requestBody.tools = tools;
      requestBody.tool_choice = toolChoice;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add funds to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "AI service error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    console.log("AI response received");

    if (requestData.type === 'evaluate') {
      // Extract structured response from tool call
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        const evaluation = JSON.parse(toolCall.function.arguments);
        return new Response(
          JSON.stringify({
            type: 'evaluation',
            ...evaluation
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        // Fallback if tool calling didn't work
        const content = data.choices?.[0]?.message?.content || '';
        return new Response(
          JSON.stringify({
            type: 'evaluation',
            summaryTechnical: content,
            efficiencyQuality: '',
            risksRedflags: '',
            generalSuggestions: ''
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // Follow-up question response
      const answer = data.choices?.[0]?.message?.content || '';
      return new Response(
        JSON.stringify({
          type: 'followup',
          answer
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Error in workout-evaluator:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
