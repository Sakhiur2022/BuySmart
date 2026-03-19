import { Suspense } from 'react';
import { SignUpForm } from '@/components/forms/sign-up-form';

export default function Page() {
  return (
    <div className="w-full max-w-sm">
      <Suspense fallback={<p className="text-center text-muted-foreground">Loading...</p>}>
        <SignUpForm defaultRole="buyer" hideRoleSelect />
      </Suspense>
    </div>
  );
}
