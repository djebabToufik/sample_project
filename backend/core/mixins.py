"""View mixins."""

from rest_framework.permissions import SAFE_METHODS

from .organization import get_organization


class ReadWriteSerializerMixin:
    """
    One endpoint per resource: reads answer with `read_serializer_class` (related objects
    nested), writes take `serializer_class` (related objects by id).
    """

    read_serializer_class = None

    def get_serializer_class(self):
        if self.request.method in SAFE_METHODS:
            return self.read_serializer_class
        return super().get_serializer_class()


class OrganizationScopedMixin:
    """
    Limits a view's queryset to the requesting user's organization.

    Objects of other organizations then don't exist for the view: lists leave them out and
    detail routes (retrieve, update, delete) answer 404.
    """

    # Lookup from the model to its Organization, e.g. 'asset__organization'.
    organization_lookup = 'organization'

    def get_organization(self):
        return get_organization(self.request.user)

    def get_queryset(self):
        return super().get_queryset().filter(**{self.organization_lookup: self.get_organization()})
