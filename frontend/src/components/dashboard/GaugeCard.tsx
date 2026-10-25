import { Paper, Typography } from '@mui/material';
import { useTheme, type Theme } from '@mui/material/styles';
import { Gauge, gaugeClasses } from '@mui/x-charts/Gauge';

interface GaugeCardProps {
  title: string;
  /** Percent, 0-100 */
  value: number;
  /** true = good rate, false = below average, undefined = neutral value */
  good?: boolean;
  /** Color of a neutral gauge, as a theme color path such as 'info.main' */
  neutralColor?: string;
}

/** Raw color for a theme path like 'chart.blue' (the gauge fill needs a value, not a path). */
function paletteColor(theme: Theme, path: string): string {
  const value = path
    .split('.')
    .reduce<unknown>((node, key) => (node as Record<string, unknown> | undefined)?.[key], theme.palette);
  return typeof value === 'string' ? value : path;
}

// Percentage gauge with a rating below it (dashboard KPI row).
export default function GaugeCard({ title, value, good, neutralColor = 'info.main' }: GaugeCardProps) {
  const theme = useTheme();
  const color = good === undefined ? neutralColor : good ? 'success.main' : 'error.main';
  const label = good === undefined ? 'neutral value' : good ? 'Good rate' : 'below average';

  return (
    <Paper elevation={1} sx={{ p: 1 }} aria-label={title}>
      <Typography variant="overline" gutterBottom>
        {title}
      </Typography>
      <Gauge
        width={200}
        height={200}
        value={value}
        sx={{
          [`& .${gaugeClasses.valueText}`]: { fontSize: 40 },
          [`& .${gaugeClasses.valueArc}`]: { fill: paletteColor(theme, color) },
          m: 'auto',
        }}
      />
      <Typography
        variant="overline"
        align="right"
        gutterBottom
        sx={{ display: 'block', color, fontWeight: 'bold' }}
      >
        {label}
      </Typography>
    </Paper>
  );
}
