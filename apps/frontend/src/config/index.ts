function getRequiredEnv(name: string): string {
	const value = process.env[name];
	if (!value) {
		throw new Error(`Missing required environment variable: ${name}`);
	}
	return value;
}

export const API_URL = getRequiredEnv("NEXT_PUBLIC_API_URL");
export const WS_URL = getRequiredEnv("NEXT_PUBLIC_WS_URL");
export const APP_URL = getRequiredEnv("NEXT_PUBLIC_APP_URL");
