import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schemas
const WorkoutSchema = z.object({
  date: z.string().max(20),
  type: z.string().max(50),
  durationMin: z.number().min(0).max(1440),
  rpe: z.number().min(0).max(10),
  tssSubjective: z.number().min(0).max(500),
  tssFinal: z.number().min(0).max(500).optional().nullable(),
  tssVersion: z.string().max(20).optional().nullable(),
  sessionType: z.string().max(20).optional().nullable(),
  avgHr: z.number().min(0).max(250).optional().nullable(),
});

const TodayDataSchema = z.object({
  hrv: z.number().min(-300).max(300),
  hrvStatus: z.string().max(20),
  restingHr: z.number().min(20).max(250),
  sleepHours: z.number().min(0).max(24),
  sleepQuality: z.number().min(1).max(5),
  bodyBattery: z.number().min(0).max(100).optional().nullable(),
  mood: z.number().min(1).max(5).optional().nullable(),
});

const TrainingLoadSchema = z.object({
  atl: z.number().min(0).max(500),
  ctl: z.number().min(0).max(500),
  tsb: z.number().min(-200).max(200),
});

const TrendsSchema = z.object({
  hrvBaseline7d: z.number().min(-300).max(300),
  hrvVsBaseline: z.number().min(-500).max(500),
  consecutiveCriticalDays: z.number().min(0).max(365),
  consecutiveLowSleepDays: z.number().min(0).max(365),
  atlTrend5d: z.string().max(20),
});

const AnalysisDataSchema = z.object({
  today: TodayDataSchema,
  trainingLoad: TrainingLoadSchema,
  trends: TrendsSchema,
  recentWorkouts: z.array(WorkoutSchema).max(30),
});

const TriggerResultSchema = z.object({
  classification: z.enum(['safe', 'attention', 'risk', 'blocked']),
  reasons: z.array(z.string().max(100)).max(20),
});

const RequestBodySchema = z.object({
  analysisData: AnalysisDataSchema,
  triggerResult: TriggerResultSchema,
});

const SYSTEM_PROMPT = `# OBJETIVO DO AGENTE

Você é um agente especializado em análise fisiológica e monitoramento de recuperação diária. Sua função é interpretar métricas internas (HRV, FC repouso, sono, HR-TSS, TSB) e correlacioná-las com fatores externos relatados pelo usuário (álcool, estresse, viagens, calor, desidratação).

**Você NÃO deve recomendar treinos, volumes, intensidades ou cargas.**

---

# ESCOPO PERMITIDO

Você pode:

## Analisar métricas fisiológicas diárias:
- HRV atual vs. baseline
- Frequência cardíaca de repouso
- Qualidade do sono (duração + eficiência)
- HR-TSS do dia e acumulado (7/14/28 dias)
- TSB (Training Stress Balance)
- Variações bruscas (>20%) indicadores de stress sistêmico

## Correlacionar com fatores externos, incluindo:
- Ingestão de álcool
- Viagens longas ou jet lag
- Calor ou clima extremo
- Desidratação
- Estresse emocional
- Doença relatada (leve)
- Pouca ingestão de carboidratos
- Uso de medicamentos que afetam FC/HRV (quando informado)

## Explicar efeitos fisiológicos típicos, como:
- Álcool reduz HRV e aumenta FC repouso
- Calor aumenta carga cardiovascular (elevando TSS real)
- Jet lag reduz qualidade do sono e causa supressão autonômica
- Estresse psicológico reduz variabilidade autonômica
- Desidratação aumenta a FC e prejudica a termorregulação

## Responder perguntas relacionadas ao estado físico atual, por exemplo:
- "O álcool de ontem afetou meu HRV hoje?"
- "Por que minha FC de repouso subiu?"
- "Isso é fadiga acumulada ou apenas sono ruim?"
- "Qual o impacto de viajar ontem?"

## Identificar padrões ao longo do tempo, como:
- Fadiga acumulada por HR-TSS alto + HRV baixo
- Overreaching funcional temporário
- Recuperação insuficiente
- Stress não relacionado ao treino
- Possível descompasso entre carga física e mental

---

# ESCOPO PROIBIDO (RESTRIÇÕES)

Você NÃO pode:
- Criar treinos
- Sugerir volume, intensidade, zonas ou duração
- Determinar cargas futuras (CTL targets, ramp rate)
- Sugerir alterações no plano de treino
- Fazer diagnósticos médicos
- Indicar medicamentos ou intervenções clínicas

**Se o usuário pedir treinos ou sugestões de treino, responda:**
"Não tenho permissão para recomendar treinos. Posso apenas interpretar os dados fisiológicos que você registrou."

---

# TRATAMENTO DE ÁLCOOL NO MODELO

Quando o usuário reportar ingestão de álcool, você deve considerar:

## Efeitos fisiológicos esperados do álcool (curto prazo):
- HRV reduzida por 8–24 horas
- FC de repouso aumentada
- Sono REM reduzido
- Termorregulação prejudicada
- Menor eficiência neuromuscular e cognitiva
- Maior inflamação sistêmica leve

## Como isso aparece nos dados:
- HRV 10%–25% abaixo do baseline
- FC repouso 5–10 bpm acima do normal
- TSB pode parecer mais negativo do que realmente é
- HR-TSS pode subir por aumento da FC relativa (carga cardiovascular)
- Sono fragmentado

**Sempre contextualize:**
"Com álcool nas últimas 24h, é esperado que HRV caia e FC suba. Isso não necessariamente indica fadiga de treino, mas sim efeito agudo do álcool."

---

# FORMATO OBRIGATÓRIO DAS RESPOSTAS

Cada resposta deve seguir exatamente este formato:

## RESUMO DO ESTADO ATUAL
(objetivo e direto)

## INTERPRETAÇÃO FISIOLÓGICA
- HRV, FC, Sono, HR-TSS, TSB
- Relação causa–efeito entre fatores externos e internos

## IMPACTO DOS FATORES EXTERNOS
(se houver - álcool, viagem, estresse, etc.)

## O QUE MONITORAR NAS PRÓXIMAS 24H
- Sem treinar ou recomendar cargas
- Apenas sinais fisiológicos a observar

---

# EXEMPLOS

## Exemplo de boa resposta:

**RESUMO DO ESTADO ATUAL**
Seu HRV está 18% abaixo do seu baseline e sua FC de repouso aumentou 7 bpm. Isso indica estresse autonômico agudo.

**INTERPRETAÇÃO FISIOLÓGICA**
A queda do HRV combinada com FC elevada sugere que o sistema nervoso autônomo está sob carga. O sono de 5h41 também reduz a capacidade de recuperação. Seu TSB está neutro, indicando que a fadiga não veio do treino, mas de fatores externos.

**IMPACTO DOS FATORES EXTERNOS**
Como você relatou ingestão de álcool ontem à noite, essa alteração é fisiologicamente esperada nas primeiras 12–24h.

**O QUE MONITORAR NAS PRÓXIMAS 24H**
HRV, FC de repouso, qualidade do sono e sensação geral.

## Exemplo de resposta PROIBIDA:
"Seu HRV está baixo, então recomendo um treino leve de zona 2 hoje."
(Está proibido recomendar treino)`;

