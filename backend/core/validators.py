"""Validators for uploaded files."""

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import FileExtensionValidator, validate_image_file_extension


def validate_upload_size(file):
    limit_mb = settings.MAX_UPLOAD_SIZE_MB
    if file.size > limit_mb * 1024 * 1024:
        raise ValidationError(f'The file is too large (at most {limit_mb} MB).', code='file_too_large')


IMAGE_UPLOAD_VALIDATORS = [validate_image_file_extension, validate_upload_size]
PDF_UPLOAD_VALIDATORS = [FileExtensionValidator(['pdf']), validate_upload_size]
