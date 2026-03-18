import type { Transition, Variants } from 'framer-motion';

export const easeOutCurve = 'easeOut';
export const easeInCurve = 'easeIn';

export const fadeUpVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: easeOutCurve },
  },
  exit: {
    opacity: 0,
    y: 8,
    transition: { duration: 0.15, ease: easeInCurve },
  },
};

export const fadeUpReducedVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.12 } },
};

export const staggerContainerVariants: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.06, delayChildren: 0.04 },
  },
  exit: {
    transition: { staggerChildren: 0.03, staggerDirection: -1 },
  },
};

export const staggerContainerReducedVariants: Variants = {
  hidden: {},
  visible: {},
  exit: {},
};

export const springScaleVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { type: 'spring', stiffness: 300, damping: 24 },
  },
  exit: { opacity: 0, scale: 0.95, transition: { duration: 0.15, ease: easeInCurve } },
};

export const springScaleReducedVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
};

export const dialogBackdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2, ease: easeOutCurve } },
  exit: { opacity: 0, transition: { duration: 0.15, ease: easeInCurve } },
};

export const dialogContentStaggerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05, delayChildren: 0.03 } },
  exit: { transition: { staggerChildren: 0.03, staggerDirection: -1 } },
};

export const dialogContentItemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2, ease: easeOutCurve } },
  exit: { opacity: 0, y: 4, transition: { duration: 0.12, ease: easeInCurve } },
};

export const inlineMessageVariants: Variants = {
  hidden: { opacity: 0, y: -12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2, ease: easeOutCurve } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.15, ease: easeInCurve } },
};

export const inlineMessageReducedVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.12 } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
};

export const errorShakeAnimation = {
  x: [0, -4, 4, -4, 4, -2, 2, 0],
  transition: { duration: 0.4, ease: 'easeInOut' as const },
};

export const validationMessageVariants: Variants = {
  hidden: { opacity: 0, y: -6 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2, ease: easeOutCurve } },
  exit: { opacity: 0, y: -4, transition: { duration: 0.12, ease: easeInCurve } },
};

export const spinnerTransition: Transition = {
  duration: 0.6,
  repeat: Infinity,
  ease: 'linear',
};

export const successCheckVariants: Variants = {
  hidden: { opacity: 0, scale: 0.5 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { type: 'spring', stiffness: 320, damping: 20 },
  },
  exit: { opacity: 0, scale: 0.8, transition: { duration: 0.12 } },
};

// ANIMATION: Dialog modal entry/exit with spring entrance and snappy exit
export const dialogModalVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95, y: -8 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 400, damping: 30 },
  },
  exit: {
    opacity: 0,
    scale: 0.97,
    y: 4,
    transition: { duration: 0.15, ease: easeInCurve },
  },
};

// ANIMATION: Dialog modal with reduced motion (opacity only)
export const dialogModalReducedVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.1 } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
};

// ANIMATION: Backdrop fade for dialog overlay
export const dialogBackdropFadeVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2, ease: easeOutCurve } },
  exit: { opacity: 0, transition: { duration: 0.15, ease: easeInCurve } },
};

// ANIMATION: Backdrop fade with reduced motion
export const dialogBackdropFadeReducedVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.1 } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
};
