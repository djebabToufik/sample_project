import { Paper, Typography } from '@mui/material';
import { BarChart } from '@mui/x-charts/BarChart';

import { palette } from '../../branding';

// Default bar colors, from the theme (OEM branding applies).
export const categoryColors = [
  palette.success.main,
  palette.chart.blue,
  palette.error.main,
  palette.secondary.main,
  palette.chart.blue,
  palette.chart.dark,
];

interface CategoryBarChartProps {
  title: string;
  /** Axis label under the bars */
  axisLabel: string;
  labels: string[];
  /** null: no bar (no data) */
  values: (number | null)[];
  /** One color per bar, repeating (default: categoryColors) */
  colors?: string[];
  categoryGapRatio?: number;
  /** Value axis, e.g. { min: 0, max: 100, label: '%' } for percentages, { tickMinStep: 1 } for counts */
  valueAxis?: { min?: number; max?: number; label?: string; tickMinStep?: number };
}

// One bar per category, each in its own color (dashboard charts).
export default function CategoryBarChart({
  title,
  axisLabel,
  labels,
  values,
  colors = categoryColors,
  categoryGapRatio,
  valueAxis,
}: CategoryBarChartProps) {
  return (
    <Paper elevation={1} sx={{ p: 1 }} aria-label={title}>
      <Typography variant="h5" gutterBottom sx={{ p: 2 }}>
        {title}
      </Typography>
      <BarChart
        series={[{ data: values }]}
        height={400}
        yAxis={valueAxis && [valueAxis]}
        xAxis={[
          {
            data: labels,
            scaleType: 'band',
            label: axisLabel,
            colorMap: { type: 'ordinal', colors },
            categoryGapRatio,
            // MUI hides labels that would overlap: with many bars, angle them so all show.
            ...(labels.length > 5 && {
              tickLabelInterval: () => true,
              tickLabelStyle: { angle: -30, textAnchor: 'end', fontSize: 12 },
              height: 'auto',
            }),
          },
        ]}
      />
    </Paper>
  );
}
