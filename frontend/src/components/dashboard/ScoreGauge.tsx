import type { ReactNode } from 'react';
import { Box, Paper, Typography } from '@mui/material';
import { Gauge, gaugeClasses } from '@mui/x-charts/Gauge';

import { palette } from '../../branding';

interface ScoreGaugeProps {
  title: string;
  /** Percent, 0-100; null shows "No data" */
  value: number | null;
  /** From this value on the gauge is shown as good (success color), below as warning */
  goodFrom?: number;
  /** Explanation under the gauge */
  children?: ReactNode;
}

// Large percentage gauge in its own card (overall OEE, energy efficiency).
export default function ScoreGauge({ title, value, goodFrom = 65, children }: ScoreGaugeProps) {
  const color = value !== null && value >= goodFrom ? palette.success.main : palette.warning.main;
  return (
    <Paper elevation={1} sx={{ height: '100%', p: 1 }} aria-label={title}>
      <Typography variant="h5" gutterBottom sx={{ p: 2 }}>
        {title}
      </Typography>
      <Box sx={{ display: 'grid', justifyContent: 'center' }}>
        <Gauge
          width={300}
          height={300}
          value={value}
          text={value === null ? 'No data' : `${value.toFixed(1)} %`}
          sx={{
            [`& .${gaugeClasses.valueText}`]: { fontSize: 40 },
            [`& .${gaugeClasses.valueArc}`]: { fill: color },
            m: 'auto',
          }}
        />
        {children}
      </Box>
    </Paper>
  );
}
