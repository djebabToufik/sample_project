import { Box, Button, Typography } from '@mui/material';

import ViewDrawer, { InfoRow, InfoSection, formatDateTime } from '../../../components/form/ViewDrawer';
import { useResendInvitation } from '../../../data/queries';
import type { User, UserProfile } from '../../../data/types';

interface UserModalProps {
  open: boolean;
  user: User | null | undefined;
  /** The user's profile in the organization (role, invitation status) */
  profile?: UserProfile;
  onClose: () => void;
}

export default function UserModal({ open, user, profile, onClose }: UserModalProps) {
  const resend = useResendInvitation();
  const pending = Boolean(profile?.invitation_pending);

  return (
    <ViewDrawer open={open} title="View User" onClose={onClose}>
      <InfoSection title="Basic Information">
        <InfoRow label="First Name" value={user?.first_name} />
        <InfoRow label="Last Name" value={user?.last_name} />
        <InfoRow label="Username" value={user?.username} />
        <InfoRow label="Email" value={user?.email} />
        <InfoRow label="Role" value={profile?.type} />
        <InfoRow label="Status" value={pending ? 'Invited (no password set yet)' : 'Active'} />
        <InfoRow label="Last login" value={formatDateTime(user?.last_login, 'Never')} />
        <InfoRow label="Date joined" value={formatDateTime(user?.date_joined)} />
      </InfoSection>
      {pending && profile && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" sx={{ mb: 1 }}>
            The invitation link works once and expires. Send a new one if it was lost or expired.
          </Typography>
          <Button variant="outlined" disabled={resend.isPending} onClick={() => resend.mutate(profile.uuid)}>
            Resend invitation
          </Button>
        </Box>
      )}
    </ViewDrawer>
  );
}
