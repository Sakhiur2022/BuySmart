import { Suspense } from 'react';
import { LoginForm } from '@/components/forms/login-form';

export default function Page() {
  return (
    <div className="w-full max-w-sm">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading login...</p>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
