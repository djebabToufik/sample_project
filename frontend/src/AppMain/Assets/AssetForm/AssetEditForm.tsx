import { useState } from 'react';

import FormDrawer, { FormSection } from '../../../components/form/FormDrawer';
import { DateTimeInput, FileInput, SelectInput, TextInput } from '../../../components/form/fields';
import { requireFields, useForm } from '../../../components/form/useForm';
import { useOpenCount } from '../../../components/form/useOpenCount';
import { fromInputValue, toInputValue } from '../../../data/dates';
import { useSaveItem } from '../../../data/queries';
import type { Asset } from '../../../data/types';

interface AssetFormProps {
  open: boolean;
  /** The asset to edit; none = create a new one */
  asset?: Asset | null;
  onClose: () => void;
  onSaved: () => void;
}

const statusOptions = ['Active', 'Inactive', 'Under Maintenance', 'Retired'].map((v) => ({
  value: v,
  label: v,
}));
const typeOptions = ['Vehicle', 'Equipment', 'Building', 'Furniture', 'IT', 'Other'].map((v) => ({
  value: v,
  label: v,
}));

const MAX_PHOTO_BYTES = 2_000_000;

function initialValues(asset: Asset | null | undefined) {
  const number = (value: number | string | null | undefined) => (value == null ? '' : String(value));
  return {
    name: asset?.name ?? '',
    ref: asset?.ref ?? '',
    serial_number: asset?.serial_number ?? '',
    location: asset?.location ?? '',
    on_hour_consumption_kw: number(asset?.on_hour_consumption_kw ?? 0),
    running_hour_consumption_kw: number(asset?.running_hour_consumption_kw ?? 0),
    on_hour_cost: number(asset?.on_hour_cost ?? 0),
    running_hour_cost: number(asset?.running_hour_cost ?? 0),
    cost: number(asset?.cost),
    current_value: number(asset?.current_value),
    status: asset?.status ?? 'Active',
    asset_type: asset?.asset_type ?? 'Equipment',
    purchase_date: toInputValue(asset?.purchase_date),
    warranty_expiration_date: toInputValue(asset?.warranty_expiration_date),
  };
}

type Values = ReturnType<typeof initialValues>;

const validate = (values: Values) => requireFields(values, ['name', 'ref', 'serial_number', 'location']);

// Every opening starts with the asset's current values.
export default function AssetEditForm(props: AssetFormProps) {
  return <AssetFormBody key={useOpenCount(props.open)} {...props} />;
}

function AssetFormBody({ open, asset, onClose, onSaved }: AssetFormProps) {
  const { values, set, errors, submit } = useForm(() => initialValues(asset), validate);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState<string>();
  const save = useSaveItem('/api/assets/', 'Asset');

  const onSubmit = () =>
    submit((v) =>
      save.mutate(
        {
          uuid: asset?.uuid,
          values: {
            ...v,
            purchase_date: fromInputValue(v.purchase_date),
            warranty_expiration_date: fromInputValue(v.warranty_expiration_date),
            photo,
          },
        },
        { onSuccess: onSaved },
      ),
    );

  return (
    <FormDrawer
      open={open}
      title={asset ? 'Edit Asset' : 'New Asset'}
      submitLabel={asset ? 'Save' : 'Create'}
      busy={save.isPending}
      onClose={onClose}
      onSubmit={onSubmit}
    >
      <FormSection title="Basic Information">
        <TextInput label="Name" value={values.name} onChange={set('name')} error={errors.name} required />
        <TextInput label="Reference" value={values.ref} onChange={set('ref')} error={errors.ref} required />
        <TextInput
          label="Serial Number"
          value={values.serial_number}
          onChange={set('serial_number')}
          error={errors.serial_number}
          required
        />
        <TextInput
          label="Location"
          value={values.location}
          onChange={set('location')}
          error={errors.location}
          required
        />
      </FormSection>

      <FormSection title="Energy & Cost">
        <TextInput
          label="On-Hour Consumption (kW/h)"
          type="number"
          width="half"
          value={values.on_hour_consumption_kw}
          onChange={set('on_hour_consumption_kw')}
        />
        <TextInput
          label="Running Consumption (kW/h)"
          type="number"
          width="half"
          value={values.running_hour_consumption_kw}
          onChange={set('running_hour_consumption_kw')}
        />
        <TextInput
          label="On-Hour Cost ($)"
          type="number"
          width="half"
          value={values.on_hour_cost}
          onChange={set('on_hour_cost')}
        />
        <TextInput
          label="Running Cost ($)"
          type="number"
          width="half"
          value={values.running_hour_cost}
          onChange={set('running_hour_cost')}
        />
      </FormSection>

      <FormSection title="Financial Information">
        <TextInput label="Cost ($)" type="number" width="half" value={values.cost} onChange={set('cost')} />
        <TextInput
          label="Current Value ($)"
          type="number"
          width="half"
          value={values.current_value}
          onChange={set('current_value')}
        />
      </FormSection>

      <FormSection title="Status & Type">
        <SelectInput
          label="Status"
          width="half"
          value={values.status}
          onChange={(v) => set('status')(v as Values['status'])}
          options={statusOptions}
        />
        <SelectInput
          label="Asset Type"
          width="half"
          value={values.asset_type}
          onChange={(v) => set('asset_type')(v as Values['asset_type'])}
          options={typeOptions}
        />
      </FormSection>

      <FormSection title="Dates">
        <DateTimeInput label="Purchase Date" value={values.purchase_date} onChange={set('purchase_date')} />
        <DateTimeInput
          label="Warranty Expiration Date"
          value={values.warranty_expiration_date}
          onChange={set('warranty_expiration_date')}
        />
      </FormSection>

      <FormSection title="Photo">
        <FileInput
          label="Upload Photo"
          accept="image/*"
          file={photo}
          onChange={setPhoto}
          maxBytes={MAX_PHOTO_BYTES}
          error={photoError}
          onError={setPhotoError}
        />
      </FormSection>
    </FormDrawer>
  );
}
