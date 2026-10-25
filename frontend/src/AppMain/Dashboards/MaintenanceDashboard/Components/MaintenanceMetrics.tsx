import { Grid } from '@mui/material';

import GaugeCard from '../../../../components/dashboard/GaugeCard';
import { maintenanceStats, percent } from '../../../../data/stats';
import type { MaintenancePlan } from '../../../../data/types';

export default function MaintenanceMetrics({ maintenances }: { maintenances: MaintenancePlan[] }) {
  const stats = maintenanceStats(maintenances);
  const pending = percent(stats.pending, stats.total);
  const inProgress = percent(stats.inProgress, stats.total);
  const completed = percent(stats.completed, stats.total);

  const gauges = [
    { title: 'Pending', value: pending, good: pending <= 50 },
    { title: 'Ongoing', value: inProgress, good: inProgress >= 75 },
    { title: 'Completed', value: completed, good: completed >= 75 },
    { title: 'Cancelled', value: percent(stats.cancelled, stats.total), neutralColor: 'info.main' },
  ];

  return (
    <Grid container spacing={4} sx={{ mb: 2 }}>
      {gauges.map((gauge) => (
        <Grid key={gauge.title} size={{ xs: 12, sm: 6, md: 6, lg: 3 }}>
          <GaugeCard {...gauge} />
        </Grid>
      ))}
    </Grid>
  );
}
