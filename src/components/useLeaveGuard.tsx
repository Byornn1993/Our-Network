import { useEffect } from 'react';
import { useConfirm } from '@/components/ui/ConfirmDialog';

/**
 * Waarschuwt voor je een formulier met onbewaarde wijzigingen verlaat: via Annuleren/terug in de app
 * (eigen bevestiging) en bij het sluiten of herladen van de pagina (browsermelding).
 */
export function useLeaveGuard(dirty: boolean) {
  const { confirm, dialog } = useConfirm();

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const leave = async (go: () => void) => {
    if (!dirty) return go();
    const ok = await confirm({
      title: 'Wijzigingen niet bewaren?',
      message: 'Je hebt iets ingevuld of aangepast dat nog niet bewaard is.',
      confirmLabel: 'Niet bewaren',
      danger: true,
    });
    if (ok) go();
  };

  return { leave, dialog };
}
