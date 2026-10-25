import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router';

import PageLoading from '../../components/PageLoading';
import OperatorControl from './OperatorControl';

// The calendar library is only needed by My Schedule.
const OperatorAgenda = lazy(() => import('./OperatorAgenda'));

// Operator pages under /operator/ (the start page of Reporter users).
export default function OperatorView() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Routes>
        <Route path="/agenda" Component={OperatorAgenda} />
        <Route path="/control" Component={OperatorControl} />
        <Route path="/*" Component={OperatorControl} />
      </Routes>
    </Suspense>
  );
}
