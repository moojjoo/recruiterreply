/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface AppRuntimeConfig {
  readonly API_BASE_URL?: string;
}

interface Window {
  __APP_CONFIG__?: AppRuntimeConfig;
}
