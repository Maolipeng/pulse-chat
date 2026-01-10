const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export const bufferToBase64 = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
};

export const base64ToBuffer = (base64) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};

export const randomBytes = (length) => {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
};

export const generateIdentityKeyPair = async () => {
  return crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  );
};

export const exportKey = (key) => crypto.subtle.exportKey("jwk", key);

export const importPrivateKey = (jwk) =>
  crypto.subtle.importKey("jwk", jwk, { name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);

export const importPublicKey = (jwk) =>
  crypto.subtle.importKey("jwk", jwk, { name: "ECDH", namedCurve: "P-256" }, true, []);

export const deriveBits = async (privateKey, publicKey) => {
  return crypto.subtle.deriveBits({ name: "ECDH", public: publicKey }, privateKey, 256);
};

export const hkdf = async (inputKeyMaterial, salt, info, length = 32) => {
  const hkdfKey = await crypto.subtle.importKey(
    "raw",
    inputKeyMaterial,
    "HKDF",
    false,
    ["deriveBits"],
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt,
      info,
    },
    hkdfKey,
    length * 8,
  );

  return new Uint8Array(bits);
};

export const sha256 = async (data) => {
  const hash = await crypto.subtle.digest("SHA-256", data);
  return new Uint8Array(hash);
};

export const encryptAesGcm = async (rawKey, plaintext) => {
  const key = await crypto.subtle.importKey("raw", rawKey, "AES-GCM", false, ["encrypt"]);
  const iv = randomBytes(12);
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    textEncoder.encode(plaintext),
  );
  return {
    iv: bufferToBase64(iv),
    ciphertext: bufferToBase64(cipher),
  };
};

export const decryptAesGcm = async (rawKey, ciphertext, iv) => {
  const key = await crypto.subtle.importKey("raw", rawKey, "AES-GCM", false, ["decrypt"]);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(base64ToBuffer(iv)) },
    key,
    base64ToBuffer(ciphertext),
  );
  return textDecoder.decode(decrypted);
};

export const storeJson = (key, value) => {
  window.localStorage.setItem(key, JSON.stringify(value));
};

export const loadJson = (key) => {
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
};
