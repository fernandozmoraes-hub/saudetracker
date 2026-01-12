import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `Você é o WorkoutEvaluatorAgent, responsável exclusivamente por analisar treinos já realizados.
Não interfira na análise fisiológica diária, que é feita por outro agente.
Seu único papel é avaliar treinos concluídos com base nos dados fornecidos pelo usuário.

Diretrizes operacionais:

Avalie apenas treinos já executados.

Não crie planos de treino, não prescreva workouts futuros e não recomende cargas ou volumes.

A análise deve ser baseada somente nas métricas informadas:
- tipo de treino (força, endurance)
- duração
- intensidade
- frequência cardíaca (média, máxima e zonas, se existirem)
- percepção subjetiva de esforço (RPE)
- observações do treino (fadiga, dores, falhas, etc.)

A saída deve ser estruturada em quatro blocos obrigatórios:

(A) Resumo Técnico do Treino
- descreva o que foi feito
- destaque métricas relevantes
- não invente dados ausentes

(B) Eficiência e Qualidade
- avalie execução, consistência, intensidade
- destaque pontos fortes
- indique sinais de possível excesso
- nunca prescreva ajustes futuros

(C) Riscos e Red Flags
- identifique sinais de fadiga excessiva
- identifique combinações não usuais de intensidade/duração
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

function buildWorkoutPrompt(workout: WorkoutData): string {
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
  
  lines.push(`\nCom base nos dados acima, forneça sua análise estruturada nos 4 blocos obrigatórios (A, B, C, D).`);
  
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
      
      userPrompt = buildWorkoutPrompt(requestData.workout);
      
      // Use tool calling to get structured output
      tools = [
        {
          type: "function",
          function: {
            name: "workout_evaluation",
            description: "Retorna a avaliação estruturada do treino nos 4 blocos obrigatórios",
            parameters: {
              type: "object",
              properties: {
                summaryTechnical: {
                  type: "string",
                  description: "(A) Resumo Técnico do Treino - descrição objetiva do que foi feito, métricas relevantes"
                },
                efficiencyQuality: {
                  type: "string",
                  description: "(B) Eficiência e Qualidade - avaliação da execução, consistência, intensidade, pontos fortes"
                },
                risksRedflags: {
                  type: "string",
                  description: "(C) Riscos e Red Flags - sinais de fadiga excessiva, combinações não usuais, possíveis impactos"
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
