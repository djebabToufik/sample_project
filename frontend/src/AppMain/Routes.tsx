import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router';

import { useAuth } from '../auth/AuthContext';
import PageLoading from '../components/PageLoading';

// Each area's code loads the first time it is opened, so the first page appears sooner.
const AssetsPage = lazy(() => import('./Assets/AssetsPage'));
const CellsPage = lazy(() => import('./Cells/CellsPage'));
const Dashboards = lazy(() => import('./Dashboards/Dashboards'));
const DashboardsCMMS = lazy(() => import('./Dashboards/DashboardsCMMS'));
const FaultsPage = lazy(() => import('./Faults/FaultsPage'));
const MaintenancePage = lazy(() => import('./Maintenance/MaintenancePage'));
const OperatorView = lazy(() => import('./OperatorView/OperatorView'));
const ProductsPage = lazy(() => import('./Products/ProductsPage'));
const UsersPage = lazy(() => import('./Users/UsersPage'));

// App pages by role: admins see everything (start page: CMMS dashboards),
// reporters (operators) the operator view.
export default function AppRoutes() {
  const { profile } = useAuth();

  let routes = null;
  if (profile?.type === 'Admin') {
    routes = (
      <Routes>
        <Route path="/admin/assets/*" Component={AssetsPage} />
        <Route path="/cmms/maintenance/*" Component={MaintenancePage} />
        <Route path="/admin/users/*" Component={UsersPage} />
        <Route path="/dashboards/*" Component={Dashboards} />
        <Route path="/cmms/dashboards/*" Component={DashboardsCMMS} />
        <Route path="/operator/*" Component={OperatorView} />
        <Route path="/admin/cells/*" Component={CellsPage} />
        <Route path="/admin/faults/*" Component={FaultsPage} />
        <Route path="/admin/products/*" Component={ProductsPage} />
        <Route path="*" Component={DashboardsCMMS} />
      </Routes>
    );
  } else if (profile?.type === 'Reporter') {
    routes = (
      <Routes>
        <Route path="/operator/*" Component={OperatorView} />
        <Route path="*" Component={OperatorView} />
      </Routes>
    );
  }

  return <Suspense fallback={<PageLoading />}>{routes}</Suspense>;
}
