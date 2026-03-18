'use client'

import { Button } from '@/components/ui/button'

export function LogoutButton() {
  const logout = async () => {
    window.location.assign('/auth/logout')
  }

  return <Button onClick={logout}>Logout</Button>
}
