import { useState } from 'react';

import FormDrawer, { FormSection } from '../../../components/form/FormDrawer';
import { DateTimeInput, FileInput, SelectInput, TextInput } from '../../../components/form/fields';
import { requireFields, useForm, type FormErrors } from '../../../components/form/useForm';
import { useOpenCount } from '../../../components/form/useOpenCount';
import { fromInputValue, toInputValue } from '../../../data/dates';
import { useSaveItem } from '../../../data/queries';
import type { Asset, MaintenancePlan, UserProfile } from '../../../data/types';

/**
 * The plan to edit, or the start of a new one: the Agenda opens new plans with the
 * clicked slot's dates (local time) and no uuid.
 */
export type PlanDraft = Partial<MaintenancePlan>;

interface MaintenanceFormProps {
  open: boolean;
  maintenancePlan?: PlanDraft | null;
  users: UserProfile[];
  assets: Asset[];
  onClose: () => void;
  onSaved: () => void;
}

const options = (values: string[]) => values.map((value) => ({ value, label: value }));
const typeOptions = options(['Planned', 'UnPlanned', 'Other']);
const priorityOptions = options(['Low', 'Medium', 'High']);
const statusOptions = options(['Pending', 'In Progress', 'Completed', 'Cancelled']);

function initialValues(plan: PlanDraft | null | undefined) {
  return {
    planned_starting_date: toInputValue(plan?.planned_starting_date),
    planned_finished: toInputValue(plan?.planned_finished),
    name: plan?.name ?? '',
    ref: plan?.ref ?? '',
    assigned_to: plan?.assigned_to?.id != null ? String(plan.assigned_to.id) : '',
    asset: plan?.asset?.uuid ?? '',
    started_at: toInputValue(plan?.started_at),
    finished_at: toInputValue(plan?.finished_at),
    type: plan?.type ?? 'Planned',
    priority: plan?.priority ?? 'Medium',
    status: plan?.status ?? 'Pending',
    estimated_cost: plan?.estimated_cost ?? '',
  };
}

type Values = ReturnType<typeof initialValues>;

function validate(values: Values): FormErrors<Values> {
  const errors = requireFields(values, [
    'name',
    'ref',
    'assigned_to',
    'asset',
    'planned_starting_date',
    'planned_finished',
  ]);
  if (
    !errors.planned_finished &&
    values.planned_starting_date &&
    values.planned_finished < values.planned_starting_date
  ) {
    errors.planned_finished = 'Must be after the planned start';
  }
  return errors;
}

export default function MaintenanceEditForm(props: MaintenanceFormProps) {
  return <MaintenanceFormBody key={useOpenCount(props.open)} {...props} />;
}

function MaintenanceFormBody({
  open,
  maintenancePlan,
  users,
  assets,
  onClose,
  onSaved,
}: MaintenanceFormProps) {
  const { values, set, errors, submit } = useForm(() => initialValues(maintenancePlan), validate);
  const [instructions, setInstructions] = useState<File | null>(null);
  const save = useSaveItem('/api/maintenance-plans/', 'Maintenance Plan');
  // Edit only when the plan already exists.
  const isEdit = Boolean(maintenancePlan?.uuid);

  const onSubmit = () =>
    submit((v) =>
      save.mutate(
        {
          uuid: isEdit ? maintenancePlan!.uuid : undefined,
          values: {
            ...v,
            planned_starting_date: fromInputValue(v.planned_starting_date),
            planned_finished: fromInputValue(v.planned_finished),
            started_at: fromInputValue(v.started_at),
            finished_at: fromInputValue(v.finished_at),
            instructions,
          },
        },
        { onSuccess: onSaved },
      ),
    );

  return (
    <FormDrawer
      open={open}
      title={isEdit ? 'Edit Maintenance Plan' : 'New Maintenance Plan'}
      submitLabel={isEdit ? 'Save' : 'Create'}
      busy={save.isPending}
      onClose={onClose}
      onSubmit={onSubmit}
    >
      <FormSection title="Basic Information">
        <DateTimeInput
          label="Planned Start"
          value={values.planned_starting_date}
          onChange={set('planned_starting_date')}
          error={errors.planned_starting_date}
          required
        />
        <DateTimeInput
          label="Planned Finish"
          value={values.planned_finished}
          onChange={set('planned_finished')}
          error={errors.planned_finished}
          required
        />
        <TextInput label="Name" value={values.name} onChange={set('name')} error={errors.name} required />
        <TextInput label="Reference" value={values.ref} onChange={set('ref')} error={errors.ref} required />
        <SelectInput
          label="Assigned To"
          width="half"
          value={values.assigned_to}
          onChange={set('assigned_to')}
          error={errors.assigned_to}
          required
          options={users.map((u) => ({ value: String(u.user.id), label: u.user.username }))}
        />
        <SelectInput
          label="Asset"
          width="half"
          value={values.asset}
          onChange={set('asset')}
          error={errors.asset}
          required
          options={assets.map((a) => ({ value: a.uuid, label: a.name }))}
        />
      </FormSection>

      <FormSection title="Additional Information">
        <DateTimeInput label="Actual Start" value={values.started_at} onChange={set('started_at')} />
        <DateTimeInput label="Actual Finish" value={values.finished_at} onChange={set('finished_at')} />
        <SelectInput
          label="Type"
          width="half"
          value={values.type}
          onChange={(v) => set('type')(v as Values['type'])}
          options={typeOptions}
        />
        <SelectInput
          label="Priority"
          width="half"
          value={values.priority}
          onChange={(v) => set('priority')(v as Values['priority'])}
          options={priorityOptions}
        />
        <SelectInput
          label="Status"
          width="half"
          value={values.status}
          onChange={(v) => set('status')(v as Values['status'])}
          options={statusOptions}
        />
        <TextInput
          label="Estimated Cost"
          type="number"
          width="half"
          value={values.estimated_cost}
          onChange={set('estimated_cost')}
        />
        <FileInput label="Upload Instructions" file={instructions} onChange={setInstructions} />
      </FormSection>
    </FormDrawer>
  );
}
