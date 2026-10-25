import FormDrawer, { FormSection } from '../../../components/form/FormDrawer';
import { SelectInput, TextInput } from '../../../components/form/fields';
import { requireFields, useForm, type FormErrors } from '../../../components/form/useForm';
import { useOpenCount } from '../../../components/form/useOpenCount';
import { useSaveItem } from '../../../data/queries';

interface UserFormProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

interface Values {
  first_name: string;
  last_name: string;
  username: string;
  email: string;
  type: string;
}

function validate(values: Values): FormErrors<Values> {
  const errors = requireFields(values, ['first_name', 'last_name', 'username', 'email']);
  if (!errors.email && !/^[^\s@]+@[^\s@]+$/.test(values.email)) errors.email = 'Please enter a valid email';
  return errors;
}

const typeOptions = [
  { value: 'Admin', label: 'Admin' },
  { value: 'Reporter', label: 'Reporter' },
];

// Invite a user to the organization (the backend sends them an email). Users are not edited here.
export default function UserForm(props: UserFormProps) {
  return <UserFormBody key={useOpenCount(props.open)} {...props} />;
}

function UserFormBody({ open, onClose, onSaved }: UserFormProps) {
  const { values, set, errors, submit } = useForm<Values>(
    { first_name: '', last_name: '', username: '', email: '', type: 'Admin' },
    validate,
  );
  const save = useSaveItem(
    '/api/users/',
    'User',
    'User invited. They get an email with a link to set their password.',
  );

  const onSubmit = () => submit((v) => save.mutate({ values: { ...v } }, { onSuccess: onSaved }));

  return (
    <FormDrawer
      open={open}
      title="Add User"
      submitLabel="Create"
      busy={save.isPending}
      onClose={onClose}
      onSubmit={onSubmit}
    >
      <FormSection title="Basic Information">
        <TextInput
          label="First Name"
          width="half"
          value={values.first_name}
          onChange={set('first_name')}
          error={errors.first_name}
          required
        />
        <TextInput
          label="Last Name"
          width="half"
          value={values.last_name}
          onChange={set('last_name')}
          error={errors.last_name}
          required
        />
        <TextInput
          label="Username"
          value={values.username}
          onChange={set('username')}
          error={errors.username}
          required
        />
        <TextInput
          label="Email Address"
          type="email"
          value={values.email}
          onChange={set('email')}
          error={errors.email}
          required
        />
        <SelectInput label="Role" value={values.type} onChange={set('type')} options={typeOptions} />
      </FormSection>
    </FormDrawer>
  );
}
