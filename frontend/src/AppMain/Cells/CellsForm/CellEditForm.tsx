import FormDrawer, { FormSection } from '../../../components/form/FormDrawer';
import { SelectInput, TextInput } from '../../../components/form/fields';
import { requireFields, useForm } from '../../../components/form/useForm';
import { useOpenCount } from '../../../components/form/useOpenCount';
import { useSaveItem } from '../../../data/queries';
import type { Asset, Cell } from '../../../data/types';

interface CellFormProps {
  open: boolean;
  cell?: Cell | null;
  /** Lines a cell can belong to */
  assets: Asset[];
  onClose: () => void;
  onSaved: () => void;
}

export default function CellEditForm(props: CellFormProps) {
  return <CellFormBody key={useOpenCount(props.open)} {...props} />;
}

function CellFormBody({ open, cell, assets, onClose, onSaved }: CellFormProps) {
  const { values, set, errors, submit } = useForm(
    { name: cell?.name ?? '', machine: cell?.machine?.uuid ?? '' },
    (v) => requireFields(v, ['name', 'machine']),
  );
  const save = useSaveItem('/api/cells/', 'Cell');

  return (
    <FormDrawer
      open={open}
      title={cell ? 'Edit Cell' : 'New Cell'}
      submitLabel={cell ? 'Save' : 'Create'}
      busy={save.isPending}
      onClose={onClose}
      onSubmit={() => submit((v) => save.mutate({ uuid: cell?.uuid, values: v }, { onSuccess: onSaved }))}
    >
      <FormSection title="Basic Information">
        <TextInput
          label="Cell Name"
          value={values.name}
          onChange={set('name')}
          error={errors.name}
          required
        />
        <SelectInput
          label="Assigned Machine"
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
