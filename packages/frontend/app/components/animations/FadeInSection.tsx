import { motion } from 'framer-motion';

interface FadeInSectionProps {
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
  delay?: number;
  duration?: number;
  children: React.ReactNode;
}

const offsets: Record<NonNullable<FadeInSectionProps['direction']>, object> = {
  up: { y: 30 },
  down: { y: -30 },
  left: { x: -30 },
  right: { x: 30 },
  none: {},
};

export default function FadeInSection({
  direction = 'up',
  delay = 0,
  duration = 0.6,
  children,
}: FadeInSectionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, ...offsets[direction] }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{
        duration,
        delay,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {children}
    </motion.div>
  );
}
