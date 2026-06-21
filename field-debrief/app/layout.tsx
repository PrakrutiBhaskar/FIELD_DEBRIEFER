import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/navbar'
import { validateEnv } from '@/lib/env'
import { ToastProvider } from '@/components/toast'


validateEnv()

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Field Debrief — The/Nudge Foundation',
  description: 'AI-powered field visit debrief tool',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={geist.className}>
        <Navbar />
        {children}
        <ToastProvider />
      </body>
    </html>
  )
}