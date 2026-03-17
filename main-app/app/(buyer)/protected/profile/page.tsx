import { redirect } from 'next/navigation';

export default function ProtectedProfileRedirect() {
  redirect('/profile');
}
