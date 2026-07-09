/// <reference types="vite/client" />

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      // Server configuration
      NODE_ENV: 'development' | 'production' | 'test';
      PORT?: string;

      // JWT configuration
      JWT_SECRET: string;

      // SMTP configuration
      SMTP_USER?: string;
      SMTP_PASS?: string;
      SMTP_HOST?: string;
      SMTP_PORT?: string;
      SMTP_FROM?: string;
      SMTP_SECURE?: string;

      // App configuration
      APP_URL?: string;
      FRONTEND_URL?: string;
      API_URL?: string;
      HMR_PORT?: string;
      DATABASE_URL?: string;

      // SSL configuration
      SSL_KEY_PATH?: string;
      SSL_CERT_PATH?: string;

      // Vite environment variables
      VITE_API_BASE_URL?: string;
    }
  }

  namespace Express {
    interface Request {
      user?: {
        id?: string;
        role?: string;
        [key: string]: any;
      };
      body: any;
      params: Record<string, any>;
      query: Record<string, any>;
    }
  }

  interface Window {
    // Add any global window properties your app uses
  }
}

export {};
