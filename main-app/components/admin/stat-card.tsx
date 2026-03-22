import type { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type StatCardProps = {
  label: string;
  value: number;
  icon: LucideIcon;
  description?: string;
};

export function StatCard({ label, value, icon: Icon, description }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value.toLocaleString()}</p>
        {description ? <CardDescription className="pt-1">{description}</CardDescription> : null}
      </CardContent>
    </Card>
  );
}
