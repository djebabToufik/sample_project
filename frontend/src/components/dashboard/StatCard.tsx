import type { ReactNode } from 'react';
import { Paper, Stack, Typography } from '@mui/material';

export interface StatCardProps {
  title: string;
  value: ReactNode;
  caption: string;
  icon: ReactNode;
  /**
   * Background, as a theme color path such as 'success.main' (white text).
   * Without it the card is plain and flat; color the icon instead.
   */
  color?: string;
  /** Size of the value: h4 for numbers, h6 for longer text such as durations */
  valueVariant?: 'h4' | 'h6';
  /** Color of the value, as a theme color path */
  valueColor?: string;
}

// Card with one big value (dashboard summary rows).
export default function StatCard({
  title,
  value,
  caption,
  icon,
  color,
  valueVariant = 'h4',
  valueColor,
}: StatCardProps) {
  return (
    <Paper
      elevation={color ? 1 : 0}
      sx={{ height: 150, p: 1, ...(color && { bgcolor: color, color: 'common.white' }) }}
      aria-label={title}
    >
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="overline" sx={{ m: 0 }}>
          {title}
        </Typography>
        {icon}
      </Stack>
      <Typography variant={valueVariant} gutterBottom sx={{ pl: 1, color: valueColor }}>
        {value}
      </Typography>
      <Typography variant="caption">{caption}</Typography>
    </Paper>
  );
}
