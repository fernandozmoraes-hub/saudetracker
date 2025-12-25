import { useMemo } from 'react';

interface ZoneDistributionChartProps {
  zones: {
    z1: number;
    z2: number;
    z3: number;
    z4: number;
    z5: number;
  };
  totalMin?: number;
}

const ZONE_COLORS = [
  'bg-blue-500',
  'bg-green-500',
  'bg-yellow-500',
  'bg-orange-500',
  'bg-red-500',
];

const ZONE_LABELS = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5'];

export function ZoneDistributionChart({ zones, totalMin }: ZoneDistributionChartProps) {
  const data = useMemo(() => {
    const total = totalMin || (zones.z1 + zones.z2 + zones.z3 + zones.z4 + zones.z5);
    if (total === 0) return [];

    return [
      { zone: 1, minutes: zones.z1, pct: (zones.z1 / total) * 100 },
      { zone: 2, minutes: zones.z2, pct: (zones.z2 / total) * 100 },
      { zone: 3, minutes: zones.z3, pct: (zones.z3 / total) * 100 },
      { zone: 4, minutes: zones.z4, pct: (zones.z4 / total) * 100 },
      { zone: 5, minutes: zones.z5, pct: (zones.z5 / total) * 100 },
    ].filter(d => d.minutes > 0);
  }, [zones, totalMin]);

  if (data.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        Sem dados de zonas disponíveis
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Stacked bar */}
      <div className="flex h-8 rounded-lg overflow-hidden">
        {data.map((d, i) => (
          <div
            key={d.zone}
            className={`${ZONE_COLORS[d.zone - 1]} flex items-center justify-center text-xs font-medium text-white transition-all`}
            style={{ width: `${d.pct}%` }}
          >
            {d.pct >= 10 && ZONE_LABELS[d.zone - 1]}
          </div>
        ))}
      </div>

      {/* Legend with minutes */}
      <div className="grid grid-cols-5 gap-1 text-xs">
        {[1, 2, 3, 4, 5].map((zone) => {
          const zoneData = data.find(d => d.zone === zone);
          return (
            <div key={zone} className="text-center">
              <div className={`w-3 h-3 rounded-sm ${ZONE_COLORS[zone - 1]} mx-auto mb-1`} />
              <p className="font-medium">{ZONE_LABELS[zone - 1]}</p>
              <p className="text-muted-foreground">
                {zoneData ? `${zoneData.minutes.toFixed(1)}'` : '-'}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
