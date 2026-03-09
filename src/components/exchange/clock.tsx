import { Box } from "@radix-ui/themes";
import { useEffect, useState } from "react";

let timeout: any;

export default function Clock() {
  const [baseTime, setBaseTime] = useState<number>(0);
  const [prevTime, setPrevTime] = useState<number>(0);
  const [nextTime, setNextTime] = useState<number>(0);
  useEffect(() => {
    const updateNext = () => {
      const time = new Date().getTime();
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        setBaseTime(time);
        setPrevTime(time);
        setNextTime(time + 12000);
      }, 500);
    };
    const interval = setInterval(() => setPrevTime(new Date().getTime()), 500);
    window.addEventListener('update:chain', updateNext);
    updateNext();
    return () => {
      window.removeEventListener('update:chain', updateNext);
      clearInterval(interval);
    };
  }, []);
  
  const progress = Math.max(0, nextTime - prevTime) / (nextTime - baseTime);
  return (
    <Box position="relative">
      <Box className="shadow-rainbow-progress" display={isNaN(progress) ? 'none' : 'block'} right={`${isNaN(progress) ? 100 : (progress * 100)}%`}></Box>
    </Box>
  );
}