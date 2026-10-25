"""API errors."""

from rest_framework import status
from rest_framework.exceptions import APIException


class PlanLimitReached(APIException):
    """The organization reached a limit of its plan (assets, users, maintenance orders)."""

    status_code = status.HTTP_402_PAYMENT_REQUIRED
    default_detail = 'You reached the limit of your plan.'
    default_code = 'plan_limit_reached'
