import { gameRoute } from '@/lib/game/routes';
import { withApiLogging } from '@/lib/logging/with-api-logging';

export const GET = withApiLogging('predictions.slip.get', gameRoute(false, 'slip'));
export const POST = withApiLogging('predictions.slip.post', gameRoute(false, 'slip', true));
