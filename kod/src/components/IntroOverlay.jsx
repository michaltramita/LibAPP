
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const moduleNames = [
  'Obchodný rozhovor',
  'Individuálny rozhovor',
  'Koučing',
  'Príprava ponuky',
];

const IntroOverlay = ({ onComplete }) => {
  const [step, setStep] = useState(0); // 0-3 for modules, 4 for final welcome
  const [isVisible, setIsVisible] = useState(true);
  const timers = useRef([]);

  useEffect(() => {
    // Clear all timers on component unmount or when dependencies change to prevent memory leaks
    return () => {
      timers.current.forEach(timer => clearTimeout(timer));
    };
  }, []);

  useEffect(() => {
    if (step < moduleNames.length) {
      const timer = setTimeout(() => {
        setStep(step + 1);
      }, 1500); // Each module name is visible for 1.5s
      timers.current.push(timer);
      return () => clearTimeout(timer);
    } else if (step === moduleNames.length) {
      // All modules have been shown, now show the final screen
      // Timer to start fade-out of the whole overlay
      const fadeOutTimer = setTimeout(() => {
        setIsVisible(false);
      }, 2500); // Display final welcome for 2.5 seconds
      timers.current.push(fadeOutTimer);

      // Timer to call onComplete after fade-out animation
      const completeTimer = setTimeout(() => {
        onComplete();
      }, 3300); // 2500ms display + 800ms fade-out
      timers.current.push(completeTimer);

      return () => {
        clearTimeout(fadeOutTimer);
        clearTimeout(completeTimer);
      };
    }
  }, [step, onComplete]);

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
    exit: { opacity: 0, y: -10, transition: { duration: 0.5, ease: 'easeIn' } },
  };

  const handleSkip = () => {
    timers.current.forEach(timer => clearTimeout(timer)); // Clear all pending timers
    setIsVisible(false); // Trigger fade-out
    // Call onComplete after a short delay to allow fade-out animation to start
    const skipCompleteTimer = setTimeout(() => {
      onComplete();
    }, 300); // Small delay to allow exit animation to begin
    timers.current.push(skipCompleteTimer);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-50"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.8, ease: "easeInOut" } }}
        >
          <motion.button
            className="absolute top-4 right-4 px-4 py-2 text-sm font-medium text-slate-600 rounded-full hover:bg-slate-100 transition-colors duration-200"
            onClick={handleSkip}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
          >
            Preskočiť
          </motion.button>

          <div className="relative h-24 w-full flex items-center justify-center">
            <AnimatePresence mode="wait">
              {step < moduleNames.length ? (
                <motion.p
                  key={step}
                  variants={itemVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="absolute text-3xl text-slate-700 font-medium"
                  style={{ fontFamily: 'Gabarito, sans-serif', fontWeight: 900 }}
                >
                  {moduleNames[step]}
                </motion.p>
              ) : (
                <motion.div
                  key="welcome"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, delay: 0.3, ease: "easeOut" }}
                  className="text-center"
                >
                  <img
                    src="https://horizons-cdn.hostinger.com/c7c4800e-7b32-471c-852f-a05cb57f1e91/083d123c3cdbe84b7f967b880b085698.png"
                    alt="Libellius Logo"
                    className="mx-auto mb-8 w-auto h-24"
                  />
                  <h1
                    className="text-5xl font-bold text-[#B81547] mb-3"
                    style={{ fontFamily: 'Gabarito, sans-serif', fontWeight: 900 }}
                  >
                    Vitaj v LibApp!
                  </h1>
                  <p
                    className="text-2xl text-slate-600"
                    style={{ fontFamily: 'Gabarito, sans-serif', fontWeight: 900 }}
                  >
                    Tvoj AI pomocník
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default IntroOverlay;
