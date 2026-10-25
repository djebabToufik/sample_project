import { Grid } from '@mui/material';

import { palette } from '../../../../branding';
import CategoryBarChart from '../../../../components/dashboard/CategoryBarChart';
import { downtimeCounts } from '../../../../data/oee';
import type { DowntimeData } from '../../../../data/types';

const colors = [
  palette.secondary.main,
  palette.success.main,
  palette.warning.main,
  palette.error.main,
  palette.secondary.main,
  palette.chart.blue,
  palette.chart.neutral,
];

// Number of downtime events per fault type and per cell.
export default function DowntimesCharts({ data }: { data: DowntimeData | undefined }) {
  const { perFault, perCell } = downtimeCounts(data);
  return (
    <Grid container spacing={4}>
      <Grid size={{ md: 12, xs: 12, lg: 6 }}>
        <CategoryBarChart
          title="Per fault type"
          axisLabel="Faults"
          labels={perFault.map((f) => f.label)}
          values={perFault.map((f) => f.count)}
          colors={colors}
          categoryGapRatio={0.6}
          elevation={0}
        />
      </Grid>
      <Grid size={{ md: 12, xs: 12, lg: 6 }}>
        <CategoryBarChart
          title="Per Cell"
          axisLabel="Cells"
          labels={perCell.map((c) => c.label)}
          values={perCell.map((c) => c.count)}
          colors={colors}
          categoryGapRatio={0.6}
          elevation={0}
        />
      </Grid>
    </Grid>
  );
}
