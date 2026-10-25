"""Serializer fields."""

from rest_framework import serializers

from .organization import get_organization


class OrganizationPrimaryKeyRelatedField(serializers.PrimaryKeyRelatedField):
    """
    A related object given by its id, limited to the requesting user's organization.

    An id from another organization is rejected like an id that doesn't exist, so the
    answer doesn't reveal whether it exists elsewhere.
    """

    def __init__(self, organization_lookup='organization', **kwargs):
        self.organization_lookup = organization_lookup
        super().__init__(**kwargs)

    def get_queryset(self):
        queryset = super().get_queryset()
        request = self.context.get('request')
        organization = get_organization(request.user) if request else None
        if organization is None:
            return queryset.none()
        return queryset.filter(**{self.organization_lookup: organization})
