import type { ButtonProps } from '@mui/material';

// What an operator can do in each line state. Each action is shown while the line's
// current state is one of `from`. 'report' opens the report dialog instead of
// sending a state directly.

export interface LineAction {
  label: string;
  /** State sent to the backend, or 'report' for the report dialog */
  send: string;
  color: ButtonProps['color'];
  from: string[];
}

const producing = ['run', 'resume fault', 'report'];
const ready = ['on', 'stop', 'resume failure'];
const switchedOff = ['off', 'resume out of order'];

export const lineActions: LineAction[] = [
  { label: 'On', send: 'on', color: 'primary', from: switchedOff },
  { label: 'Out of order', send: 'out of order', color: 'error', from: switchedOff },
  { label: 'Resume Out of order', send: 'resume out of order', color: 'error', from: ['out of order'] },
  { label: 'Run', send: 'run', color: 'success', from: ready },
  { label: 'Failure', send: 'failure', color: 'warning', from: ready },
  { label: 'Off', send: 'off', color: 'inherit', from: ready },
  { label: 'Stop', send: 'stop', color: 'primary', from: producing },
  { label: 'Report', send: 'report', color: 'secondary', from: producing },
  { label: 'Fault', send: 'fault', color: 'warning', from: producing },
];

export const actionsFor = (state: string | undefined) =>
  lineActions.filter((action) => state !== undefined && action.from.includes(state));

/** States that must be reported (cell and fault) before the line can go on. */
export const faultStates = ['fault', 'failure', 'out of order'];

/** States in which production (product, quantity, scrap) can be reported. */
export const productionStates = producing;

/** State sent with a report, by current state. */
export const reportState: Record<string, string> = {
  'out of order': 'resume out of order',
  failure: 'resume failure',
  fault: 'resume fault',
  report: 'report',
  run: 'report',
  'resume fault': 'report',
};

/** Color of the current-state banner. */
export const stateColor: Record<string, ButtonProps['color']> = {
  on: 'primary',
  off: 'inherit',
  fault: 'warning',
  'resume fault': 'success',
  failure: 'warning',
  'resume failure': 'primary',
  'out of order': 'error',
  'resume out of order': 'inherit',
  'break in': 'secondary',
  'resume break in': 'success',
  'break out': 'secondary',
  'resume break out': 'primary',
  report: 'success',
  run: 'success',
  stop: 'primary',
};
