// Performance Coach — Context Router
// Identifica a intenção da pergunta e seleciona as seções relevantes
// do PerformanceContext antes de enviar para a IA.

export type CoachIntent =
  | 'recovery'
  | 'training_load'
  | 'body_composition'
  | 'alcohol_impact'
  | 'equipment'
  | 'progress'
  | 'general';

export type SectionKey =
  | 'today'
  | 'last7Days'
  | 'last30Days'
  | 'bodyComposition'
  | 'recentWorkouts'
  | 'equipment'
  | 'alcohol';

export interface RouterResult {
  intent: CoachIntent;
  label: string;
  tag: string;
  requiredSections: SectionKey[];
  optionalSections: SectionKey[];
}

const INTENT_META: Record<CoachIntent, { label: string; tag: string }> = {
  recovery: { label: 'Recuperação', tag: '🏃 Recuperação' },
  training_load: { label: 'Carga', tag: '📈 Carga' },
  body_composition: { label: 'Composição', tag: '💪 Composição' },
  alcohol_impact: { label: 'Álcool', tag: '🍺 Álcool' },
  equipment: { label: 'Equipamentos', tag: '👟 Equipamentos' },
  progress: { label: 'Evolução', tag: '📊 Evolução' },
  general: { label: 'Geral', tag: '📊 Geral' },
};

const KEYWORDS: Array<{ intent: CoachIntent; patterns: RegExp[] }> = [
  {
    intent: 'recovery',
    patterns: [
      /\bhrv\b/i,
      /recupera/i,
      /sono/i,
      /fadiga/i,
      /descans/i,
      /body\s*battery/i,
      /freq.*card|frequencia\s*cardiaca|\bfc\b/i,
    ],
  },
  {
    intent: 'training_load',
    patterns: [
      /\bctl\b/i,
      /\batl\b/i,
      /\btsb\b/i,
      /\btss\b/i,
      /\bcarga\b/i,
      /treinando\s+demais/i,
      /overreach/i,
      /overtrain/i,
    ],
  },
  {
    intent: 'body_composition',
    patterns: [
      /\bpeso\b/i,
      /massa\s*muscular/i,
      /gordura/i,
      /sarcopenia/i,
      /composi.*corporal/i,
    ],
  },
  {
    intent: 'alcohol_impact',
    patterns: [
      /alco/i,
      /álcool/i,
      /cerveja/i,
      /vinho/i,
      /bebid/i,
      /hrv.*beb|beb.*hrv/i,
    ],
  },
  {
    intent: 'equipment',
    patterns: [
      /t[êe]nis/i,
      /desgast/i,
      /quilometr|\bkm\b/i,
      /equipament/i,
      /cal[çc]ad/i,
    ],
  },
  {
    intent: 'progress',
    patterns: [
      /evolu/i,
      /desempenh/i,
      /melhor/i,
      /[úu]ltimo\s+m[êe]s/i,
      /progress/i,
    ],
  },
];

const SECTIONS_BY_INTENT: Record<
  CoachIntent,
  { required: SectionKey[]; optional: SectionKey[] }
> = {
  recovery: {
    required: ['today', 'last7Days', 'last30Days'],
    optional: ['alcohol'],
  },
  training_load: {
    required: ['today', 'last7Days', 'last30Days', 'recentWorkouts'],
    optional: [],
  },
  body_composition: {
    required: ['bodyComposition', 'last30Days', 'recentWorkouts'],
    optional: [],
  },
  alcohol_impact: {
    required: ['alcohol', 'today', 'last7Days', 'last30Days'],
    optional: [],
  },
  equipment: {
    required: ['equipment', 'recentWorkouts'],
    optional: [],
  },
  progress: {
    required: ['today', 'last30Days', 'bodyComposition', 'recentWorkouts'],
    optional: ['last7Days'],
  },
  general: {
    required: [
      'today',
      'last7Days',
      'last30Days',
      'bodyComposition',
      'recentWorkouts',
      'equipment',
      'alcohol',
    ],
    optional: [],
  },
};

export function routePerformanceQuestion(question: string): RouterResult {
  const q = question.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const scores: Record<CoachIntent, number> = {
    recovery: 0,
    training_load: 0,
    body_composition: 0,
    alcohol_impact: 0,
    equipment: 0,
    progress: 0,
    general: 0,
  };

  for (const { intent, patterns } of KEYWORDS) {
    for (const p of patterns) {
      if (p.test(q) || p.test(question)) scores[intent] += 1;
    }
  }

  let bestIntent: CoachIntent = 'general';
  let bestScore = 0;
  (Object.keys(scores) as CoachIntent[]).forEach(k => {
    if (scores[k] > bestScore) {
      bestScore = scores[k];
      bestIntent = k;
    }
  });

  if (bestScore === 0) bestIntent = 'general';

  const meta = INTENT_META[bestIntent];
  const sec = SECTIONS_BY_INTENT[bestIntent];

  return {
    intent: bestIntent,
    label: meta.label,
    tag: meta.tag,
    requiredSections: sec.required,
    optionalSections: sec.optional,
  };
}

// Filtra o PerformanceContext mantendo apenas as seções relevantes.
// Seções fora do escopo viram { available: false, reason: 'not_relevant' }
// — assim o prompt fica enxuto e a IA sabe que aquilo NÃO deve ser usado.
export function filterPerformanceContext(
  ctx: Record<string, any>,
  required: SectionKey[],
  optional: SectionKey[]
): { filtered: Record<string, any>; sectionsIncluded: SectionKey[] } {
  const allow = new Set<SectionKey>([...required, ...optional]);
  const allSections: SectionKey[] = [
    'today',
    'last7Days',
    'last30Days',
    'bodyComposition',
    'recentWorkouts',
    'equipment',
    'alcohol',
  ];

  const filtered: Record<string, any> = {
    generatedAt: ctx.generatedAt,
    dataCoverage: { ...(ctx.dataCoverage ?? {}) },
  };

  const included: SectionKey[] = [];
  for (const key of allSections) {
    if (allow.has(key) && ctx[key]) {
      filtered[key] = ctx[key];
      if (ctx[key]?.available !== false) {
        included.push(key);
        filtered.dataCoverage[key] = true;
      } else {
        filtered.dataCoverage[key] = false;
      }
    } else {
      filtered[key] = { available: false, reason: 'not_relevant' };
      filtered.dataCoverage[key] = false;
    }
  }

  return { filtered, sectionsIncluded: included };
}

export const SECTION_LABELS: Record<SectionKey, string> = {
  today: 'Hoje',
  last7Days: 'Últimos 7 dias',
  last30Days: 'Últimos 30 dias',
  bodyComposition: 'Composição corporal',
  recentWorkouts: 'Treinos recentes',
  equipment: 'Equipamentos',
  alcohol: 'Álcool',
};

export const INTENT_LABELS: Record<CoachIntent, string> = Object.fromEntries(
  (Object.keys(INTENT_META) as CoachIntent[]).map(k => [k, INTENT_META[k].label])
) as Record<CoachIntent, string>;

export const INTENT_TAGS: Record<CoachIntent, string> = Object.fromEntries(
  (Object.keys(INTENT_META) as CoachIntent[]).map(k => [k, INTENT_META[k].tag])
) as Record<CoachIntent, string>;
