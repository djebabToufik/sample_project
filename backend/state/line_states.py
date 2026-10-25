"""
Machine states sent by other software, e.g. the gateway reading the PLCs: POST /api/line-states/.

The software reports the state the machine is in (off, out of order, on, failure, run, fault) and when it started.
The server writes the events that lead there from the pairs open on the line (see PAIRS in util.py): it closes
the pairs the new state does not have, innermost first, then opens the ones it adds. Example: fault -> off gives
resume fault, stop, off. A break entered by an operator stays open as long as the pair it belongs to (break in:
run, break out: on), and is closed with it.

Event order: every query reads a line's events in time order (created_at). The events of one change happen at
the same moment, so each one is saved 1 microsecond after the line's previous event: the time order stays the
order they were written in. This is the only place that writes events with a time other than "now".
"""

import logging
from datetime import datetime, timedelta

from django.db import transaction
from django.utils import timezone

from db.models import Asset

from .models import Event
from .util import PAIRS, open_states

logger = logging.getLogger(__name__)

# The pairs open in each machine state.
MACHINE_STATES = {
    'off': frozenset(),
    'out of order': frozenset({'out of order'}),
    'on': frozenset({'on'}),
    'failure': frozenset({'on', 'failure'}),
    'run': frozenset({'on', 'run'}),
    'fault': frozenset({'on', 'run', 'fault'}),
}
# The states other software can send (POST /api/line-states/).
MACHINE_STATE_NAMES = list(MACHINE_STATES)

# The pair each pair is nested in: a line runs only while it is on, a fault happens while it runs.
PARENT = {'run': 'on', 'failure': 'on', 'break out': 'on', 'fault': 'run', 'break in': 'run'}
BREAKS = ('break in', 'break out')
# Innermost first.
CLOSE_ORDER = ('fault', 'break in', 'run', 'failure', 'break out', 'on', 'out of order')
OPEN_ORDER = ('out of order', 'on', 'run', 'failure', 'fault')
CLOSING_EVENT = {start: end for start, end in PAIRS.values()}

STEP = timedelta(microseconds=1)
# A time moved by more than this is logged: usually the clock of the sending PC is wrong.
LOG_SHIFT_OVER = timedelta(minutes=1)


def events_to(open_pairs, target):
    """The events from a line with `open_pairs` to the machine state `target`, in order ([] = no change)."""
    wanted = MACHINE_STATES[target]
    keep = set(wanted) | {pair for pair in BREAKS if pair in open_pairs and PARENT[pair] in wanted}
    closing = [CLOSING_EVENT[pair] for pair in CLOSE_ORDER if pair in open_pairs and pair not in keep]
    opening = [pair for pair in OPEN_ORDER if pair in wanted and pair not in open_pairs]
    return closing + opening


def first_event_time(occurred_at: datetime, last_time: datetime | None, now: datetime) -> datetime:
    """When the first event of a change is saved: `occurred_at`, but never in the future and always after the
    line's last event (a newer event exists: the line's history cannot change before it)."""
    moment = min(occurred_at, now)
    if last_time is not None and moment <= last_time:
        moment = last_time + STEP
    return moment


def record_machine_state(machine: Asset, target: str, occurred_at: datetime) -> list[Event]:
    """Saves the events that bring `machine` to `target`. Returns them ([] when it already is in that state)."""
    # One change at a time per line: the row lock makes a second request wait until this one is saved.
    with transaction.atomic():
        Asset.objects.select_for_update().filter(pk=machine.pk).first()
        line_events = Event.objects.filter(machine=machine)
        last = line_events.order_by('-created_at').first()
        open_pairs = open_states(line_events, last.created_at + STEP) if last else set()
        states = events_to(open_pairs, target)
        if not states:
            return []

        moment = first_event_time(occurred_at, last.created_at if last else None, timezone.now())
        if abs(moment - occurred_at) > LOG_SHIFT_OVER:
            logger.warning(
                'Line %s: state %s sent for %s, saved at %s (not in the future, after the line\'s last event)',
                machine.uuid,
                target,
                occurred_at.isoformat(),
                moment.isoformat(),
            )
        # The last event is the one reported; the ones before it are filled in (one live update for all).
        return [
            Event.objects.create(
                machine=machine, state=state, created_at=moment + index * STEP, is_filled=index < len(states) - 1
            )
            for index, state in enumerate(states)
        ]
