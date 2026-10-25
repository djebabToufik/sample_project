import { Grid } from '@mui/material';

import GaugeCard from '../../../../components/dashboard/GaugeCard';
import { assetStats, percent } from '../../../../data/stats';
import type { Asset } from '../../../../data/types';

export default function AssetsMetrics({ assets }: { assets: Asset[] }) {
  const stats = assetStats(assets);
  const inUse = percent(stats.inUse, stats.total);
  const underWarranty = percent(stats.inUse - stats.outOfWarranty, stats.inUse);
  const underMaintenance = percent(stats.underMaintenance, stats.inUse);

  const gauges = [
    { title: 'Active Assets', value: inUse, good: inUse >= 75 },
    { title: 'Under warranty', value: underWarranty, good: underWarranty >= 75 },
    { title: 'Under maintenance', value: underMaintenance, good: underMaintenance <= 25 },
    { title: 'Retired assets', value: percent(stats.retired, stats.total), neutralColor: 'chart.blue' },
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
