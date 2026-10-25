import { Grid } from '@mui/material';

import { palette } from '../../../../branding';
import CategoryBarChart from '../../../../components/dashboard/CategoryBarChart';
import { assetStats } from '../../../../data/stats';
import type { Asset } from '../../../../data/types';

const statusColors = [
  palette.success.main,
  palette.warning.main,
  palette.error.main,
  palette.secondary.main,
  palette.chart.blue,
  palette.chart.neutral,
];

export default function AssetsGraphs({ assets }: { assets: Asset[] }) {
  const stats = assetStats(assets);

  return (
    <Grid container spacing={4} sx={{ mb: 2 }}>
      <Grid size={{ md: 12, xs: 12, lg: 6 }}>
        <CategoryBarChart
          title="Assets status details"
          axisLabel="Assets status"
          labels={['Total', 'Active', 'Inactive', 'Maintenance', 'Warranty', 'Retired']}
          values={[
            stats.total,
            stats.inUse,
            stats.inactive,
            stats.underMaintenance,
            stats.outOfWarranty,
            stats.retired,
          ]}
          colors={statusColors}
        />
      </Grid>
      <Grid size={{ md: 12, xs: 12, lg: 6 }}>
        <CategoryBarChart
          title="Assets value details"
          axisLabel="Assets costs and values $"
          labels={['Purchase costs $', 'Now value $', 'Depreciation -$']}
          values={[stats.purchaseValue, stats.currentValue, stats.depreciation]}
          categoryGapRatio={0.6}
        />
      </Grid>
    </Grid>
  );
}
