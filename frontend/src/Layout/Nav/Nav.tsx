import { useState } from 'react';
import { Link as RouterLink } from 'react-router';
import { AppBar, Box, IconButton, Menu, MenuItem, Toolbar, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import AccountCircle from '@mui/icons-material/AccountCircle';
import MenuIcon from '@mui/icons-material/Menu';

import { useAuth } from '../../auth/AuthContext';
import { FEATURE_CMMS, FEATURE_OEE } from '../../Config';

interface NavProps {
  menuOpen: boolean;
  onToggleMenu: () => void;
}

// Top bar: menu toggle, shortcuts to the main areas (admins), account menu.
export default function Nav({ menuOpen, onToggleMenu }: NavProps) {
  const { logout, isAdmin } = useAuth();
  const [accountAnchor, setAccountAnchor] = useState<HTMLElement | null>(null);
  const { sidebarWidth, sidebarMiniWidth } = useTheme().layout;
  const left = menuOpen ? sidebarWidth : sidebarMiniWidth;

  const shortcuts = [
    { label: 'Dashboards', to: '/dashboards/live', show: FEATURE_OEE },
    { label: 'CMMS', to: '/cmms/dashboards/assets', show: FEATURE_CMMS },
    { label: 'Admin', to: '/admin/assets/table', show: true },
  ].filter((shortcut) => isAdmin && shortcut.show);

  return (
    <AppBar
      position="fixed"
      color="default"
      elevation={0}
      sx={(theme) => ({
        zIndex: theme.zIndex.drawer - 1,
        ml: `${left}px`,
        width: `calc(100% - ${left}px)`,
        borderBottom: '1px solid',
        borderColor: 'divider',
        transition: theme.transitions.create(['width', 'margin'], {
          easing: theme.transitions.easing.sharp,
          duration: theme.transitions.duration.shortest,
        }),
      })}
    >
      <Toolbar>
        <IconButton edge="start" onClick={onToggleMenu} sx={{ mr: 2 }} aria-label="Toggle menu">
          <MenuIcon />
        </IconButton>

        <Box
          component="nav"
          aria-label="Areas"
          sx={{ display: 'flex', gap: 2, alignItems: 'center', flexGrow: 1 }}
        >
          {shortcuts.map((shortcut) => (
            <Typography
              key={shortcut.label}
              component={RouterLink}
              to={shortcut.to}
              sx={{ textDecoration: 'none', color: 'primary.main', fontWeight: 600 }}
            >
              {shortcut.label}
            </Typography>
          ))}
        </Box>

        <IconButton onClick={(e) => setAccountAnchor(e.currentTarget)} aria-label="Account menu">
          <AccountCircle />
        </IconButton>
        <Menu
          anchorEl={accountAnchor}
          open={accountAnchor !== null}
          onClose={() => setAccountAnchor(null)}
          keepMounted
        >
          <MenuItem
            onClick={() => {
              setAccountAnchor(null);
              logout();
            }}
          >
            Logout
          </MenuItem>
          <MenuItem disabled>Delete profile (coming soon)</MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
}
