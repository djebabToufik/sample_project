import AutoGraphIcon from '@mui/icons-material/AutoGraph';

import ListPage from '../../../components/ListPage';
import { useAssets } from '../../../data/queries';
import AssetsGraphs from './Components/AssetsGraphs';
import AssetsMetrics from './Components/AssetsMetrics';
import AssetsPapers from './Components/AssetsPapers';

export default function AssetsDashboard() {
  const assets = useAssets();
  const rows = assets.data ?? [];

  return (
    <ListPage icon={<AutoGraphIcon />} title="Assets dashboard" loading={assets.isPending}>
      <AssetsPapers assets={rows} />
      <AssetsMetrics assets={rows} />
      <AssetsGraphs assets={rows} />
    </ListPage>
  );
}
