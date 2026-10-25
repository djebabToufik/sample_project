"""Docker healthcheck: healthy when the app answers HTTP requests without a server error."""

import sys
import urllib.error
import urllib.request

try:
    urllib.request.urlopen('http://localhost:8000/admin/login/', timeout=4)
except urllib.error.HTTPError as error:
    # 4xx (e.g. a host name not in OEE_ALLOWED_HOSTS) still means the server is up.
    sys.exit(1 if error.code >= 500 else 0)
except OSError:
    sys.exit(1)
