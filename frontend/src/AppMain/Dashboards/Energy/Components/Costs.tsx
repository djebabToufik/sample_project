import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ReportIcon from '@mui/icons-material/Report';

import StatCardRow from '../../../../components/dashboard/StatCardRow';
import { costSplit } from '../../../../data/oee';
import type { DowntimeData } from '../../../../data/types';

export default function Costs({ data }: { data: DowntimeData | undefined }) {
  const costs = costSplit(data);
  return (
    <StatCardRow
      cards={[
        {
          title: 'Total Costs',
          value: `${costs.total} $`,
          caption: 'Costs, in heating and production phases etc...',
          icon: <AttachMoneyIcon sx={{ color: 'secondary.light' }} />,
          valueVariant: 'h6',
        },
        {
          title: 'On cost',
          value: `${costs.on} $`,
          caption: 'Costs during the normal heating and preparing phase',
          icon: <LocalFireDepartmentIcon sx={{ color: 'chart.lightBlue' }} />,
          valueVariant: 'h6',
        },
        {
          title: 'Run cost',
          value: `${costs.run} $`,
          caption: 'Costs during net production phase, no downtime included',
          icon: <PlayArrowIcon sx={{ color: 'success.light' }} />,
          valueVariant: 'h6',
        },
        {
          title: 'Failures cost',
          value: `${costs.faulty} $`,
          caption: 'Costs during all faulty situations, all faults included',
          icon: <ReportIcon sx={{ color: 'error.main' }} />,
          valueVariant: 'h6',
        },
      ]}
    />
  );
}
