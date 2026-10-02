import { useEffect, useState } from 'react';

// Mốc thời gian "hiện tại" tự cập nhật định kỳ — dùng cho hiển thị thời gian tương đối
export const useNow = (intervalMs = 15000) => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
};
