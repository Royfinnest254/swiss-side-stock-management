/**
 * useApi — Custom hook for REST API data fetching.
 * Works like Convex's useQuery: loads data and refetches on demand.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../lib/api';

export function useApiQuery(path, deps = []) {
  const [data, setData] = useState(undefined);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const fetch = useCallback(async () => {
    if (!path) return;
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    try {
      const result = await api.get(path);
      setData(result);
      setError(null);
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message);
        console.error(`useApiQuery[${path}]:`, err);
      }
    }
  }, [path, ...deps]); // eslint-disable-line

  useEffect(() => {
    fetch();
    return () => abortRef.current?.abort();
  }, [fetch]);

  return { data, error, refetch: fetch };
}

export function useApiMutation() {
  const [loading, setLoading] = useState(false);

  const mutate = useCallback(async (method, path, body) => {
    setLoading(true);
    try {
      const result = await api[method](path, body);
      return result;
    } finally {
      setLoading(false);
    }
  }, []);

  return { mutate, loading };
}