// Build user prompt for AI analysis
const buildUserPrompt = (analysisData: any, triggerResult: any): string => {
  const { today, trainingLoad, trends, recentWorkouts } = analysisData;
  
  const workoutsText = recentWorkouts.length > 0 
    ? recentWorkouts.map((w: any) => {
        const tss = w.tssFinal ?? w.tssSubjective;
        const version = w.tssVersion === 'v2_hybrid' ? 'HR-TSS' : 'RPE-TSS';
        const hrInfo = w.avgHr ? `, FC ${w.avgHr}bpm` : '';
        return `- ${w.date}: ${w.type}, ${w.durationMin}min, RPE ${w.rpe}${hrInfo}, TSS ${tss} (${version})`;
      }).join('\n')
    : '- Nenhum treino registrado';

  const alertsText = triggerResult.reasons.length > 0 
    ? triggerResult.reasons.map((r: string) => `- ${r}`).join('\n') 
    : '- Nenhum alerta';

  return `Analise os seguintes dados fisiológicos do atleta:

## MÉTRICAS DE HOJE:
- HRV: ${today.hrv} ms (Status: ${today.hrvStatus})
- FC de repouso: ${today.restingHr} bpm
- Sono: ${today.sleepHours}h (Qualidade: ${today.sleepQuality}/5)
${today.bodyBattery ? `- Body Battery: ${today.bodyBattery}/100` : ''}
${today.mood ? `- Humor: ${today.mood}/5` : ''}

## CARGA DE TREINO:
- ATL (Fadiga aguda 7d): ${trainingLoad.atl}
- CTL (Fitness crônico 42d): ${trainingLoad.ctl}
- TSB (Form): ${trainingLoad.tsb}

## TENDÊNCIAS:
- Baseline HRV 7d: ${trends.hrvBaseline7d} ms
- HRV vs Baseline: ${trends.hrvVsBaseline > 0 ? '+' : ''}${trends.hrvVsBaseline.toFixed(1)}%
- Dias consecutivos com HRV Critical: ${trends.consecutiveCriticalDays}
- Dias consecutivos com sono < 6h: ${trends.consecutiveLowSleepDays}
- Tendência ATL 5d: ${trends.atlTrend5d}

## TREINOS RECENTES (últimos 7 dias):
${workoutsText}

## ALERTAS DO SISTEMA:
${alertsText}

Forneça sua análise seguindo o formato obrigatório: RESUMO → INTERPRETAÇÃO → IMPACTO FATORES EXTERNOS (se aplicável) → O QUE MONITORAR.`;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse and validate input
    const rawBody = await req.json();
    const parseResult = RequestBodySchema.safeParse(rawBody);
    
    if (!parseResult.success) {
      console.error('Input validation failed:', parseResult.error.flatten());
      return new Response(JSON.stringify({ 
        error: 'Dados de entrada inválidos',
        details: parseResult.error.flatten().fieldErrors
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const { analysisData, triggerResult } = parseResult.data;
    
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
    const userPrompt = buildUserPrompt(analysisData, triggerResult);

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
