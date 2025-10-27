/**
 * useNotificationSound Hook
 * EPIC 003 WAVE 5 - STORY 6: Mentions/Notifications UI
 */

import { useCallback, useRef } from 'react';
import { NotificationType } from '../types';
import { getNotificationService } from '../services/NotificationService';

/**
 * Hook to manage notification sounds
 */
export const useNotificationSound = () => {
  const service = getNotificationService();
  const audioContextRef = useRef<AudioContext | null>(null);

  // Get or create audio context
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContextRef.current;
  }, []);

  /**
   * Play notification sound for a specific type
   */
  const playSound = useCallback(
    (type: NotificationType) => {
      try {
        const preferences = service.getPreferences();
        if (!preferences.playSound) return;

        const audioContext = getAudioContext();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // Different frequencies for different notification types
        const frequencies: Record<NotificationType, number> = {
          [NotificationType.DM]: 800,
          [NotificationType.MENTION]: 600,
          [NotificationType.REPLY]: 500,
          [NotificationType.ZAP]: 700,
          [NotificationType.REACTION]: 400,
          [NotificationType.REPOST]: 400,
          [NotificationType.FOLLOW]: 400,
        };

        oscillator.frequency.value = frequencies[type] || 500;
        oscillator.type = 'sine';

        gainNode.gain.value = preferences.soundVolume;
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
      } catch (error) {
        console.error('Failed to play notification sound:', error);
      }
    },
    [service, getAudioContext]
  );

  /**
   * Play a custom beep sound
   */
  const playBeep = useCallback(
    (frequency = 500, duration = 0.2) => {
      try {
        const preferences = service.getPreferences();
        if (!preferences.playSound) return;

        const audioContext = getAudioContext();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = frequency;
        oscillator.type = 'sine';

        gainNode.gain.value = preferences.soundVolume;
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + duration);
      } catch (error) {
        console.error('Failed to play beep:', error);
      }
    },
    [service, getAudioContext]
  );

  /**
   * Play a success sound (ascending notes)
   */
  const playSuccess = useCallback(() => {
    try {
      const preferences = service.getPreferences();
      if (!preferences.playSound) return;

      const audioContext = getAudioContext();
      const notes = [523.25, 659.25, 783.99]; // C, E, G

      notes.forEach((frequency, index) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = frequency;
        oscillator.type = 'sine';

        const startTime = audioContext.currentTime + index * 0.1;
        const endTime = startTime + 0.1;

        gainNode.gain.value = preferences.soundVolume * 0.3;
        gainNode.gain.exponentialRampToValueAtTime(0.01, endTime);

        oscillator.start(startTime);
        oscillator.stop(endTime);
      });
    } catch (error) {
      console.error('Failed to play success sound:', error);
    }
  }, [service, getAudioContext]);

  /**
   * Play an error sound (descending notes)
   */
  const playError = useCallback(() => {
    try {
      const preferences = service.getPreferences();
      if (!preferences.playSound) return;

      const audioContext = getAudioContext();
      const notes = [523.25, 440.0, 392.0]; // C, A, G

      notes.forEach((frequency, index) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = frequency;
        oscillator.type = 'sine';

        const startTime = audioContext.currentTime + index * 0.1;
        const endTime = startTime + 0.1;

        gainNode.gain.value = preferences.soundVolume * 0.3;
        gainNode.gain.exponentialRampToValueAtTime(0.01, endTime);

        oscillator.start(startTime);
        oscillator.stop(endTime);
      });
    } catch (error) {
      console.error('Failed to play error sound:', error);
    }
  }, [service, getAudioContext]);

  return {
    playSound,
    playBeep,
    playSuccess,
    playError,
  };
};
