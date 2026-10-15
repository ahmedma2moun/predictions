import { handlers } from '@/lib/auth';
import { withApiLogging } from '@/lib/logging/with-api-logging';

export const GET = withApiLogging('auth.nextauth.get', handlers.GET);
export const POST = withApiLogging('auth.nextauth.post', handlers.POST);
