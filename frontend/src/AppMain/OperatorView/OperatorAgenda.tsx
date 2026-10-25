import { useState } from 'react';
import EventNoteIcon from '@mui/icons-material/EventNote';

import { palette } from '../../branding';
import ListPage from '../../components/ListPage';
import MaintenanceCalendar, { type CalendarEvent } from '../../components/MaintenanceCalendar';
import { useMyMaintenances } from '../../data/queries';
import MaintenanceReportDrawer from './MaintenanceReportDrawer';

// The operator's own maintenance plans in a calendar; a plan opens in a drawer.
export default function OperatorAgenda() {
  const maintenances = useMyMaintenances();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const plans = maintenances.data ?? [];
  // Looked up on every render, so the drawer shows the plan as reloaded after a change.
  const selected = plans.find((m) => m.uuid === selectedId);

  const events: CalendarEvent[] = plans
    .filter((m) => m.planned_starting_date)
    .map((m) => ({
      id: m.uuid,
      title: m.name,
      start: m.planned_starting_date!,
      end: m.planned_finished,
      color: m.status === 'In Progress' ? palette.success.main : palette.warning.main,
      description: `This maintenance is planned for the asset ${m.asset?.name}, assigned to ${m.assigned_to?.username}`,
    }));

  return (
    <ListPage icon={<EventNoteIcon />} title="My agenda" loading={maintenances.isPending}>
      <MaintenanceCalendar
        events={events}
        onEventClick={(id) => {
          setSelectedId(id);
          setDrawerOpen(true);
        }}
      />
      <MaintenanceReportDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        maintenance={selected}
      />
    </ListPage>
  );
}
