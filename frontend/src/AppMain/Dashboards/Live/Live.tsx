import { Grid } from '@mui/material';
import SensorsIcon from '@mui/icons-material/Sensors';

import ListPage from '../../../components/ListPage';
import { useAssets } from '../../../data/queries';
import LineCard from './Components/LineCard';

// One live card per line.
export default function Live() {
  const assets = useAssets();
  return (
    <ListPage icon={<SensorsIcon />} title="Live view" loading={assets.isPending}>
      <Grid container spacing={4}>
        {(assets.data ?? []).map((asset) => (
          <Grid key={asset.uuid} size={{ md: 6, xs: 12, lg: 3 }}>
            <LineCard machine={asset} />
          </Grid>
        ))}
      </Grid>
    </ListPage>
  );
}
