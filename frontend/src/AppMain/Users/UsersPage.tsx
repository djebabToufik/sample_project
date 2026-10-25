import PersonIcon from '@mui/icons-material/Person';

import DataTable, { type Column } from '../../components/DataTable';
import ListPage from '../../components/ListPage';
import { queryKeys, useDeleteMany, useRefresh, useUsers } from '../../data/queries';
import type { User, UserProfile } from '../../data/types';
import UserForm from './UserForm/UserForm';
import UserModal from './UserForm/UserModal';

// Rows are user profiles; the account data is in row.user.
const columns: Column<UserProfile>[] = [
  {
    id: 'username',
    label: 'Username',
    render: (row) => row.user?.username,
    sortValue: (row) => row.user?.username,
  },
  { id: 'email', label: 'E-mail', render: (row) => row.user?.email, sortValue: (row) => row.user?.email },
  {
    id: 'status',
    label: 'Status',
    render: (row) => (row.invitation_pending ? 'Invited' : 'Active'),
    sortValue: (row) => (row.invitation_pending ? 'Invited' : 'Active'),
  },
];

export default function UsersPage() {
  const users = useUsers();
  const refresh = useRefresh(queryKeys.users);
  const remove = useDeleteMany({
    path: '/api/users/',
    label: 'Users',
    invalidate: [queryKeys.users],
  });

  return (
    <ListPage icon={<PersonIcon />} title="Users table" loading={users.isPending || remove.isPending}>
      <DataTable<UserProfile, User>
        title="Users"
        rows={users.data ?? []}
        columns={columns}
        defaultOrderBy="username"
        onDelete={remove.mutateAsync}
        onUpdate={refresh}
        selectedItem={(row) => row.user}
        allowEdit={false}
        renderView={({ open, row, onClose }) => (
          <UserModal
            open={open}
            user={row}
            profile={users.data?.find((profile) => profile.user?.id === row?.id)}
            onClose={onClose}
          />
        )}
        renderForm={({ open, onClose, onSaved }) => (
          <UserForm open={open} onClose={onClose} onSaved={onSaved} />
        )}
      />
    </ListPage>
  );
}
