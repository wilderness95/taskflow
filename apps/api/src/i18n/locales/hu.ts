/** E-mail sablonok magyarul; új nyelv: új fájl ebben a mappában + egy bejegyzés az `i18n/index.ts`-ben. */
export const hu = {
  common: {
    footer: 'Ha nem te kérted ezt, nyugodtan hagyd figyelmen kívül ezt a levelet.',
  },
  verifyEmail: {
    subject: 'Erősítsd meg az e-mail-címedet',
    body: 'Szia {{name}}!\n\nAz e-mail-címed megerősítéséhez nyisd meg ezt a hivatkozást:\n{{link}}\n\nA hivatkozás {{hours}} óráig érvényes.',
  },
  passwordReset: {
    subject: 'Jelszó-visszaállítás',
    body: 'Szia {{name}}!\n\nÚj jelszót itt tudsz megadni:\n{{link}}\n\nA hivatkozás {{hours}} óráig érvényes.',
  },
  invitation: {
    subject: 'Meghívást kaptál a TaskFlow-ba',
    body: 'Szia!\n\n{{inviter}} meghívott a TaskFlow-ba. A regisztrációhoz nyisd meg ezt a hivatkozást:\n{{link}}\n\nA meghívó {{days}} napig érvényes.',
  },
} as const

export type Messages = typeof hu
