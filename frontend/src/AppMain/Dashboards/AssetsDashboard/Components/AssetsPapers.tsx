import BlurOnRounded from '@mui/icons-material/BlurOnRounded';
import ConstructionIcon from '@mui/icons-material/Construction';
import DocumentScannerIcon from '@mui/icons-material/DocumentScanner';
import ElderlyIcon from '@mui/icons-material/Elderly';

import StatCardRow from '../../../../components/dashboard/StatCardRow';
import { assetStats } from '../../../../data/stats';
import type { Asset } from '../../../../data/types';

export default function AssetsPapers({ assets }: { assets: Asset[] }) {
  const stats = assetStats(assets);
  const cards = [
    {
      title: 'All assets',
      value: stats.total,
      caption: 'All assets including retired assets',
      icon: <BlurOnRounded />,
      color: 'success.main',
    },
    {
      title: 'Asset in maintenance',
      value: stats.underMaintenance,
      caption: 'All assets with ongoing maintenance',
      icon: <ConstructionIcon />,
      color: 'info.main',
    },
    {
      title: 'Asset out of warranty',
      value: stats.outOfWarranty,
      caption: 'All assets with no warranty',
      icon: <DocumentScannerIcon />,
      color: 'secondary.main',
    },
    {
      title: 'Retired assets',
      value: stats.retired,
      caption: 'All assets that are no longer used',
      icon: <ElderlyIcon />,
      color: 'warning.dark',
    },
  ];

  return <StatCardRow cards={cards} />;
}
