import { useState, useCallback } from 'react';

/**
 * 通用上传/操作 loading + error 状态
 */
export function useUploadState() {
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [error, setError] = useState<string | null>(null);

  const startLoading = useCallback((msg = '') => {
    setLoading(true);
    setLoadingMsg(msg);
    setError(null);
  }, []);

  const stopLoading = useCallback(() => {
    setLoading(false);
    setLoadingMsg('');
  }, []);

  const setMsg = useCallback((msg: string) => {
    setLoadingMsg(msg);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return {
    loading,
    loadingMsg,
    error,
    setError,
    clearError,
    startLoading,
    stopLoading,
    setMsg,
  };
}
