'use client';

import * as React from 'react';

/**
 * Moves keyboard focus to the first field marked invalid, AFTER React has
 * rendered the error messages. Call the returned function whenever a form
 * fails validation.
 */
export function useFocusFirstError() {
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    if (tick) document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [tick]);
  return React.useCallback(() => setTick((t) => t + 1), []);
}

/** Keeps digits only and caps the length after stripping, so a pasted "1111 1111 111" still works. */
export const digitsOnly = (value: string, max: number) => value.replace(/\D/g, '').slice(0, max);
