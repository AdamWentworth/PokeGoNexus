// MegaPokemonModal.tsx
import MegaPokemonSelection from '../components/MegaPokemonSelection';
import type { MegaSelectionData, MegaSelectionResult } from '../hooks/useMegaPokemonHandler';

interface Props {
  open: boolean;
  data: MegaSelectionData | null;
  onResolve: (result: MegaSelectionResult) => void;
  onReject: (reason?: unknown) => void;
}

export default function MegaPokemonModal({
  open,
  data,
  onResolve,
  onReject,
}: Props) {
  if (!open || !data) return null;

  return (
    <MegaPokemonSelection
      caughtPokemon={data.caughtPokemon}
      variantKey={data.variantKey}
      megaForm={data.megaForm}
      onAssignExisting={(instanceId) => onResolve({ action: 'assignExisting', instanceId })}
      onCreateNew={(instanceId) => onResolve({ action: 'createNew', instanceId })}
      onCancel={() => onReject('User canceled')}
    />
  );
}
