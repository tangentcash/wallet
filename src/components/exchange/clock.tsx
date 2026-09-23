import { Box } from "@radix-ui/themes";
import { useEffect, useState } from "react";
import { Chain } from "tangentsdk/algorithm";

let timeout: any;

export default function Clock() {
  const [baseTime, setBaseTime] = useState<number>(0);
  const [prevTime, setPrevTime] = useState<number>(0);
  useEffect(() => {
    const updateNext = () => {
      const time = new Date().getTime();
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        setBaseTime(time);
        setPrevTime(time);
      }, 500);
    };
    const interval = setInterval(() => setPrevTime(new Date().getTime()), 120);
    window.addEventListener('update:chain', updateNext);
    updateNext();
    return () => {
      window.removeEventListener('update:chain', updateNext);
      clearInterval(interval);
    };
  }, []);

  const remaining = (Chain.policy.BLOCK_TIME - Math.min(Math.max(0, prevTime - baseTime), Chain.policy.BLOCK_TIME)) / 1000;
  return (
    <Box className="block-countdown" style={{ visibility: isNaN(remaining) ? 'hidden' : undefined }}>
      { remaining.toFixed(1) }s
    </Box>
  );
}
