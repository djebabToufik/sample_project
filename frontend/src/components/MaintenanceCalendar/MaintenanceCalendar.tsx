import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import type { DateSelectArg, EventClickArg, EventInput, EventMountArg } from '@fullcalendar/core';
import { Box } from '@mui/material';
import { useTheme } from '@mui/material/styles';

import { toLocalInputValue } from '../../data/dates';

// Calendar used by the Agenda and the operator's agenda.
// Colors come from the MUI theme (src/branding/theme.ts), so OEM branding applies here too.

export interface CalendarEvent {
  id: string;
  title: string;
  start: string | Date;
  end?: string | Date | null;
  /** Any CSS color, e.g. from `palette.success.main` */
  color?: string;
  /** Shown as a tooltip on hover */
  description?: string;
}

export interface MaintenanceCalendarProps {
  events: CalendarEvent[];
  /** Called with the event id when an event is clicked. */
  onEventClick?: (id: string) => void;
  /**
   * Called when an empty day or time slot is clicked (or a range is dragged).
   * Dates are local `YYYY-MM-DDTHH:mm` strings, ready for a datetime-local input.
   */
  onSlotSelect?: (start: string, end: string) => void;
}

const time24 = { hour: '2-digit', minute: '2-digit', hour12: false } as const;

export default function MaintenanceCalendar({
  events,
  onEventClick,
  onSlotSelect,
}: MaintenanceCalendarProps) {
  const theme = useTheme();
  const { palette } = theme;

  const calendarEvents: EventInput[] = events.map((event) => ({
    id: event.id,
    title: event.title,
    start: event.start,
    end: event.end ?? undefined,
    backgroundColor: event.color,
    borderColor: event.color,
    extendedProps: { description: event.description },
  }));

  const handleSelect = (info: DateSelectArg) => {
    info.view.calendar.unselect();
    onSlotSelect?.(toLocalInputValue(info.start), toLocalInputValue(info.end));
  };

  const handleEventClick = (info: EventClickArg) => {
    info.jsEvent.preventDefault();
    onEventClick?.(info.event.id);
  };

  const handleEventMount = (info: EventMountArg) => {
    const description = info.event.extendedProps.description as string | undefined;
    if (description) info.el.title = description;
  };

  return (
    <Box
      data-testid="maintenance-calendar"
      sx={{
        // FullCalendar reads these CSS variables; map them to the app theme.
        '--fc-border-color': palette.divider,
        '--fc-button-bg-color': palette.primary.main,
        '--fc-button-border-color': palette.primary.main,
        '--fc-button-text-color': palette.primary.contrastText,
        '--fc-button-hover-bg-color': palette.primary.dark,
        '--fc-button-hover-border-color': palette.primary.dark,
        '--fc-button-active-bg-color': palette.primary.dark,
        '--fc-button-active-border-color': palette.primary.dark,
        '--fc-event-bg-color': palette.secondary.main,
        '--fc-event-border-color': palette.secondary.main,
        '--fc-today-bg-color': theme.alpha(palette.primary.main, 0.06),
        '--fc-page-bg-color': palette.background.paper,
        fontFamily: theme.typography.fontFamily,
        '& .fc .fc-toolbar-title': { ...theme.typography.h6 },
        '& .fc .fc-daygrid-day, & .fc .fc-timegrid-slot': { cursor: onSlotSelect ? 'pointer' : 'default' },
        '& .fc-event': { cursor: onEventClick ? 'pointer' : 'default' },
      }}
    >
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'listWeek,dayGridMonth,timeGridWeek,timeGridDay',
        }}
        buttonText={{ today: 'Today', listWeek: 'Agenda', month: 'Month', week: 'Week', day: 'Day' }}
        firstDay={6}
        height="auto"
        events={calendarEvents}
        eventTimeFormat={time24}
        slotLabelFormat={time24}
        editable={false}
        selectable={Boolean(onSlotSelect)}
        select={handleSelect}
        eventClick={handleEventClick}
        eventDidMount={handleEventMount}
      />
    </Box>
  );
}
