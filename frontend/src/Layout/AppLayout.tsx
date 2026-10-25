import { useState, type ReactNode } from 'react';
import { Box, Toolbar } from '@mui/material';
import { useTheme } from '@mui/material/styles';

import Nav from './Nav/Nav';
import SidebarMiniDrawer from './Sidebar/MiniSidebar';

// Frame of the logged-in app: side menu, top bar, page content.
export default function AppLayout({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(true);
  const { sidebarWidth, sidebarMiniWidth } = useTheme().layout;
  const menuWidth = menuOpen ? sidebarWidth : sidebarMiniWidth;

  return (
    <Box sx={{ display: 'flex', width: '100vw', overflowX: 'hidden' }}>
      <SidebarMiniDrawer open={menuOpen} />
      <Nav menuOpen={menuOpen} onToggleMenu={() => setMenuOpen((open) => !open)} />
      <Box
        component="main"
        sx={(theme) => ({
          flexGrow: 1,
          ml: `${menuWidth}px`,
          px: 2,
          pb: 2,
          minWidth: 0,
          width: `calc(100vw - ${menuWidth}px)`,
          overflowX: 'hidden',
          transition: theme.transitions.create(['margin', 'width'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.shortest,
          }),
        })}
      >
        {/* Keeps the content below the fixed top bar */}
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
}
