"""Views shared by the apps."""

from django.http import JsonResponse


def csrf_failure(request, reason=''):
    """CSRF_FAILURE_VIEW: a JSON answer the frontend can show, instead of Django's HTML page."""
    return JsonResponse(
        {'detail': 'The security check (CSRF) failed. Reload the page and try again.'},
        status=403,
    )
