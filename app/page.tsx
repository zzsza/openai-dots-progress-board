import Board from './board';
export const dynamic = 'force-dynamic';
export default function Home() { return <Board initialNow={Date.now()}/>; }
