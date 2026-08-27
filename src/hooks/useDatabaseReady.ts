import { useEffect, useState } from 'react';
import { dualDatabaseManager } from '@/database/DualDatabaseManager';
import { DatabaseStatusReport } from '@/types';

interface DatabaseReadyState {
  ready: boolean;
  error: string | null;
  status: DatabaseStatusReport | null;
}

export function useDatabaseReady(): DatabaseReadyState {
  const [state, setState] = useState<DatabaseReadyState>({
    ready: false,
    error: null,
    status: null,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const status = await dualDatabaseManager.initialize();
        if (!cancelled) setState({ ready: true, error: null, status });
      } catch (err) {
        if (!cancelled) {
          setState({
            ready: false,
            error: err instanceof Error ? err.message : String(err),
            status: null,
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
