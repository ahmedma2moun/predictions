import { gameRoute } from '@/lib/game/routes';

export const GET = gameRoute(false, 'hub');
export const POST = gameRoute(false, 'hub', true);
