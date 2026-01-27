/// <reference types="vite/client" />

/**
 * Application Configuration
 * Centralized configuration to avoid circular dependencies
 */
export const BASE_URL = import.meta.env.DEV
    ? "http://localhost:5000"
    : (import.meta.env.VITE_API_URL || "https://aiproductrecommenderapi1-production.up.railway.app");
