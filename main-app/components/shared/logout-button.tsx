'use client'

import { Button } from '@/components/ui/button'
import { clearChatbotSessionStorage } from '@/lib/chatbot/session'

export function LogoutButton() {
  const logout = async () => {
    clearChatbotSessionStorage()
    window.location.assign('/auth/logout')
  }

  return <Button onClick={logout}>Logout</Button>
}
