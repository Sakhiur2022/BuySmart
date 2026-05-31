import { redirect } from 'next/navigation';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import AdminChatbotWidget from '@/components/shared/admin-chatbot-widget';
import { createClient } from '@/lib/supabase/server';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  const { data: profile, error: profileError } = await supabase
    .from('users_profile')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(`Failed to load admin profile: ${profileError.message}`);
  }

  if (profile?.role !== 'admin') {
    redirect('/');
  }

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <main className="w-full flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      <AdminChatbotWidget />
    </div>
  );
}
