/**
 * Where the server lives. The iOS Simulator reaches the Mac at localhost.
 * On a real phone set EXPO_PUBLIC_API_URL in apps/mobile/.env to your Mac's address, for example http://192.168.1.20:3000
 */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000").replace(/\/$/, "");

/**
 * The website. The app opens its /app-check page in a hidden web view for the bot check (lib/captcha.ts). Empty
 * switches the check off in the app. In the Simulator the local website is http://localhost:3001.
 */
export const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL?.trim().replace(/\/$/, "") || undefined;
