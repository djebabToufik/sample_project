import type { ReactNode } from 'react';
import { Box, Chip, Divider, Paper, Stack, Typography, type ChipProps } from '@mui/material';

import type { MaintenancePlan } from '../../data/types';

const statusColor: Record<string, ChipProps['color']> = {
  Completed: 'success',
  Pending: 'warning',
  Cancelled: 'error',
  'In Progress': 'info',
};
const typeColor: Record<string, ChipProps['color']> = {
  Planned: 'success',
  Other: 'info',
  UnPlanned: 'error',
};
const priorityColor: Record<string, ChipProps['color']> = { Low: 'success', Medium: 'info', High: 'error' };

const formatDate = (value: string | null | undefined) => (value ? new Date(value).toLocaleString() : '');

// Details of a maintenance plan (operator drawer, Agenda viewer).
export default function MaintenanceCard({
  maintenance,
}: {
  maintenance: MaintenancePlan | null | undefined;
}) {
  const field = (label: string, value: ReactNode) => (
    <Typography variant="body1" sx={{ mb: 1 }}>
      <strong>{label}:</strong> {value}
    </Typography>
  );

  return (
    <Paper elevation={0} sx={{ p: 3, mb: 3 }} aria-label="Maintenance plan">
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
        {maintenance?.name}
      </Typography>
      <Divider sx={{ mb: 3 }} />
      <Box sx={{ mb: 3 }}>
        {field('Reference', maintenance?.ref)}
        {field('Type', maintenance?.type)}
        {field('Planned start', formatDate(maintenance?.planned_starting_date))}
        {field('Planned finish', formatDate(maintenance?.planned_finished))}
        {field('Assigned by', maintenance?.created_by?.username)}
        {field('Assigned to', maintenance?.assigned_to?.username)}
        {field(
          'Instructions',
          maintenance?.instructions && (
            <a href={maintenance.instructions} target="_blank" rel="noreferrer">
              Download file
            </a>
          ),
        )}
      </Box>
      <Divider sx={{ mb: 2 }} />
      <Stack direction="row" spacing={1}>
        <Chip label={maintenance?.status} color={statusColor[maintenance?.status ?? '']} />
        <Chip label={maintenance?.type} color={typeColor[maintenance?.type ?? '']} />
        <Chip label={maintenance?.priority} color={priorityColor[maintenance?.priority ?? '']} />
      </Stack>
    </Paper>
  );
}
