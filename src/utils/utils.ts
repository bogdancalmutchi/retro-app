import { Timestamp } from 'firebase/firestore';

export const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

export const formatSprintDate = (createdAt?: Timestamp) => {
  if (!createdAt?.toDate) return '';
  return createdAt.toDate().toLocaleDateString(undefined, {
    month: 'short',
    day: '2-digit',
    year: 'numeric'
  });
};
