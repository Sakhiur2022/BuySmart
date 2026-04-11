'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ProductSearchInputProps {
  initialValue?: string;
  debounceMs?: number;
}

export default function ProductSearchInput({
  initialValue = '',
  debounceMs = 350,
}: ProductSearchInputProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState(initialValue);

  const currentQuery = useMemo(
    () => searchParams.get('q') ?? searchParams.get('search') ?? '',
    [searchParams],
  );

  useEffect(() => {
    setValue(currentQuery);
  }, [currentQuery]);

  const pushQuery = useCallback(
    (queryValue: string) => {
      const params = new URLSearchParams(searchParams.toString());

      if (queryValue.trim()) {
        params.set('q', queryValue.trim());
      } else {
        params.delete('q');
      }

      params.delete('search');
      params.set('page', '1');

      startTransition(() => {
        const next = params.toString();
        router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
      });
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    const handle = setTimeout(() => {
      const normalizedInput = value.trim();
      const normalizedCurrent = currentQuery.trim();

      if (normalizedInput === normalizedCurrent) {
        return;
      }

      pushQuery(normalizedInput);
    }, debounceMs);

    return () => clearTimeout(handle);
  }, [value, currentQuery, debounceMs, pushQuery]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    pushQuery(value);
  };

  const onClear = () => {
    setValue('');
    pushQuery('');
  };

  return (
    <form onSubmit={onSubmit} className="flex items-center gap-2">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Search by name, description, or category..."
          className="pl-9"
          aria-label="Search products"
        />
      </div>
      {value ? (
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={onClear}
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </Button>
      ) : null}
      <Button type="submit" variant="default" disabled={isPending}>
        Search
      </Button>
    </form>
  );
}
