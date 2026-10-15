import { gameRoute } from '@/lib/game/routes';
import { withApiLogging } from '@/lib/logging/with-api-logging';

export const GET = withApiLogging('mobile.predictions.slip.get', gameRoute(true, 'slip'));
export const POST = withApiLogging('mobile.predictions.slip.post', gameRoute(true, 'slip', true));
