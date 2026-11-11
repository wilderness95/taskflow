/** Session és API kulcs (M4) egyaránt Actor-rá képződik le; a service csak ezt ismeri. */
export type Actor = { type: 'user'; id: string; isAdmin: boolean }
