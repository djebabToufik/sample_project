"""
OEE of a line over a period, from its events.

Each pair below is a state the line enters with the first event and leaves with the second
(run ... stop, fault ... resume fault). A state can already be open when the period starts
(`open_states`), and still open when it ends: it counts up to the end of the period, or now.
"""

from datetime import UTC, timedelta

PAIRS = {
    'out_of_order_duration': ('out of order', 'resume out of order'),
    'machine_failure_duration': ('failure', 'resume failure'),
    'machine_break_out_duration': ('break out', 'resume break out'),
    'machine_break_in_duration': ('break in', 'resume break in'),
    'machine_fault_duration': ('fault', 'resume fault'),
    'machine_run_duration': ('run', 'stop'),
    'machine_on_duration': ('on', 'off'),
}
STARTS = {start: key for key, (start, _end) in PAIRS.items()}
ENDS = {end: start for start, end in PAIRS.values()}


def hours(delta):
    return delta.total_seconds() / 3600


def open_states(line_events, moment):
    """The states of PAIRS open at `moment`: their last event before it is the start, not the end."""
    latest = dict(
        line_events.filter(created_at__lt=moment)
        .order_by('state', '-created_at')
        .distinct('state')
        .values_list('state', 'created_at')
    )
    return {
        start for start, end in PAIRS.values() if start in latest and (end not in latest or latest[start] > latest[end])
    }


def apply_events(open_at_start, events):
    """The open states after `events` (sorted by time)."""
    current = set(open_at_start)
    for event in events:
        if event.state in STARTS:
            current.add(event.state)
        elif event.state in ENDS:
            current.discard(ENDS[event.state])
    return current


def durations(events, t_1, t_2, open_at_start):
    """Hours spent in each state of PAIRS between t_1 and t_2 (`events`: those of the period)."""
    # In UTC: Python subtracts two times of the same time zone by their clock reading, which is
    # an hour off across a daylight saving change.
    t_1, t_2 = t_1.astimezone(UTC), t_2.astimezone(UTC)
    since = dict.fromkeys(open_at_start, t_1)
    totals = dict.fromkeys(PAIRS, 0.0)
    for event in sorted(events, key=lambda e: e.created_at):
        moment = min(max(event.created_at, t_1), t_2)
        if event.state in STARTS:
            since.setdefault(event.state, moment)  # a repeated start changes nothing
        elif event.state in ENDS and ENDS[event.state] in since:
            start = ENDS[event.state]
            totals[STARTS[start]] += hours(moment - since.pop(start))
    for start, moment in since.items():
        totals[STARTS[start]] += max(hours(t_2 - moment), 0)
    return totals


def ratio(value, total):
    """value / total between 0 and 1, or None (no data) when total is 0."""
    if total <= 0:
        return None
    return min(max(value / total, 0), 1)


def calculate_oee(events, t_1, t_2, now, open_at_start=()):
    """
    OEE between t_1 and t_2 (never after now). `events`: the line's events of the period,
    `open_at_start`: the states open at t_1 (open_states). Durations are in hours; a ratio is
    None when there is nothing to measure it on, and so is the OEE without production time.
    """
    t_2 = min(t_2, now)
    events = list(events)
    times = durations(events, t_1, t_2, open_at_start)

    total_quantity = 0
    total_scrap = 0
    ideal_production_minutes = 0
    for report in events:
        if report.state == 'report' and report.product:
            total_quantity += report.quantity
            total_scrap += report.scrap
            ideal_production_minutes += report.quantity * report.product.ideal_cycle

    # Faults and breaks in happen while running; failures stop a line that should be running.
    run = times['machine_run_duration']
    planned_production_time = run - times['machine_break_in_duration'] + times['machine_failure_duration']
    run_time = planned_production_time - times['machine_fault_duration'] - times['machine_failure_duration']

    availability = ratio(run_time, planned_production_time)
    performance = ratio(ideal_production_minutes / 60, run_time)
    quality = ratio(total_quantity - total_scrap, total_quantity)
    if availability is None:
        oee = None
    else:
        # Performance is only missing when availability is 0, quality when nothing was reported.
        oee = availability * (1 if performance is None else performance) * (1 if quality is None else quality) * 100

    return {
        'availability': availability,
        'performance': performance,
        'quality': quality,
        **times,
        'oee': oee,
    }


def hourly_oee(line_events, now, count=24):
    """OEE of each of the last `count` hours, oldest first (two queries)."""
    start = now - timedelta(hours=count)
    current = open_states(line_events, start)
    events = list(line_events.filter(created_at__gte=start, created_at__lte=now).order_by('created_at'))
    result = []
    for i in range(count):
        t_1, t_2 = start + timedelta(hours=i), start + timedelta(hours=i + 1)
        hour = [e for e in events if t_1 <= e.created_at < t_2 or (i == count - 1 and e.created_at == t_2)]
        result.append(calculate_oee(hour, t_1, t_2, now, current))
        current = apply_events(current, hour)
    return result


