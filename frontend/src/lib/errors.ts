import { ApiRequestError } from '@/api/jellyfin';

export function toUserMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiRequestError) {
    return error.message || fallback;
  }

  if (error instanceof Error) {
    return error.message || fallback;
  }

  return fallback;
}
