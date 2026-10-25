"""How API requests are authenticated: the web app's session cookie, or an API token for other software."""

from rest_framework import authentication


class SessionAuthentication(authentication.SessionAuthentication):
    """
    DRF's session authentication (CSRF checked on changes), answering 401 instead of 403 when
    nobody is logged in: the frontend treats 401 as "session ended, show the login page".
    """

    def authenticate_header(self, request):
        return 'Session'
