import React, { useState, useEffect, useRef } from 'react';

export interface NumericInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'min' | 'max' | 'step'> {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number | string;
  fallbackValue?: number;
}

/**
 * NumericInput provides a natural text-entry experience for numbers.
 * Allows clearing the field completely without immediately reverting to 0 or min.
 * Applies clamping and defaults to min/fallback on blur or Enter.
 */
export function NumericInput({
  value,
  onChange,
  min,
  max,
  step = 'any',
  fallbackValue,
  className = '',
  onKeyDown,
  onBlur,
  ...rest
}: NumericInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [textValue, setTextValue] = useState<string>(() => (Number.isFinite(value) ? String(value) : '0'));
  const isFocusedRef = useRef<boolean>(false);
  const prevPropValueRef = useRef<number>(value);

  // Synchronize local text with incoming value when not actively being edited,
  // or when an external action (undo/redo, object selection change) alters the prop value.
  useEffect(() => {
    if (value !== prevPropValueRef.current) {
      prevPropValueRef.current = value;
      if (!isFocusedRef.current) {
        setTextValue(Number.isFinite(value) ? String(value) : '0');
      }
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setTextValue(raw);

    // Allow empty string or partial symbols while typing without resetting
    if (raw === '' || raw === '-' || raw === '.' || raw === '-.') {
      return;
    }

    const parsed = parseFloat(raw);
    if (!Number.isNaN(parsed)) {
      onChange(parsed);
    }
  };

  const commitValue = () => {
    const trimmed = textValue.trim();
    if (trimmed === '' || Number.isNaN(Number(trimmed))) {
      const fallback = min !== undefined ? min : (fallbackValue ?? 0);
      setTextValue(String(fallback));
      onChange(fallback);
      return;
    }

    let num = Number(trimmed);
    if (min !== undefined && num < min) {
      num = min;
    }
    if (max !== undefined && num > max) {
      num = max;
    }
    setTextValue(String(num));
    onChange(num);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    isFocusedRef.current = false;
    commitValue();
    onBlur?.(e);
  };

  const handleFocus = () => {
    isFocusedRef.current = true;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commitValue();
      inputRef.current?.blur();
    }
    onKeyDown?.(e);
  };

  return (
    <input
      ref={inputRef}
      type="number"
      step={step}
      min={min}
      max={max}
      value={textValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={className}
      {...rest}
    />
  );
}
