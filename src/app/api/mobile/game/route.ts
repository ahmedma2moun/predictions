import { gameRoute } from '@/lib/game/routes';

export const GET = gameRoute(true, 'hub');
export const POST = gameRoute(true, 'hub', true);
