import BlurOnRounded from '@mui/icons-material/BlurOnRounded';
import BookmarkAddedIcon from '@mui/icons-material/BookmarkAdded';
import ConstructionIcon from '@mui/icons-material/Construction';
import DangerousIcon from '@mui/icons-material/Dangerous';

import StatCardRow from '../../../../components/dashboard/StatCardRow';
import { maintenanceStats } from '../../../../data/stats';
import type { MaintenancePlan } from '../../../../data/types';

export default function MaintenancePapers({ maintenances }: { maintenances: MaintenancePlan[] }) {
  const stats = maintenanceStats(maintenances);
  const cards = [
    {
      title: 'Pending maintenances',
      value: stats.pending,
      caption: 'Maintenances that are created but not handled',
      icon: <BlurOnRounded />,
      color: 'success.main',
    },
    {
      title: 'Ongoing maintenances',
      value: stats.inProgress,
      caption: 'Maintenances that are been handled now',
      icon: <ConstructionIcon />,
      color: 'info.main',
    },
    {
      title: 'Completed maintenances',
      value: stats.completed,
      caption: 'Maintenances that are finished',
      icon: <BookmarkAddedIcon />,
      color: 'secondary.main',
    },
    {
      title: 'Cancelled maintenances',
      value: stats.cancelled,
      caption: 'Maintenances that are Cancelled',
      icon: <DangerousIcon />,
      color: 'error.main',
    },
  ];

  return <StatCardRow cards={cards} />;
}
