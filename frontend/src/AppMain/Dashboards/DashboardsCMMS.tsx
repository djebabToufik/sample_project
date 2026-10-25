import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router';

import PageLoading from '../../components/PageLoading';
import AssetsDashboard from './AssetsDashboard/AssetsDashboard';
import MaintenanceDashboard from './MaintenanceDashboard/MaintenanceDashboard';

// The calendar library is only needed by the Agenda.
const Agenda = lazy(() => import('./Agenda/Agenda'));

// CMMS dashboards under /cmms/dashboards/ (also the admin start page).
export default function DashboardsCMMS() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Routes>
        <Route path="/assets" Component={AssetsDashboard} />
        <Route path="/maintenances" Component={MaintenanceDashboard} />
        <Route path="/agenda" Component={Agenda} />
        <Route path="*" Component={AssetsDashboard} />
      </Routes>
    </Suspense>
  );
}
