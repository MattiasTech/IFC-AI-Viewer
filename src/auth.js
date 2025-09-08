// src/auth.js
// Minimal MSAL SPA (PKCE) setup for Entra ID
// Fill these placeholders in README step.
const tenantId = 'YOUR_TENANT_ID';
const clientId = 'YOUR_APP_CLIENT_ID'; // "App registration" → Application (client) ID
const authority = `https://login.microsoftonline.com/${tenantId}`;

const msalConfig = {
  auth: {
    clientId,
    authority,
    redirectUri: window.location.origin
  },
  cache: {
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: false
  }
};

export const msalInstance = new window.msal.PublicClientApplication(msalConfig);

export async function handleRedirect() {
  await msalInstance.handleRedirectPromise().catch(console.error);
  const accounts = msalInstance.getAllAccounts();
  if (accounts.length) msalInstance.setActiveAccount(accounts[0]);
  return getAccount();
}

export function getAccount() {
  return msalInstance.getActiveAccount() || null;
}

export function signIn() {
  return msalInstance.loginRedirect({
    scopes: [], // no resource scopes needed for local app; we only need ID token
    prompt: 'select_account'
  });
}

export function signOut() {
  const account = msalInstance.getActiveAccount();
  return msalInstance.logoutRedirect({ account });
}
