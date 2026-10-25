import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';

import StatCardRow from '../../../../components/dashboard/StatCardRow';
import { oeeComparison } from '../../../../data/oee';
import type { DowntimeData } from '../../../../data/types';

/** "+2.0 pts" / "−1.4 pts": percentage points. */
export const formatPoints = (points: number) =>
  `${points > 0 ? '+' : points < 0 ? '−' : ''}${Math.abs(points).toFixed(1)} pts`;

// Change of each figure against the last 24 hours (up = green, down = red, '–' = no data).
export default function OeeComparison({ data }: { data: DowntimeData | undefined }) {
  const delta = oeeComparison(data);
  const card = (title: string, value: number | null) => {
    if (value === null) return { title, value: '–', caption: 'Compared to last 24h', icon: null };
    const up = value >= 0;
    return {
      title,
      value: formatPoints(value),
      caption: 'Compared to last 24h',
      icon: up ? (
        <TrendingUpIcon sx={{ color: 'success.main' }} />
      ) : (
        <TrendingDownIcon sx={{ color: 'error.main' }} />
      ),
      valueColor: up ? 'success.main' : 'error.main',
    };
  };

  return (
    <StatCardRow
      cards={[
        card('Availability', delta.availability),
        card('Performance', delta.performance),
        card('Quality', delta.quality),
        card('OEE', delta.oee),
      ]}
    />
  );
}
