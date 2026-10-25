import { useState } from 'react';
import DateRangeIcon from '@mui/icons-material/DateRange';

import { palette } from '../../../branding';
import ListPage from '../../../components/ListPage';
import MaintenanceCalendar, { type CalendarEvent } from '../../../components/MaintenanceCalendar';
import { queryKeys, useAssets, useMaintenances, useRefresh, useUsers } from '../../../data/queries';
import type { MaintenancePlan, MaintenanceStatus } from '../../../data/types';
import MaintenanceEditForm from '../../Maintenance/MaintenanceForm/MaintenanceEditForm';
import MaintenanceViewerDrawer from './MaintenanceViewerDrawer';

const statusColors: Record<MaintenanceStatus, string> = {
  Cancelled: palette.error.main,
  Pending: palette.secondary.main,
  'In Progress': palette.info.main,
  Completed: palette.success.main,
};

/** What the form gets for a new plan: only the dates of the clicked slot (no uuid = create). */
type NewPlan = Pick<MaintenancePlan, 'planned_starting_date' | 'planned_finished'>;

export default function Agenda() {
  const maintenances = useMaintenances();
  const assets = useAssets();
  const users = useUsers();
  // Saving a plan can change its asset's status (backend sync), so reload assets too.
  const refresh = useRefresh(queryKeys.maintenances, queryKeys.assets);

  // The form resets its fields when it gets a different plan object, so keep the
  // plan in state (also while the form closes) instead of building it on each render.
  const [newPlan, setNewPlan] = useState<NewPlan>({ planned_starting_date: null, planned_finished: null });
  const [formOpen, setFormOpen] = useState(false);
  const [viewedId, setViewedId] = useState<string | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);

  const plans = maintenances.data ?? [];
  const viewed = plans.find((m) => m.uuid === viewedId);

  const events: CalendarEvent[] = plans
    .filter((m) => m.planned_starting_date)
    .map((m) => ({
      id: m.uuid,
      title: m.name,
      start: m.planned_starting_date!,
      end: m.planned_finished,
      color: statusColors[m.status],
      description: `Asset: ${m.asset?.name}\nAssigned to: ${m.assigned_to?.username}`,
    }));

  return (
    <ListPage
      icon={<DateRangeIcon />}
      title="Agenda"
      loading={maintenances.isPending || assets.isPending || users.isPending}
    >
      <MaintenanceCalendar
        events={events}
        onEventClick={(id) => {
          setViewedId(id);
          setViewerOpen(true);
        }}
        // Dates arrive as local datetime-input values.
        onSlotSelect={(start, end) => {
          setNewPlan({ planned_starting_date: start, planned_finished: end });
          setFormOpen(true);
        }}
      />

      <MaintenanceEditForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        maintenancePlan={newPlan}
        users={users.data ?? []}
        assets={assets.data ?? []}
        onSaved={() => {
          setFormOpen(false);
          refresh();
        }}
      />
      <MaintenanceViewerDrawer open={viewerOpen} maintenance={viewed} onClose={() => setViewerOpen(false)} />
    </ListPage>
  );
}
