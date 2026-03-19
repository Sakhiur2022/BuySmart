import { SignUpForm } from '@/components/forms/sign-up-form';

export default function Page() {
  return (
    <div className="w-full max-w-sm">
      <SignUpForm defaultRole="buyer" hideRoleSelect />
    </div>
  );
}
