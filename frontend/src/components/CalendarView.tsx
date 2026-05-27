import { useRef, useCallback } from 'react';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventClickArg, DateSelectArg, EventResizeDoneArg, EventDropArg, EventInput } from '@fullcalendar/core';
import type { TimeEntry } from '../api/client';
import api from '../api/client';

interface Props {
  entries: TimeEntry[];
  onSelectSlot: (date: string, start: string, end: string) => void;
  onEditEntry: (entry: TimeEntry) => void;
  onEntryUpdated: (entry: TimeEntry) => void;
}

function toCalendarEvent(e: TimeEntry): EventInput {
  const base = e.entry_date.slice(0, 10);
  const start = e.start_time.slice(0, 8);
  const end = e.end_time.slice(0, 8);
  return {
    id: e.id,
    title: `${e.short_text}${e.kostenstelle ? ' · ' + e.kostenstelle : ''}`,
    start: `${base}T${start}`,
    end: `${base}T${end}`,
    classNames: [e.is_travel ? 'travel-event' : 'work-event'],
    extendedProps: { entry: e },
  };
}

export default function CalendarView({ entries, onSelectSlot, onEditEntry, onEntryUpdated }: Props) {
  const calRef = useRef<FullCalendar>(null);

  const handleSelect = useCallback((arg: DateSelectArg) => {
    const date = arg.startStr.slice(0, 10);
    const start = arg.startStr.slice(11, 16);
    const end = arg.endStr.slice(11, 16);
    onSelectSlot(date, start, end || start);
  }, [onSelectSlot]);

  const handleEventClick = useCallback((arg: EventClickArg) => {
    onEditEntry(arg.event.extendedProps.entry as TimeEntry);
  }, [onEditEntry]);

  const handleEventChange = useCallback(async (entry: TimeEntry, newStart: string, newEnd: string) => {
    const updated = { ...entry, start_time: newStart, end_time: newEnd };
    try {
      const { data } = await api.put(`/entries/${entry.id}`, updated);
      onEntryUpdated(data);
    } catch {
      // revert is handled by FullCalendar automatically on error throw
    }
  }, [onEntryUpdated]);

  const handleEventResize = useCallback((arg: EventResizeDoneArg) => {
    const entry = arg.event.extendedProps.entry as TimeEntry;
    const newEnd = arg.event.endStr?.slice(11, 16) || entry.end_time;
    handleEventChange(entry, arg.event.startStr.slice(11, 16), newEnd);
  }, [handleEventChange]);

  const handleEventDrop = useCallback((arg: EventDropArg) => {
    const entry = arg.event.extendedProps.entry as TimeEntry;
    const newStart = arg.event.startStr.slice(11, 16);
    const newEnd = arg.event.endStr?.slice(11, 16) || entry.end_time;
    // Date might change too
    const newDate = arg.event.startStr.slice(0, 10);
    const updated = { ...entry, entry_date: newDate, start_time: newStart, end_time: newEnd };
    api.put(`/entries/${entry.id}`, updated)
      .then(({ data }) => onEntryUpdated(data))
      .catch(() => arg.revert());
  }, [onEntryUpdated]);

  return (
    <div className="card" style={{ padding: '16px' }}>
      <FullCalendar
        ref={calRef}
        plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,timeGridDay',
        }}
        locale="de"
        firstDay={1}
        slotMinTime="06:00:00"
        slotMaxTime="22:00:00"
        slotDuration="00:15:00"
        slotLabelInterval="01:00"
        height="auto"
        allDaySlot={false}
        selectable
        selectMirror
        editable
        eventResizableFromStart={false}
        select={handleSelect}
        eventClick={handleEventClick}
        eventResize={handleEventResize}
        eventDrop={handleEventDrop}
        events={entries.map(toCalendarEvent)}
        nowIndicator
        buttonText={{ today: 'Heute', month: 'Monat', week: 'Woche', day: 'Tag' }}
      />
    </div>
  );
}