longest_sequences = {
    'off': [
        'off',
        'out of order',
        'resume out of order',
        'on',
        'failure',
        'resume failure',
        'run',
        'fault',
        'resume fault',
        'report',
        'stop',
    ],
    'out of order': [
        'out of order',
        'resume out of order',
        'on',
        'failure',
        'resume failure',
        'run',
        'fault',
        'resume fault',
        'report',
        'stop',
        'off',
    ],
    'resume out of order': [
        'resume out of order',
        'on',
        'failure',
        'resume failure',
        'run',
        'fault',
        'resume fault',
        'report',
        'stop',
        'off',
    ],
    'on': [
        'on',
        'failure',
        'resume failure',
        'run',
        'fault',
        'resume fault',
        'report',
        'stop',
        'off',
        'out of order',
        'resume out of order',
    ],
    'failure': [
        'failure',
        'resume failure',
        'run',
        'fault',
        'resume fault',
        'report',
        'stop',
        'off',
        'out of order',
        'resume out of order',
        'on',
    ],
    'resume failure': [
        'resume failure',
        'run',
        'fault',
        'resume fault',
        'report',
        'stop',
        'off',
        'out of order',
        'resume out of order',
        'on',
    ],
    'run': [
        'run',
        'fault',
        'resume fault',
        'report',
        'stop',
        'off',
        'out of order',
        'resume out of order',
        'on',
        'failure',
        'resume failure',
    ],
    'fault': [
        'fault',
        'resume fault',
        'report',
        'stop',
        'off',
        'out of order',
        'resume out of order',
        'on',
        'failure',
        'resume failure',
        'run',
    ],
    'resume fault': [
        'resume fault',
        'report',
        'stop',
        'off',
        'out of order',
        'resume out of order',
        'on',
        'failure',
        'resume failure',
        'run',
    ],
    # A break while running (break in) is filled like a fault, a break while on but not
    # running (break out) like a failure.
    'break in': [
        'break in',
        'resume break in',
        'report',
        'stop',
        'off',
        'out of order',
        'resume out of order',
        'on',
        'failure',
        'resume failure',
        'run',
    ],
    'resume break in': [
        'resume break in',
        'report',
        'stop',
        'off',
        'out of order',
        'resume out of order',
        'on',
        'failure',
        'resume failure',
        'run',
    ],
    'break out': [
        'break out',
        'resume break out',
        'run',
        'fault',
        'resume fault',
        'report',
        'stop',
        'off',
        'out of order',
        'resume out of order',
        'on',
    ],
    'resume break out': [
        'resume break out',
        'run',
        'fault',
        'resume fault',
        'report',
        'stop',
        'off',
        'out of order',
        'resume out of order',
        'on',
    ],
    'report': [
        'report',
        'stop',
        'off',
        'out of order',
        'resume out of order',
        'on',
        'failure',
        'resume failure',
        'run',
        'fault',
        'resume fault',
    ],
    'stop': [
        'stop',
        'off',
        'out of order',
        'resume out of order',
        'on',
        'failure',
        'resume failure',
        'run',
        'fault',
        'resume fault',
        'report',
    ],
}
allowed_to_skip_fill = {
    'on': ['off', 'resume out of order'],
    'off': ['on', 'resume failure', 'resume break out', 'stop'],
    'run': ['on', 'stop', 'resume failure', 'resume break out'],
    'stop': ['run', 'resume break in', 'resume fault', 'report'],
    'break in': ['run', 'resume break in', 'resume fault', 'report'],
    'resume break in': ['break in'],
    'failure': ['on', 'resume failure', 'resume break out', 'stop'],
    'resume failure': ['failure'],
    'report': ['run', 'report', 'resume fault', 'resume break in'],
    'fault': ['run', 'resume fault', 'resume break in', 'report'],
    'resume fault': ['fault'],
    'break out': ['on', 'resume break out', 'resume failure', 'stop'],
    'resume break out': ['break out'],
    'out of order': ['off', 'resume out of order'],
    'resume out of order': ['out of order'],
}
needed_req = {
    'on': ['off'],
    'off': ['stop'],
    'run': ['on'],
    'stop': ['run'],
    'break in': ['run', 'on'],
    'resume break in': ['break in', 'on', 'run'],
    'failure': ['on'],
    'resume failure': ['failure', 'on'],
    'report': ['run', 'on'],
    'fault': ['run', 'on'],
    'resume fault': ['fault', 'on', 'run'],
    'break out': ['on'],
    'resume break out': ['break out', 'on'],
    'out of order': ['off'],
    'resume out of order': ['out of order', 'off', 'stop'],
}


def get_missing_states(last_state, new_state):

    required_states = []
    sequence = longest_sequences[last_state]

    if new_state in sequence:
        current_state_index = sequence.index(last_state)
        new_state_index = sequence.index(new_state)

        if new_state_index > current_state_index:
            required_states = sequence[current_state_index + 1 : new_state_index]
        else:
            required_states = sequence[current_state_index + 1 :]

    return required_states
