'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { createClient } from '@/lib/supabase/client';

type UserProfileFormProps = {
  userId: string;
  email: string;
  initialProfile: {
    fullName: string;
    displayName: string;
    avatarUrl: string;
    phone: string;
    role: string;
    profileCompleted: boolean;
    updatedAt: string | null;
  };
};

function toNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getInitials(value: string): string {
  const parts = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return 'BS';
  }

  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('');
}

function formatRole(role: string): string {
  if (!role) {
    return 'Buyer';
  }

  return role.charAt(0).toUpperCase() + role.slice(1);
}

export function UserProfileForm({ userId, email, initialProfile }: UserProfileFormProps) {
  const router = useRouter();
  const [fullName, setFullName] = useState(initialProfile.fullName);
  const [displayName, setDisplayName] = useState(initialProfile.displayName);
  const [phone, setPhone] = useState(initialProfile.phone);
  const [avatarUrl, setAvatarUrl] = useState(initialProfile.avatarUrl);
  const [profileCompleted, setProfileCompleted] = useState(initialProfile.profileCompleted);
  const [updatedAt, setUpdatedAt] = useState<string | null>(initialProfile.updatedAt);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const identityName = displayName.trim() || fullName.trim() || email;
  const initials = getInitials(identityName);

  const lastUpdated = useMemo(() => {
    if (!updatedAt) {
      return 'Never updated';
    }

    const date = new Date(updatedAt);
    if (Number.isNaN(date.getTime())) {
      return 'Unknown';
    }

    return date.toLocaleString();
  }, [updatedAt]);

  const handleCancel = () => {
    setFullName(initialProfile.fullName);
    setDisplayName(initialProfile.displayName);
    setPhone(initialProfile.phone);
    setAvatarUrl(initialProfile.avatarUrl);
    setProfileCompleted(initialProfile.profileCompleted);
    setUpdatedAt(initialProfile.updatedAt);
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsEditing(false);
  };

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const normalizedPhone = phone.trim();
    if (normalizedPhone && !/^[+0-9()\-\s]{7,20}$/.test(normalizedPhone)) {
      setErrorMessage('Phone number can contain only digits, spaces, parentheses, + or -.');
      setIsSaving(false);
      return;
    }

    const nextProfileCompleted = Boolean(fullName.trim() && normalizedPhone);

    try {
      const supabase = createClient();
      const now = new Date().toISOString();

      const { error: profileError } = await supabase.from('users_profile').upsert(
        {
          user_id: userId,
          full_name: toNull(fullName),
          display_name: toNull(displayName),
          phone: toNull(phone),
          avatar_url: toNull(avatarUrl),
          profile_completed: nextProfileCompleted,
          updated_at: now,
        },
        { onConflict: 'user_id' },
      );

      if (profileError) {
        throw profileError;
      }

      const { error: authError } = await supabase.auth.updateUser({
        data: {
          full_name: toNull(fullName),
          name: toNull(displayName) ?? toNull(fullName),
          avatar_url: toNull(avatarUrl),
        },
      });

      setProfileCompleted(nextProfileCompleted);
      setUpdatedAt(now);
      setIsEditing(false);

      if (authError) {
        setSuccessMessage('Profile saved, but auth metadata sync failed. Please refresh and retry.');
      } else {
        setSuccessMessage('Profile updated successfully.');
      }

      router.refresh();
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to update profile.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 border">
              {avatarUrl.trim() ? <AvatarImage src={avatarUrl.trim()} alt={identityName} /> : null}
              <AvatarFallback className="text-base font-semibold">{initials}</AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <CardTitle className="text-2xl">{identityName}</CardTitle>
              <CardDescription>{email}</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{formatRole(initialProfile.role)}</Badge>
            <Badge variant={profileCompleted ? 'default' : 'outline'}>
              {profileCompleted ? 'Profile complete' : 'Profile incomplete'}
            </Badge>
          </div>
        </div>

        <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-wide">Account Email</p>
            <p className="mt-1 font-medium text-foreground">{email}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide">Last Updated</p>
            <p className="mt-1 font-medium text-foreground">{lastUpdated}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide">User ID</p>
            <p className="mt-1 truncate font-medium text-foreground">{userId}</p>
          </div>
        </div>
      </CardHeader>

      <Separator />

      <CardContent className="pt-6">
        <form className="space-y-6" onSubmit={handleSave}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input
                id="fullName"
                value={fullName}
                disabled={!isEditing || isSaving}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Enter your full name"
                maxLength={255}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="displayName">Display name</Label>
              <Input
                id="displayName"
                value={displayName}
                disabled={!isEditing || isSaving}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="How should others see your name?"
                maxLength={100}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="phone">Phone number</Label>
              <Input
                id="phone"
                value={phone}
                disabled={!isEditing || isSaving}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="e.g. +880 17XX-XXXXXX"
                maxLength={20}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="avatarUrl">Avatar URL</Label>
              <Input
                id="avatarUrl"
                value={avatarUrl}
                disabled={!isEditing || isSaving}
                onChange={(event) => setAvatarUrl(event.target.value)}
                placeholder="https://example.com/avatar.png"
              />
            </div>
          </div>

          {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
          {successMessage ? <p className="text-sm text-emerald-600">{successMessage}</p> : null}

          <div className="flex flex-wrap gap-2">
            {!isEditing ? (
              <Button type="button" onClick={() => setIsEditing(true)}>
                Edit profile
              </Button>
            ) : (
              <>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save changes'}
                </Button>
                <Button type="button" variant="outline" onClick={handleCancel} disabled={isSaving}>
                  Cancel
                </Button>
              </>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
