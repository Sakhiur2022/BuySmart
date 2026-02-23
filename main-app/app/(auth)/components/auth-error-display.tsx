'use client';

type AuthErrorDisplayProps = {
  message: string;
};

export function AuthErrorDisplay({ message }: AuthErrorDisplayProps) {
  return <p className="text-sm text-destructive">{message}</p>;
}
