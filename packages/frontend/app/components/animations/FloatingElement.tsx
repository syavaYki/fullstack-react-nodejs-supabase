import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface FloatingElementProps {
  amplitude?: number;
  duration?: number;
  delay?: number;
  children: React.ReactNode;
}

export default function FloatingElement({
  amplitude = 12,
  duration = 4,
  delay = 0,
  children,
}: FloatingElementProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <motion.div
      animate={{ y: [0, -amplitude, 0] }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    >
      {children}
    </motion.div>
  );
}
