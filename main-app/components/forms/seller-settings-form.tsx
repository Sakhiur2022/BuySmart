'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { saveSellerSettings } from '@/lib/actions/settings';

type SellerSettings = {
  storeName: string;
  tagline: string;
  supportEmail: string;
  supportPhone: string;
  shippingOrigin: string;
  returnWindowDays: number;
  returnPolicy: string;
  lowStockThreshold: number;
  autoPublish: boolean;
  orderNotifications: boolean;
  marketingTips: boolean;
  vacationMode: boolean;
};

type SellerSettingsFormProps = {
  userId: string;
  initialSettings: SellerSettings;
  initialUpdatedAt: string | null;
};

type ToggleSwitchProps = {
  id: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
};

function ToggleSwitch({ id, checked, onCheckedChange, disabled }: ToggleSwitchProps) {
  return (
    <label
      htmlFor={id}
      aria-label="Toggle setting"
      className={`relative inline-flex h-6 w-11 items-center ${
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
      }`}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onCheckedChange(event.target.checked)}
        disabled={disabled}
        className="peer sr-only"
      />
      <span className="absolute inset-0 rounded-full bg-slate-200 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-rose-400 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background peer-checked:bg-rose-500 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 dark:bg-slate-700 dark:peer-checked:bg-rose-600" />
      <span className="relative z-10 h-4 w-4 translate-x-1 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-6" />
    </label>
  );
}

function toNumber(value: string, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(0, Math.trunc(parsed));
}

export function SellerSettingsForm({
  userId,
  initialSettings,
  initialUpdatedAt,
}: SellerSettingsFormProps) {
  const [settings, setSettings] = useState<SellerSettings>(initialSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(initialUpdatedAt);

  const lastUpdated = useMemo(() => {
    if (!updatedAt) {
      return 'Not saved yet';
    }

    const date = new Date(updatedAt);
    if (Number.isNaN(date.getTime())) {
      return 'Unknown';
    }

    return date.toLocaleString();
  }, [updatedAt]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    const result = await saveSellerSettings(userId, settings);
    setIsSaving(false);

    if (!result.success) {
      setError(result.error ?? 'Unable to save seller settings.');
      return;
    }

    setUpdatedAt(result.updatedAt);
    setSuccess('Seller settings updated.');
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Seller Settings</h1>
          <p className="text-sm text-muted-foreground">
            Manage storefront details, operations, and seller notifications.
          </p>
        </div>
        <div className="text-xs text-muted-foreground">Last updated: {lastUpdated}</div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {success}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Storefront</CardTitle>
          <CardDescription>Public-facing details shown to buyers.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="storeName">Store name</Label>
            <Input
              id="storeName"
              value={settings.storeName}
              onChange={(event) =>
                setSettings((current) => ({ ...current, storeName: event.target.value }))
              }
              placeholder="BuySmart Essentials"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="tagline">Tagline</Label>
            <Input
              id="tagline"
              value={settings.tagline}
              onChange={(event) =>
                setSettings((current) => ({ ...current, tagline: event.target.value }))
              }
              placeholder="Tech that keeps up with you."
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="supportEmail">Support email</Label>
              <Input
                id="supportEmail"
                type="email"
                value={settings.supportEmail}
                onChange={(event) =>
                  setSettings((current) => ({ ...current, supportEmail: event.target.value }))
                }
                placeholder="support@store.com"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="supportPhone">Support phone</Label>
              <Input
                id="supportPhone"
                value={settings.supportPhone}
                onChange={(event) =>
                  setSettings((current) => ({ ...current, supportPhone: event.target.value }))
                }
                placeholder="+1 (555) 123-4567"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Operations</CardTitle>
          <CardDescription>Shipping, returns, and fulfillment defaults.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="shippingOrigin">Shipping origin</Label>
              <Input
                id="shippingOrigin"
                value={settings.shippingOrigin}
                onChange={(event) =>
                  setSettings((current) => ({ ...current, shippingOrigin: event.target.value }))
                }
                placeholder="Dhaka, Bangladesh"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="returnWindowDays">Return window (days)</Label>
              <Input
                id="returnWindowDays"
                type="number"
                min={0}
                value={settings.returnWindowDays}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    returnWindowDays: toNumber(event.target.value, current.returnWindowDays),
                  }))
                }
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="returnPolicy">Return policy note</Label>
            <Textarea
              id="returnPolicy"
              value={settings.returnPolicy}
              onChange={(event) =>
                setSettings((current) => ({ ...current, returnPolicy: event.target.value }))
              }
              placeholder="We accept returns within 30 days in original packaging."
              className="min-h-24"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Inventory & Alerts</CardTitle>
          <CardDescription>Automations and notifications for your listings.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="lowStockThreshold">Low stock threshold</Label>
              <Input
                id="lowStockThreshold"
                type="number"
                min={0}
                value={settings.lowStockThreshold}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    lowStockThreshold: toNumber(event.target.value, current.lowStockThreshold),
                  }))
                }
              />
            </div>

            <div className="flex items-center justify-between gap-4 rounded-lg border px-3 py-2">
              <div>
                <p className="text-sm font-medium">Auto-publish new products</p>
                <p className="text-xs text-muted-foreground">
                  Publish listings instantly without review.
                </p>
              </div>
              <ToggleSwitch
                id="autoPublish"
                checked={settings.autoPublish}
                onCheckedChange={(checked) =>
                  setSettings((current) => ({ ...current, autoPublish: checked }))
                }
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border px-3 py-2">
            <div>
              <p className="text-sm font-medium">Order notifications</p>
              <p className="text-xs text-muted-foreground">
                Get an alert for every new order.
              </p>
            </div>
            <ToggleSwitch
              id="orderNotifications"
              checked={settings.orderNotifications}
              onCheckedChange={(checked) =>
                setSettings((current) => ({ ...current, orderNotifications: checked }))
              }
            />
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border px-3 py-2">
            <div>
              <p className="text-sm font-medium">Marketing tips</p>
              <p className="text-xs text-muted-foreground">
                Weekly insights to improve storefront performance.
              </p>
            </div>
            <ToggleSwitch
              id="marketingTips"
              checked={settings.marketingTips}
              onCheckedChange={(checked) =>
                setSettings((current) => ({ ...current, marketingTips: checked }))
              }
            />
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border px-3 py-2">
            <div>
              <p className="text-sm font-medium">Vacation mode</p>
              <p className="text-xs text-muted-foreground">
                Pause new orders while you are away.
              </p>
            </div>
            <ToggleSwitch
              id="vacationMode"
              checked={settings.vacationMode}
              onCheckedChange={(checked) =>
                setSettings((current) => ({ ...current, vacationMode: checked }))
              }
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </form>
  );
}
