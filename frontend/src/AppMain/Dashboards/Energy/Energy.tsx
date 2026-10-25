import { Grid } from '@mui/material';
import ElectricBoltIcon from '@mui/icons-material/ElectricBolt';

import ListPage from '../../../components/ListPage';
import LiveEvents from '../Live/Components/LiveEvents';
import LineFilter from '../LineFilter/LineFilter';
import { useLineFilter } from '../LineFilter/useLineFilter';
import Costs from './Components/Costs';
import EnergyDurations from './Components/EnergyDurations';

export default function Energy() {
  const filter = useLineFilter();
  return (
    <ListPage icon={<ElectricBoltIcon />} title="Energy & costs" loading={filter.loading}>
      <Grid container spacing={4}>
        <Grid size={12}>
          <LineFilter filter={filter} />
        </Grid>
        <Grid size={12} sx={{ mb: 2 }}>
          <LiveEvents machine={filter.line} />
        </Grid>
        <Grid size={12}>
          <Costs data={filter.data} />
        </Grid>
        <Grid size={12} sx={{ mb: 2 }}>
          <EnergyDurations data={filter.data} />
        </Grid>
      </Grid>
    </ListPage>
  );
}
