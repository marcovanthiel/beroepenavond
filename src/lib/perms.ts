/**
 * Rechten van de rol 'relatiebeheerder'. Eén bron van waarheid voor zowel de
 * middleware (die mutaties buiten dit domein blokkeert) als de admin-layout
 * (die read-only-pagina's zichtbaar vergrendelt). Nieuwe voorlichter-route
 * die relatiebeheerders óók mogen bedienen? Zet het pad-prefix hieronder.
 */
export const RELATIEBEHEERDER_BEWERKT = [
  '/admin/speakers',
  '/admin/uitnodigingen',
  '/admin/inbox',
  '/admin/account',
];

/** Mag een relatiebeheerder op dit pad bewerken (mutaties uitvoeren)? */
export function relatiebeheerderMagBewerken(path: string): boolean {
  return (
    path === '/admin/logout' ||
    RELATIEBEHEERDER_BEWERKT.some((p) => path === p || path.startsWith(p + '/'))
  );
}
