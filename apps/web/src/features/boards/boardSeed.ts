// Átmeneti kezdőadat: az API bekötésekor (M1) a szerver adja, a seed szkript tölti be.
import type { Columns } from './types'

export const initialColumns: Columns = {
  todo: {
    title: 'Teendők',
    accent: 'blue',
    done: false,
    tasks: [
      {
        id: 'task-1',
        title: 'Landing page vázlat',
        description: 'Készítsünk néhány főbb szekciót a közönség számára.',
        priority: 'high',
        tags: [
          { label: 'UI', color: 'blue' },
          { label: 'Vezetői', color: 'purple' },
        ],
        dueDate: '2026-11-14',
        checklist: { done: 2, total: 4 },
      },
      {
        id: 'task-2',
        title: 'Felhasználói visszajelzés',
        description: 'Összegyűjtjük a legfontosabb UX észrevételeket.',
        priority: 'medium',
        tags: [{ label: 'UX', color: 'green' }],
        dueDate: '2026-11-11',
        checklist: { done: 1, total: 3 },
      },
    ],
  },
  doing: {
    title: 'Folyamatban',
    accent: 'amber',
    done: false,
    tasks: [
      {
        id: 'task-3',
        title: 'Dashboard felület',
        description: 'A fő adatok és grafikonok elkészítése a képernyőn.',
        priority: 'high',
        coverImage:
          'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=900&q=80',
        tags: [{ label: 'Analytics', color: 'amber' }],
        dueDate: '2026-11-10',
        checklist: { done: 3, total: 5 },
      },
    ],
  },
  done: {
    title: 'Kész',
    accent: 'green',
    done: true,
    tasks: [
      {
        id: 'task-4',
        title: 'Brand guideline',
        description: 'A színpaletta és a tipográfia jóváhagyása elkészült.',
        priority: 'low',
        tags: [{ label: 'Brand', color: 'rose' }],
        dueDate: '2026-11-08',
        checklist: { done: 4, total: 4 },
      },
    ],
  },
}
