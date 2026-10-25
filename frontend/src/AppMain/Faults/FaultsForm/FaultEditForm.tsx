import FormDrawer, { FormSection } from '../../../components/form/FormDrawer';
import { SelectInput, TextInput } from '../../../components/form/fields';
import { requireFields, useForm } from '../../../components/form/useForm';
import { useOpenCount } from '../../../components/form/useOpenCount';
import { useSaveItem } from '../../../data/queries';
import type { Asset, Fault } from '../../../data/types';

interface FaultFormProps {
  open: boolean;
  fault?: Fault | null;
  /** Lines a fault can belong to */
  assets: Asset[];
  onClose: () => void;
  onSaved: () => void;
}

export default function FaultEditForm(props: FaultFormProps) {
  return <FaultFormBody key={useOpenCount(props.open)} {...props} />;
}

function FaultFormBody({ open, fault, assets, onClose, onSaved }: FaultFormProps) {
  const { values, set, errors, submit } = useForm(
    { name: fault?.name ?? '', machine: fault?.machine?.uuid ?? '' },
    (v) => requireFields(v, ['name', 'machine']),
  );
  const save = useSaveItem('/api/faults/', 'Fault');

  return (
    <FormDrawer
      open={open}
      title={fault ? 'Edit Fault' : 'New Fault'}
      submitLabel={fault ? 'Save' : 'Create'}
      busy={save.isPending}
      onClose={onClose}
      onSubmit={() => submit((v) => save.mutate({ uuid: fault?.uuid, values: v }, { onSuccess: onSaved }))}
    >
      <FormSection title="Basic Information">
        <TextInput
          label="Fault Name"
          value={values.name}
          onChange={set('name')}
          error={errors.name}
          required
        />
        <SelectInput
          label="Machine"
          value={values.machine}
          onChange={set('machine')}
          error={errors.machine}
          required
          options={assets.map((a) => ({ value: a.uuid, label: a.name }))}
        />
      </FormSection>
    </FormDrawer>
  );
}
