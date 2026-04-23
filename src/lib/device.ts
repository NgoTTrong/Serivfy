"use client";

const KEY_DEVICE = "servify_device_id";
const KEY_GUEST_PREFIX = "servify_guest_"; // per-session

export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(KEY_DEVICE);
  if (!id) {
    id = `dev_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    localStorage.setItem(KEY_DEVICE, id);
  }
  return id;
}

export function getGuestId(sessionToken: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(KEY_GUEST_PREFIX + sessionToken);
}

export function setGuestId(sessionToken: string, guestId: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY_GUEST_PREFIX + sessionToken, guestId);
}
