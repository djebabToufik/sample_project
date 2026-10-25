// Dates between the backend and date/time inputs.
//
// The backend sends dates with their time zone ("2026-01-05T08:00:00+01:00") and
// accepts them back the same way. Inputs work in the user's local time without a
// zone ("2026-01-05T08:00"). Converting both ways keeps the time right for users
// in any time zone, whatever zone the server uses.

const pad = (n: number) => String(n).padStart(2, '0');

/** A date as local `YYYY-MM-DDTHH:mm` (or `YYYY-MM-DDTHH:mm:ss` with `seconds`). */
export function toLocalInputValue(date: Date, seconds = false): string {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}` +
    (seconds ? `:${pad(date.getSeconds())}` : '')
  );
}

const LOCAL_INPUT = /^\d{4}-\d\d-\d\dT\d\d:\d\d(:\d\d)?$/;

/**
 * Value for a datetime-local input. A date from the backend is shown in local
 * time; a value that already is local (e.g. a clicked calendar slot) is kept.
 */
export function toInputValue(value: string | null | undefined): string {
  if (!value) return '';
  if (LOCAL_INPUT.test(value)) return value.slice(0, 16);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : toLocalInputValue(date);
}

/** Input value (local time) as an ISO date with time zone for the backend; '' stays ''. */
export function fromInputValue(value: string): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}
