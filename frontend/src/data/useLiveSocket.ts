import { useEffect, useState } from 'react';

import { wsurl } from '../Config';

/** Waiting time before reconnect attempt n (0-based): 1 s, 2 s, 4 s ... up to 30 s. */
export const reconnectDelay = (attempt: number) => Math.min(30_000, 1000 * 2 ** attempt);

/**
 * Live data of one line from a backend WebSocket channel (e.g. 'machine-oee').
 * Returns the latest message, or undefined until the first one arrives.
 *
 * - Opens `/ws/<channel>/?machine=…` (the browser sends the session cookie) and closes it
 *   when the page is left or the line changes.
 * - Reconnects after the connection drops (backend restart, network loss),
 *   waiting longer after each failed attempt.
 */
export function useLiveSocket<T>(channel: string, machine: string | undefined): T | undefined {
  const [latest, setLatest] = useState<{ channel: string; machine: string; data: T }>();

  useEffect(() => {
    if (!machine) return;
    let socket: WebSocket | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    let stopped = false;

    const connect = () => {
      const query = new URLSearchParams({ machine });
      socket = new WebSocket(`${wsurl}/ws/${channel}/?${query}`);
      socket.onopen = () => {
        attempt = 0;
      };
      socket.onmessage = (event) => {
        try {
          setLatest({ channel, machine, data: JSON.parse(event.data) as T });
        } catch {
          // Not JSON: ignore the message.
        }
      };
      socket.onclose = () => {
        if (stopped) return;
        timer = setTimeout(connect, reconnectDelay(attempt++));
      };
    };

    connect();
    return () => {
      stopped = true;
      clearTimeout(timer);
      socket?.close();
    };
  }, [channel, machine]);

  // A message from the previous line is not shown for the new one.
  return latest?.channel === channel && latest.machine === machine ? latest.data : undefined;
}
