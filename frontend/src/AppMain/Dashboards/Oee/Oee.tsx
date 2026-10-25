import { Grid } from '@mui/material';
import AutoModeIcon from '@mui/icons-material/AutoMode';

import ListPage from '../../../components/ListPage';
import LiveEvents from '../Live/Components/LiveEvents';
import LineFilter from '../LineFilter/LineFilter';
import { useLineFilter } from '../LineFilter/useLineFilter';
import OeeGraphs from './Components/OeeGraphs';

export default function Oee() {
  const filter = useLineFilter();
  return (
    <ListPage icon={<AutoModeIcon />} title="Oee" loading={filter.loading}>
      <Grid container spacing={4}>
        <Grid size={12}>
          <LineFilter filter={filter} />
        </Grid>
        <Grid size={12} sx={{ mb: 2 }}>
          <LiveEvents machine={filter.line} />
        </Grid>
        <Grid size={12} sx={{ mb: 2 }}>
          <OeeGraphs data={filter.data} />
        </Grid>
      </Grid>
    </ListPage>
  );
}
