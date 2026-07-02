"use client";

import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

import { API_BASE_URL } from "@/lib/api";
import { WORKFLOW_EVENTS, type WorkflowEventMap } from "@/lib/events";

export type SocketEventHandlers = {
  [E in keyof WorkflowEventMap]?: (payload: WorkflowEventMap[E]) => void;
};

export interface UseSocketOptions {
  /** Skip the connection entirely (e.g. signed-out or customer views). */
  enabled?: boolean;
}

export interface UseSocketResult {
  connected: boolean;
}

/**
 * Subscribes to the authenticated `/events` namespace over a single Socket.io
 * connection. Auth rides the HTTP-only cookie via `withCredentials`. The socket
 * is created once and fully torn down on unmount; handlers are read through a
 * ref, so re-renders never reconnect or double-bind listeners.
 */
export function useSocket(
  handlers: SocketEventHandlers = {},
  { enabled = true }: UseSocketOptions = {},
): UseSocketResult {
  const handlersRef = useRef(handlers);
  // Keep the latest handlers reachable from the socket listeners without
  // forcing a reconnect on every render.
  useEffect(() => {
    handlersRef.current = handlers;
  });

  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const socket: Socket = io(`${API_BASE_URL}/events`, {
      // Send the first-party auth cookie on the cross-origin handshake. The
      // default polling->websocket upgrade is used deliberately: the credentialed
      // polling handshake reliably carries the cookie, then upgrades to a socket.
      withCredentials: true,
    });

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    const listeners = Object.values(WORKFLOW_EVENTS).map((name) => {
      const listener = (payload: unknown) => {
        handlersRef.current[name]?.(payload as never);
      };
      socket.on(name, listener);
      return [name, listener] as const;
    });

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      for (const [name, listener] of listeners) {
        socket.off(name, listener);
      }
      socket.disconnect();
    };
  }, [enabled]);

  return { connected };
}
