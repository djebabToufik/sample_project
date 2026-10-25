import { Grid } from '@mui/material';
import GppBadIcon from '@mui/icons-material/GppBad';

import ListPage from '../../../components/ListPage';
import LiveEvents from '../Live/Components/LiveEvents';
import LineFilter from '../LineFilter/LineFilter';
import { useLineFilter } from '../LineFilter/useLineFilter';
import DowntimeDurations from './Components/DowntimeDurations';
import DowntimesCharts from './Components/DowntimesCharts';

export default function Downtimes() {
  const filter = useLineFilter();
  return (
    <ListPage icon={<GppBadIcon />} title="Downtimes" loading={filter.loading}>
      <Grid container spacing={4}>
        <Grid size={12}>
          <LineFilter filter={filter} />
        </Grid>
        <Grid size={12} sx={{ mb: 2 }}>
          <LiveEvents machine={filter.line} />
        </Grid>
        <Grid size={12}>
          <DowntimeDurations data={filter.data} />
        </Grid>
        <Grid size={12} sx={{ mb: 2 }}>
          <DowntimesCharts data={filter.data} />
        </Grid>
      </Grid>
    </ListPage>
  );
}
