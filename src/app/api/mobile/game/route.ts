import { gameRoute } from '@/lib/game/routes';
import { withApiLogging } from '@/lib/logging/with-api-logging';

export const GET = withApiLogging('mobile.game.get', gameRoute(true, 'hub'));
export const POST = withApiLogging('mobile.game.post', gameRoute(true, 'hub', true));
