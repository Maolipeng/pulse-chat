export const isPrivateHost = (hostname) => {
  if (!hostname) return false;
  if (hostname === "localhost" || hostname === "127.0.0.1") return true;
  if (hostname.startsWith("192.168.")) return true;
  if (hostname.startsWith("10.")) return true;
  if (hostname.startsWith("172.")) {
    const parts = hostname.split(".");
    const second = Number(parts[1]);
    return second >= 16 && second <= 31;
  }
  return false;
};

export const resolveSocketUrl = () => {
  if (process.env.NEXT_PUBLIC_SOCKET_URL) {
    return process.env.NEXT_PUBLIC_SOCKET_URL;
  }

  if (typeof window !== "undefined") {
    if (isPrivateHost(window.location.hostname)) {
      return `http://${window.location.hostname}:3001`;
    }
    return window.location.origin;
  }

  return "http://localhost:3001";
};

export const resolveApiUrl = () => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (process.env.NEXT_PUBLIC_SOCKET_URL) {
    return process.env.NEXT_PUBLIC_SOCKET_URL;
  }
  if (typeof window !== "undefined") {
    if (isPrivateHost(window.location.hostname)) {
      return `http://${window.location.hostname}:3001`;
    }
    return window.location.origin;
  }
  return "http://localhost:3001";
};

export const formatTime = (timestamp) => {
  if (!timestamp) return "";
  return new Date(timestamp).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const getInitials = (name) => {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
};

export const getAvatarColor = (name) => {
  if (!name) return "#e0f2e9";
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 65%, 85%)`;
};

export const parseUserList = (value) => {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
};

export const parseUrls = (value) => {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

export const getIceServers = () => {
  const stunUrls = parseUrls(process.env.NEXT_PUBLIC_STUN_URLS);
  const turnUrls = parseUrls(process.env.NEXT_PUBLIC_TURN_URLS);
  const servers = [];

  if (stunUrls.length) {
    servers.push({ urls: stunUrls });
  } else {
    servers.push({
      urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"],
    });
  }

  if (turnUrls.length) {
    servers.push({
      urls: turnUrls,
      username: process.env.NEXT_PUBLIC_TURN_USERNAME || "",
      credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL || "",
    });
  }

  return servers;
};
