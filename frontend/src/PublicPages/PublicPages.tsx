import { Route, Routes } from 'react-router';

import Invitation from './Invitation/Invitation';
import Login from './Login/Login';
import PasswordChange from './PasswordReset/PasswordChange';
import PasswordReset from './PasswordReset/PasswordReset';
import Register from './Register/Register';

// Pages shown while logged out; any other address shows the login.
export default function PublicPages() {
  return (
    <Routes>
      <Route path="/login" Component={Login} />
      <Route path="/register" Component={Register} />
      <Route path="/password-reset-email" Component={PasswordReset} />
      <Route path="/password-change" Component={PasswordChange} />
      <Route path="/invitation" Component={Invitation} />
      <Route path="/*" Component={Login} />
    </Routes>
  );
}
