import { gameRoute } from '@/lib/game/routes';
import { withApiLogging } from '@/lib/logging/with-api-logging';

export const GET = withApiLogging('game.get', gameRoute(false, 'hub'));
export const POST = withApiLogging('game.post', gameRoute(false, 'hub', true));
