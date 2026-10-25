import { useState } from 'react';

/** Field name -> message for the fields that are not valid. */
export type FormErrors<T> = Partial<Record<keyof T, string>>;

/**
 * Values of a form and its checks. Messages appear once the user tried to submit,
 * and update while they fix the fields.
 */
export function useForm<T extends object>(initial: T | (() => T), validate: (values: T) => FormErrors<T>) {
  const [values, setValues] = useState<T>(initial);
  const [submitted, setSubmitted] = useState(false);
  const errors = submitted ? validate(values) : {};

  /** Setter for one field, for the fields' onChange. */
  const set =
    <K extends keyof T>(field: K) =>
    (value: T[K]) =>
      setValues((current) => ({ ...current, [field]: value }));

  /** Runs `onValid` when the values pass the checks; otherwise shows the messages. */
  const submit = (onValid: (values: T) => void) => {
    setSubmitted(true);
    if (Object.keys(validate(values)).length === 0) onValid(values);
  };

  return { values, set, errors: errors as FormErrors<T>, submit };
}

/** Message for each empty required field. */
export function requireFields<T extends object>(values: T, fields: (keyof T)[]): FormErrors<T> {
  const errors: FormErrors<T> = {};
  for (const field of fields) {
    const value = values[field];
    if (value === null || value === undefined || String(value).trim() === '') errors[field] = 'Required';
  }
  return errors;
}
