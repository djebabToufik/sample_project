import CycloneIcon from '@mui/icons-material/Cyclone';
import FreeBreakfastIcon from '@mui/icons-material/FreeBreakfast';
import GppMaybeIcon from '@mui/icons-material/GppMaybe';
import PlayCircleFilledIcon from '@mui/icons-material/PlayCircleFilled';

import StatCardRow from '../../../../components/dashboard/StatCardRow';
import { formatHours, oeeDurations } from '../../../../data/oee';
import type { DowntimeData } from '../../../../data/types';

export default function OeeTimes({ data }: { data: DowntimeData | undefined }) {
  const hours = oeeDurations(data);
  return (
    <StatCardRow
      cards={[
        {
          title: 'Total on time',
          value: formatHours(hours.on),
          caption: 'All duration where the machine was turned on, all states included',
          icon: <CycloneIcon sx={{ color: 'secondary.main' }} />,
          valueVariant: 'h6',
        },
        {
          title: 'Total run time',
          value: formatHours(hours.run),
          caption: 'All duration where the machine was running , and actively producing',
          icon: <PlayCircleFilledIcon sx={{ color: 'success.main' }} />,
          valueVariant: 'h6',
        },
        {
          title: 'Total fault time',
          value: formatHours(hours.allFaults),
          caption: 'All duration where the machine was in maintenance, or downtimes',
          icon: <GppMaybeIcon sx={{ color: 'error.main' }} />,
          valueVariant: 'h6',
        },
        {
          title: 'Total break time',
          value: formatHours(hours.breaks),
          caption: 'All duration where the machine was in pause state, all reasons included',
          icon: <FreeBreakfastIcon sx={{ color: 'info.main' }} />,
          valueVariant: 'h6',
        },
      ]}
    />
  );
}
