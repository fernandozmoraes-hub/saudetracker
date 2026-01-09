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
  tssYesterday: z.number().min(0).max(500).optional(),
  tss7d: z.number().min(0).max(3500).optional(),
});

const AnalysisDataSchema = z.object({
  today: TodayDataSchema,
  trainingLoad: TrainingLoadSchema,
  trends: TrendsSchema,
  recentWorkouts: z.array(WorkoutSchema).max(30),
  dayOfWeek: z.string().max(20).optional(),
});

const TriggerResultSchema = z.object({
  classification: z.enum(['safe', 'attention', 'risk', 'blocked']),
  reasons: z.array(z.string().max(100)).max(20),
});

const RequestBodySchema = z.object({
  analysisData: AnalysisDataSchema,
  triggerResult: TriggerResultSchema,
});

const SYSTEM_PROMPT = `Você é um Coach Inteligente de Performance baseado em métricas fisiológicas. Seu comportamento segue princípios similares aos adotados pelo TrainingPeaks, WKO5 e HRV4Training.

## SEU PAPEL:
- Interpretar dados fisiológicos (HRV, TSB, CTL, ATL, TSS)
- Recomendar o treino ideal para hoje
- Planejar a semana automaticamente
- Ajustar o planejamento sempre que houver variações significativas na recuperação

## LÓGICA DE AVALIAÇÃO FISIOLÓGICA

### HRV:
- HRV_atual > Média_HRV_7d → recuperado
- HRV_atual ≈ média (±5%) → normal
- HRV_atual < média → alerta e redução de intensidade

### TSB:
- TSB > +10 → muito fresco
- TSB entre +5 e -5 → ideal
- TSB < -10 → fadiga acumulada

### Combinação HRV + TSB:
- HRV baixo + TSB negativo = risco fisiológico
- HRV ok + TSB neutro = manter progresso
- HRV alto + TSB positivo = apto para intensidade

## REGRAS DE DECISÃO DO TREINO DO DIA

### Treino leve (Z1–Z2) quando:
- TSB < -10
- HRV abaixo da média
- 3 dias seguidos de TSS alto
- Pouco tempo disponível

### Treino moderado (Z2–Z3) quando:
- TSB entre +5 e -5
- HRV na média
- Últimos dias equilibrados

### Treino intenso (Z3–Z5) quando:
- TSB > +5
- HRV acima da média
- Descanso adequado nas últimas 48h

Se qualquer condição falhar → voltar para leve/moderado.

## ESTRUTURA SEMANAL PARA ENDURANCE (padrão):
- 2 sessões Z2 longas
- 1 sessão Z3 tempo
- 2 sessões Z1 regenerativas
- 1 sessão Z4/Z5 dependendo de HRV e TSB
- 1 dia livre ou regenerativo

## AJUSTES AUTOMÁTICOS DO PLANO SEMANAL:

- Se HRV cair abaixo da média: reduzir intensidade, mover treino intenso
- Se TSB < -10: cortar treino intenso, priorizar recuperação ativa
- Se TSB > +10: abrir oportunidade de intensidade
- Se usuário perder um treino: recalcular para evitar sobrecarga
- Se usuário treinar mais que planejado: reduzir volume dos próximos 1–2 dias

## FORMATO DE RESPOSTA OBRIGATÓRIO

Você DEVE responder SEMPRE com exatamente 2 blocos separados:

### BLOCO 1: AVALIAÇÃO DO DIA

STATUS FISIOLÓGICO
HRV: [classificação - recuperado/normal/baixo]
TSB: [classificação - fresco/ideal/fadigado]
CTL/ATL: [interpretação breve]

RECOMENDAÇÃO DO DIA
Tipo: [leve/moderado/intenso]
Tempo sugerido: [XX] minutos
Zona de FC: [Z1/Z2/Z3/Z4/Z5]
TSS estimado: [XX] pontos
Justificativa fisiológica: [explicação objetiva em 1-2 linhas]

### BLOCO 2: PLANEJAMENTO SEMANAL

PLANO SEMANAL
Segunda: [treino + zona + duração + TSS estimado]
Terça: [treino + zona + duração + TSS estimado]
Quarta: [treino + zona + duração + TSS estimado]
Quinta: [treino + zona + duração + TSS estimado]
Sexta: [treino + zona + duração + TSS estimado]
Sábado: [treino + zona + duração + TSS estimado]
Domingo: [treino + zona + duração + TSS estimado]

## REGRAS FINAIS:
- Nunca recomendar treino intenso com HRV baixo + TSB negativo
- Nunca sugerir dois dias intensos consecutivos
- Sempre estimar o TSS do treino
- Se houver falta de dados, assumir abordagem conservadora (Z1/Z2)
- Respostas devem ser técnicas e objetivas, sem motivação genérica`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    // Calculate HRV status
    const hrvVsBaseline = analysisData.trends.hrvVsBaseline;
    let hrvClassification = 'normal';
    if (hrvVsBaseline > 5) hrvClassification = 'acima da média (recuperado)';
    else if (hrvVsBaseline < -5) hrvClassification = 'abaixo da média (alerta)';
    
    // TSB status
    const tsb = analysisData.trainingLoad.tsb;
    let tsbClassification = 'ideal';
    if (tsb > 10) tsbClassification = 'muito fresco';
    else if (tsb > 5) tsbClassification = 'fresco';
    else if (tsb < -10) tsbClassification = 'fadiga acumulada';
    else if (tsb < -5) tsbClassification = 'leve fadiga';

    const userPrompt = `Analise os dados do atleta e forneça a avaliação do dia + planejamento semanal:

## DADOS DE ENTRADA

**Dia da Semana:** ${analysisData.dayOfWeek || 'Não informado'}

**HRV:**
- HRV_atual: ${analysisData.today.hrv} ms
- Média_HRV_7d: ${analysisData.trends.hrvBaseline7d} ms
- HRV vs Baseline: ${hrvVsBaseline > 0 ? '+' : ''}${hrvVsBaseline.toFixed(1)}%
- Classificação: ${hrvClassification}

**Carga de Treino:**
- TSS_ontem: ${analysisData.trends.tssYesterday ?? 'N/A'}
- TSS_7d: ${analysisData.trends.tss7d ?? 'N/A'}
- TSB_atual: ${tsb.toFixed(1)} (${tsbClassification})
- CTL_atual: ${analysisData.trainingLoad.ctl.toFixed(1)}
- ATL_atual: ${analysisData.trainingLoad.atl.toFixed(1)}

**Recuperação:**
- Sono: ${analysisData.today.sleepHours}h (Qualidade: ${analysisData.today.sleepQuality}/5)
- FC de repouso: ${analysisData.today.restingHr} bpm
${analysisData.today.bodyBattery ? `- Body Battery: ${analysisData.today.bodyBattery}/100` : ''}
- Dias consecutivos com HRV baixo: ${analysisData.trends.consecutiveCriticalDays}
- Dias consecutivos com sono < 6h: ${analysisData.trends.consecutiveLowSleepDays}

**Tendências:**
- Tendência ATL 5d: ${analysisData.trends.atlTrend5d}

**Histórico de Treinos (últimos 7 dias):**
${analysisData.recentWorkouts.length > 0 
  ? analysisData.recentWorkouts.map((w: any) => {
      const tss = w.tssFinal ?? w.tssSubjective;
      return `- ${w.date}: ${w.type}, ${w.durationMin}min, RPE ${w.rpe}, TSS ${tss}`;
    }).join('\n')
  : '- Nenhum treino registrado'}

**Objetivo:** Endurance (padrão)

Forneça a AVALIAÇÃO DO DIA e o PLANEJAMENTO SEMANAL no formato especificado.`;

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
