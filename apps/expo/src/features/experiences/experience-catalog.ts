import type { Href } from 'expo-router';

export const showcase = {
  name: 'Guess the Qubit',
  description: 'Guess quantum measurements with simulator and asynchronous hardware modes in AR.',
} as const;

export const experiences = [
  {
    route: 'guess-the-qubit',
    href: '/guess-the-qubit',
    title: 'Guess the Qubit',
  },
] as const satisfies readonly { route: string; href: Href; title: string }[];
