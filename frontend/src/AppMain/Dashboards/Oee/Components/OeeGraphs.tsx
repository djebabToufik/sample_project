import { Grid } from '@mui/material';

import { palette } from '../../../../branding';
import CategoryBarChart from '../../../../components/dashboard/CategoryBarChart';
import ScoreGauge from '../../../../components/dashboard/ScoreGauge';
import { oeeRatios } from '../../../../data/oee';
import type { DowntimeData } from '../../../../data/types';
import OeeComparison from './OeeComparison';
import OeeTimes from './OeeTimes';

/** Green from 65 % on, below that orange (no data: no bar, so the color doesn't matter). */
const rated = (value: number | null) =>
  value !== null && value >= 65 ? palette.success.main : palette.warning.main;

export default function OeeGraphs({ data }: { data: DowntimeData | undefined }) {
  const { availability, performance, quality, oee } = oeeRatios(data);

  return (
    <Grid container spacing={4}>
      <Grid size={12}>
        <OeeTimes data={data} />
      </Grid>
      <Grid size={{ md: 12, xs: 12, lg: 6 }}>
        <CategoryBarChart
          title="Oee metrics"
          axisLabel="Oee metrics"
          labels={['Availability', 'Performance', 'Quality']}
          values={[availability, performance, quality]}
          colors={[rated(availability), rated(performance), rated(quality)]}
          categoryGapRatio={0.6}
          valueAxis={{ min: 0, max: 100 }}
          elevation={0}
        />
      </Grid>
      <Grid size={{ md: 12, xs: 12, lg: 6 }}>
        <ScoreGauge title="Over all oee" value={oee} />
      </Grid>
      <Grid size={12}>
        <OeeComparison data={data} />
      </Grid>
    </Grid>
  );
}
