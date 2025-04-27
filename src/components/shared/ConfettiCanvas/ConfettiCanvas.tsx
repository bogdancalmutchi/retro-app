import React, { useState } from 'react';
import { useEffect, useRef } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import confetti from 'canvas-confetti';
import { notifications } from '@mantine/notifications';
import { IconConfetti } from '@tabler/icons-react';
import Cookies from 'js-cookie';

import { useUser } from '../../../contexts/UserContext';
import { db } from '../../../firebase';
import { randomInRange } from '../../../utils/utils';
import { cookieLifetime } from '../../../utils/LocalStorage';

import styles from './ConfettiCanvas.module.scss';

let globalConfetti: confetti.CreateTypes | null = null;

export const fireConfetti = () => {
  if (!globalConfetti) {
    console.warn('Confetti not initialized!');
    return;
  }

  const bursts = 12; // How many directions to fire (more = smoother circle)
  const particleCount = Math.floor(randomInRange(200, 400)); // Total particles to distribute

  for (let i = 0; i < bursts; i++) {
    globalConfetti({
      particleCount: Math.floor(particleCount / bursts),
      angle: (360 / bursts) * i, // Spread angles evenly around circle
      spread: 40, // Tight spread for better "blast" look
      startVelocity: 45, // Strong outward velocity
      origin: { x: 0.5, y: 0.5 }, // Center of canvas
      gravity: 0.8, // Default gravity
      scalar: randomInRange(0.8, 1.2), // Slight random size
    });
  }
};

export const fireConfettiRain = () => {
  if (!globalConfetti) {
    console.warn('Confetti not initialized!');
    return;
  }

  const duration = 5 * 1000; // 5 seconds
  const animationEnd = Date.now() + duration;
  let skew = 1;

  const frame = () => {
    const timeLeft = animationEnd - Date.now();
    const ticks = Math.max(200, 500 * (timeLeft / duration));
    skew = Math.max(0.8, skew - 0.001);

    globalConfetti!({
      particleCount: 20,
      startVelocity: 50,
      ticks: ticks,
      origin: {
        x: Math.random(),
        y: (Math.random() * skew) - 0.2,
      },
      gravity: randomInRange(0.4, 0.6),
      scalar: randomInRange(0.4, 1),
      drift: randomInRange(-0.4, 0.4),
    });

    if (timeLeft > 0) {
      requestAnimationFrame(frame);
    }
  };

  frame();
};

const KONAMI_CODE = [
  'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
  'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
  'KeyB', 'KeyA'
];

const ConfettiCanvas = () => {
  const [inputSequence, setInputSequence] = useState<string[]>([]); // To track keypresses
  const ref = useRef<HTMLCanvasElement>(null);
  const { userId, setCanParty } = useUser();

  useEffect(() => {
    if (ref.current) {
      globalConfetti = confetti.create(ref.current, {
        resize: true,
        useWorker: true,
      });
    }
  }, []);

  // Handle key presses for Konami Code
  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (KONAMI_CODE.includes(event.code)) {
        setInputSequence((prevSequence) => {
          const newSequence = [...prevSequence, event.code];
          if (newSequence.length > KONAMI_CODE.length) {
            newSequence.shift(); // Remove the oldest entry if it's over the sequence length
          }
          return newSequence;
        });
      }
    };

    const checkKonamiCode = async () => {
      if (JSON.stringify(inputSequence) === JSON.stringify(KONAMI_CODE)) {
        fireConfetti();
        const userRef = doc(db, 'users', userId);

        // Update Firestore
        await updateDoc(userRef, {
          canParty: true
        });
        Cookies.set('canParty', JSON.stringify(true), { expires: cookieLifetime, path: '/' });
        setCanParty(true);
        renderNotification();
        setInputSequence([]); // Reset the sequence after triggering
      }
    };

    // Listen to keydown events
    window.addEventListener('keydown', handleKeydown);

    // Check if Konami code is entered
    checkKonamiCode();

    return () => {
      window.removeEventListener('keydown', handleKeydown);
    };
  }, [inputSequence, userId, setCanParty]);

  const renderNotification = () => {
    if (globalConfetti) {
      notifications.show({
        icon: <IconConfetti size={20} />,
        title: '🎉 Party Mode Unlocked! 🎉',
        message: 'Click on your avatar to launch confetti!',
        position: 'top-right',
        autoClose: false,
        color: '#228be6'
      })
    }
  };

  return (
    <canvas
      ref={ref}
      className={styles.canvas}
    />
  );
};

export default ConfettiCanvas;
