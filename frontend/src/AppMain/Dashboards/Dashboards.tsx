import { Route, Routes } from 'react-router';

import Downtimes from './Downtimes/Downtimes';
import Energy from './Energy/Energy';
import Live from './Live/Live';
import Oee from './Oee/Oee';

// Production (OEE) dashboards under /dashboards/.
export default function Dashboards() {
  return (
    <Routes>
      <Route path="/live" Component={Live} />
      <Route path="/energy" Component={Energy} />
      <Route path="/oee" Component={Oee} />
      <Route path="/downtimes" Component={Downtimes} />
      <Route path="*" Component={Oee} />
    </Routes>
  );
}
