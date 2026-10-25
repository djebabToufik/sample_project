import { Grid } from '@mui/material';

import CategoryBarChart from '../../../../components/dashboard/CategoryBarChart';
import type { Asset, MaintenancePlan, UserProfile } from '../../../../data/types';

interface MaintenancesGraphProps {
  maintenances: MaintenancePlan[];
  users: UserProfile[];
  assets: Asset[];
}

export default function MaintenancesGraph({ maintenances, users, assets }: MaintenancesGraphProps) {
  const perUser = users.map(
    (profile) => maintenances.filter((m) => m.assigned_to?.id === profile.user.id).length,
  );
  // Plans without an asset are not counted.
  const perAsset = assets.map((asset) => maintenances.filter((m) => m.asset?.uuid === asset.uuid).length);

  return (
    <Grid container spacing={4} sx={{ mb: 2 }}>
      <Grid size={{ md: 12, xs: 12, lg: 6 }}>
        <CategoryBarChart
          title="Maintenance per user"
          axisLabel="Planned maintenance by user"
          labels={users.map((profile) => profile.user.username)}
          values={perUser}
          categoryGapRatio={0.6}
        />
      </Grid>
      <Grid size={{ md: 12, xs: 12, lg: 6 }}>
        <CategoryBarChart
          title="Maintenance per asset"
          axisLabel="Planned maintenance by asset"
          labels={assets.map((asset) => asset.name)}
          values={perAsset}
          categoryGapRatio={0.6}
        />
      </Grid>
    </Grid>
  );
}
