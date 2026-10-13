import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {title:'Dots 진행상황',description:'Dots가 하는 일, 기다리는 이유, 다음 행동을 한눈에.',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="ko"><body>{children}</body></html>; }
