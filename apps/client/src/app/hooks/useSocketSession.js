"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { resolveSocketUrl } from "../utils/chat-utils";

export default function useSocketSession({ token }) {
  const socketRef = useRef(null);
  const [socket, setSocket] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState("offline");
  const [usersOnline, setUsersOnline] = useState([]);

  useEffect(() => {
    if (!token) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setConnectionStatus("offline");
      setUsersOnline([]);
      setSocket(null);
      return;
    }

    const socket = io(resolveSocketUrl(), {
      auth: { token },
    });
    socketRef.current = socket;
    setSocket(socket);

    socket.on("connect", () => {
      setConnectionStatus("online");
    });

    socket.on("disconnect", () => {
      setConnectionStatus("offline");
    });

    socket.on("users:update", ({ users: onlineUsers }) => {
      setUsersOnline(onlineUsers || []);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setSocket(null);
    };
  }, [token]);

  return useMemo(
    () => ({
      socket,
      socketRef,
      connectionStatus,
      usersOnline,
    }),
    [connectionStatus, socket, usersOnline],
  );
}
