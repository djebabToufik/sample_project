import { Grid, Typography } from '@mui/material';
import ChargingStationIcon from '@mui/icons-material/ChargingStation';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ReportIcon from '@mui/icons-material/Report';

import { palette } from '../../../../branding';
import CategoryBarChart from '../../../../components/dashboard/CategoryBarChart';
import ScoreGauge from '../../../../components/dashboard/ScoreGauge';
import StatCardRow from '../../../../components/dashboard/StatCardRow';
import { energySplit } from '../../../../data/oee';
import type { DowntimeData } from '../../../../data/types';

const colors = [
  palette.secondary.light,
  palette.chart.lightBlue,
  palette.success.main,
  palette.error.main,
  palette.secondary.main,
  palette.chart.blue,
  palette.chart.neutral,
];

export default function EnergyDurations({ data }: { data: DowntimeData | undefined }) {
  const energy = energySplit(data);
  return (
    <>
      <StatCardRow
        cards={[
          {
            title: 'Total Energy consumption',
            value: `${energy.total} Kw`,
            caption: 'Estimation of total energy consumption, in heating and production phases etc...',
            icon: <ChargingStationIcon sx={{ color: 'secondary.light' }} />,
            valueVariant: 'h6',
          },
          {
            title: 'On energy',
            value: `${energy.on} Kw`,
            caption: 'Energy consumption during the normal heating and preparing phase',
            icon: <LocalFireDepartmentIcon sx={{ color: 'chart.lightBlue' }} />,
            valueVariant: 'h6',
          },
          {
            title: 'Run energy',
            value: `${energy.run} Kw`,
            caption: 'Energy consumption during net production phase, no downtime included',
            icon: <PlayArrowIcon sx={{ color: 'success.light' }} />,
            valueVariant: 'h6',
          },
          {
            title: 'Failures energy',
            value: `${energy.faulty} Kw`,
            caption: 'Energy consumption during all faulty situations, all faults included',
            icon: <ReportIcon sx={{ color: 'error.main' }} />,
            valueVariant: 'h6',
          },
        ]}
      />
      <Grid container spacing={4} sx={{ mb: 2 }}>
        <Grid size={{ md: 12, xs: 12, lg: 6 }}>
          <CategoryBarChart
            title="Costs & Energy metrics"
            axisLabel="Costs & Energy metrics"
            labels={['All', 'On', 'Run', 'Fault']}
            values={[100, energy.onShare, energy.efficiency, energy.faultyShare]}
            colors={colors}
            categoryGapRatio={0.6}
            valueAxis={{ min: 0, max: 100, label: '%' }}
          />
        </Grid>
        <Grid size={{ md: 12, xs: 12, lg: 6 }}>
          <ScoreGauge title="Costs & Energy efficiency" value={energy.efficiency}>
            <Typography variant="body1" gutterBottom sx={{ p: 2 }}>
              <strong>Cost & energy efficiency</strong> is the ratio between net run and total costs
            </Typography>
          </ScoreGauge>
        </Grid>
      </Grid>
    </>
  );
}
