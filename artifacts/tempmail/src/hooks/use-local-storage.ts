import { useEffect, useState, useRef, useCallback } from "react";

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  // Ref yang selalu menunjuk nilai TERBARU. Tanpa ini, setValue yang dipanggil
  // dari handler/effect render lama memakai nilai basi dari closure sehingga
  // update terbaru tertimpa (daftar email "muncul/hilang" sendiri).
  const valueRef = useRef(storedValue);
  useEffect(() => {
    valueRef.current = storedValue;
  }, [storedValue]);

  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      try {
        const valueToStore =
          value instanceof Function ? value(valueRef.current) : value;
        valueRef.current = valueToStore;
        setStoredValue(valueToStore);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
        }
      } catch (error) {
        console.error(error);
      }
    },
    [key]
  );

  return [storedValue, setValue] as const;
}
