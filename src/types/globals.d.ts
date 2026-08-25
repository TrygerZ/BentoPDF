/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_USE_CDN?: string;
  readonly VITE_WASM_PYMUPDF_URL?: string;
  readonly VITE_WASM_GS_URL?: string;
  readonly VITE_WASM_CPDF_URL?: string;
  readonly VITE_TESSERACT_WORKER_URL?: string;
  readonly VITE_TESSERACT_CORE_URL?: string;
  readonly VITE_TESSERACT_LANG_URL?: string;
  readonly VITE_TESSERACT_AVAILABLE_LANGUAGES?: string;
  readonly VITE_OCR_FONT_BASE_URL?: string;
  readonly VITE_EMBEDPDF_FONTS_URL?: string;
  readonly VITE_CORS_PROXY_URL?: string;
  readonly VITE_CORS_PROXY_SECRET?: string;
  readonly VITE_DEFAULT_LANGUAGE?: string;
  readonly VITE_BRAND_NAME?: string;
  readonly VITE_BRAND_LOGO?: string;
  readonly VITE_FOOTER_TEXT?: string;
  readonly BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare const __SIMPLE_MODE__: boolean;
declare const __DISABLE_GITHUB_STARS__: boolean;
declare const __DISABLED_TOOLS__: string[];
declare const __ENGINE_VERSION__: string;
