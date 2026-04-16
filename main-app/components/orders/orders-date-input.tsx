'use client';

import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';

type OrdersDateInputProps = {
  id: string;
  name: string;
  defaultValue?: string;
};

function getLocalDateString(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export default function OrdersDateInput({ id, name, defaultValue }: OrdersDateInputProps) {
  const maxDate = useMemo(getLocalDateString, []);
  const [value, setValue] = useState(() => {
    if (defaultValue && defaultValue > maxDate) {
      return maxDate;
    }

    return defaultValue ?? '';
  });

  return (
    <Input
      id={id}
      name={name}
      type="date"
      max={maxDate}
      value={value}
      onChange={(event) => {
        const nextValue = event.target.value;
        setValue(nextValue && nextValue > maxDate ? maxDate : nextValue);
      }}
    />
  );
}
