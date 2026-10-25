import GppMaybeIcon from '@mui/icons-material/GppMaybe';
import PriorityHighIcon from '@mui/icons-material/PriorityHigh';
import ReportIcon from '@mui/icons-material/Report';
import ReportGmailerrorredIcon from '@mui/icons-material/ReportGmailerrorred';

import StatCardRow from '../../../../components/dashboard/StatCardRow';
import { formatHours, oeeDurations } from '../../../../data/oee';
import type { DowntimeData } from '../../../../data/types';

export default function DowntimeDurations({ data }: { data: DowntimeData | undefined }) {
  const hours = oeeDurations(data);
  const errorIcon = { sx: { color: 'error.main' } };
  return (
    <StatCardRow
      cards={[
        {
          title: 'Total fault time',
          value: formatHours(hours.allFaults),
          caption: 'All duration where the machine was faulty, all states included',
          icon: <GppMaybeIcon {...errorIcon} />,
          valueVariant: 'h6',
        },
        {
          title: 'Fault time',
          value: formatHours(hours.fault),
          caption: 'All downtimes that occured during the production process',
          icon: <ReportGmailerrorredIcon {...errorIcon} />,
          valueVariant: 'h6',
        },
        {
          title: 'Failures',
          value: formatHours(hours.failure),
          caption: 'All faults that happened while machine was on and during heating or changeover phase',
          icon: <ReportIcon {...errorIcon} />,
          valueVariant: 'h6',
        },
        {
          title: 'Out of order',
          value: formatHours(hours.outOfOrder),
          caption: 'All faults that happened while machine was off',
          icon: <PriorityHighIcon {...errorIcon} />,
          valueVariant: 'h6',
        },
      ]}
    />
  );
}
