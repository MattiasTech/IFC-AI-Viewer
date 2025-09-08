// src/utils/crypto.js
const enc = new TextEncoder();
const dec = new TextDecoder();

async function deriveKey(passphrase, salt) {
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(passphrase), { name: 'PBKDF2' }, false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function storeSecret(name, secret, passphrase) {
  if (!passphrase) { localStorage.setItem(name, secret); return; }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(secret));
  const b64 = btoa(String.fromCharCode(...new Uint8Array(ct)));
  localStorage.setItem(`${name}:salt`, btoa(String.fromCharCode(...salt)));
  localStorage.setItem(`${name}:iv`, btoa(String.fromCharCode(...iv)));
  localStorage.setItem(name, b64);
}

export async function loadSecret(name, passphrase) {
  if (!passphrase) return localStorage.getItem(name) || '';
  const atobU8 = s => new Uint8Array([...atob(s)].map(c => c.charCodeAt(0)));
  const salt = atobU8(localStorage.getItem(`${name}:salt`) || '');
  const iv   = atobU8(localStorage.getItem(`${name}:iv`) || '');
  const blob = atobU8(localStorage.getItem(name) || '');
  if (!salt.length || !iv.length || !blob.length) return '';
  const key = await deriveKey(passphrase, salt);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, blob);
  return dec.decode(new Uint8Array(pt));
}

export function forgetSecret(name) {
  localStorage.removeItem(name);
  localStorage.removeItem(`${name}:salt`);
  localStorage.removeItem(`${name}:iv`);
}
