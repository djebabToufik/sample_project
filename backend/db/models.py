import uuid

import django.utils.timezone as timezone
from django.conf import settings
from django.contrib.auth.models import User
from django.core.mail import send_mail
from django.db import models
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver
from django.template.loader import render_to_string
from django_rest_passwordreset.signals import reset_password_token_created

# The states of a line, sent as events (state.models.Event) and kept on the asset.
EVENT_STATES = (
    ("on", "on"),
    ("off", "off"),
    ("run", "run"),
    ("stop", "stop"),
    ("out of order", "out of order"),
    ("resume out of order", "resume out of order"),
    ("failure", "failure"),
    ("resume failure", "resume failure"),
    ("break in", "break in"),
    ("resume break in", "resume break in"),
    ("break out", "break out"),
    ("resume break out", "resume break out"),
    ("fault", "fault"),
    ("resume fault", "resume fault"),
    ("report", "report"),
)


# Named, so the API documentation gives each its own name (settings.SPECTACULAR_SETTINGS).
ASSET_STATUSES = [
    ('Active', 'Active'),
    ('Inactive', 'Inactive'),
    ('Under Maintenance', 'Under Maintenance'),
    ('Retired', 'Retired'),
]
MAINTENANCE_STATUSES = [
    ('Pending', 'Pending'),
    ('In Progress', 'In Progress'),
    ('Completed', 'Completed'),
    ('Cancelled', 'Cancelled'),
]


class BasicInfo(models.Model):
    uuid = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Organization(BasicInfo):
    name = models.CharField(max_length=250)
    subdomain = models.CharField(max_length=250)
    max_assets = models.IntegerField(default=3)
    max_users = models.IntegerField(default=2)
    max_active_orders = models.IntegerField(default=100)
    demo = models.BooleanField(default=False)

    def __str__(self):
        return 'Organization ' + self.name


class UserProfile(BasicInfo):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE)
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    # Empty when none was uploaded.
    profile_photo = models.ImageField(blank=True, default='', upload_to='profile_images')
    type = models.CharField(
        max_length=50,
        default='Admin',
        choices=[
            ('Admin', 'Admin'),
            ('Reporter', 'Reporter'),
        ],
    )

    def __str__(self):
        return self.user.username


class Asset(models.Model):
    uuid = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE)
    name = models.CharField(max_length=250, default='', blank=True)
    ref = models.CharField(max_length=250, default='', blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_updated_at = models.DateTimeField(auto_now=True)
    # Empty when none was uploaded (the frontend shows the brand's placeholder).
    photo = models.ImageField(blank=True, default='', upload_to='machine_images')
    purchase_date = models.DateTimeField(blank=True, null=True)
    asset_type = models.CharField(
        max_length=100,
        default="Other",
        choices=[
            ('Vehicle', 'Vehicle'),
            ('Equipment', 'Equipment'),
            ('Building', 'Building'),
            ('Furniture', 'Furniture'),
            ('IT', 'IT'),
            ('Other', 'Other'),
        ],
    )
    location = models.CharField(max_length=250, default='', blank=True)
    serial_number = models.CharField(max_length=100, default='')
    warranty_expiration_date = models.DateTimeField(blank=True, null=True)

    running_hour_consumption_kw = models.FloatField(default=0, blank=True)
    on_hour_consumption_kw = models.FloatField(default=0, blank=True)
    running_hour_cost = models.FloatField(default=0, blank=True)
    on_hour_cost = models.FloatField(default=0, blank=True)

    cost = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    current_value = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True, default=0)
    status = models.CharField(
        max_length=50,
        default='Active',
        choices=ASSET_STATUSES,
    )
    state = models.CharField(max_length=50, choices=EVENT_STATES, default='', blank=True)

    def __str__(self):
        return self.name


class MaintenancePlan(BasicInfo):
    # Plans in these statuses are closed: they don't count as active orders.
    CLOSED_STATUSES = ('Completed', 'Cancelled')

    name = models.CharField(max_length=250, default='', blank=True)
    ref = models.CharField(max_length=250, default='', blank=True)
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='maintenance_plans_created'
    )
    assigned_to = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='maintenance_plans_assigned'
    )
    # PROTECT: an asset with plans can't be deleted (its maintenance history would be lost); retire it instead.
    asset = models.ForeignKey(Asset, on_delete=models.PROTECT, blank=True, null=True)
    planned_starting_date = models.DateTimeField(blank=True, null=True)
    planned_finished = models.DateTimeField(blank=True, null=True)
    started_at = models.DateTimeField(blank=True, null=True)
    finished_at = models.DateTimeField(blank=True, null=True)
    # Empty when none were uploaded.
    instructions = models.FileField(blank=True, default='', upload_to='instructions')
    type = models.CharField(
        max_length=100,
        default="Planned",
        choices=[('Planned', 'Planned'), ('Other', 'Other'), ('UnPlanned', 'UnPlanned')],
    )
    priority = models.CharField(
        max_length=50, default='Medium', choices=[('Low', 'Low'), ('Medium', 'Medium'), ('High', 'High')]
    )
    status = models.CharField(
        max_length=50,
        default='Pending',
        choices=MAINTENANCE_STATUSES,
    )
    estimated_cost = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)

    def __str__(self):
        return self.name or str(self.uuid)


@receiver(post_delete, sender=UserProfile)
def delete_user_after_custom_client_user_delete(sender, instance, **kwargs):
    if instance.user_id:
        User.objects.filter(id=instance.user_id).delete()


@receiver(post_save, sender=MaintenancePlan)
@receiver(post_delete, sender=MaintenancePlan)
def synchronize_asset_status(sender, instance=None, **kwargs):
    """An asset is Under Maintenance while any of its plans is In Progress, else Active."""
    # Looked up by id: when the asset itself is deleted, its plans' delete signals come after it.
    asset = Asset.objects.filter(pk=instance.asset_id).exclude(status__in=['Inactive', 'Retired']).first()
    if asset is None:
        return
    in_progress = MaintenancePlan.objects.filter(asset=asset, status='In Progress').exists()
    status = 'Under Maintenance' if in_progress else 'Active'
    if asset.status != status:
        asset.status = status
        asset.save(update_fields=['status', 'last_updated_at'])


@receiver(reset_password_token_created)
def password_reset_token_created(sender, instance, reset_password_token, *args, **kwargs):
    """
    Handles password reset tokens
    When a token is created, an e-mail needs to be sent to the user
    :param sender: View Class that sent the signal
    :param instance: View Instance that sent the signal
    :param reset_password_token: Token Model Object
    :param args:
    :param kwargs:
    :return:
    """
    context = {
        'current_user': reset_password_token.user,
        'username': reset_password_token.user.username,
        'email': reset_password_token.user.email,
        'pin_code': reset_password_token.key,
    }
    email_html_message = render_to_string('db/user_reset_password.html', context)
    send_mail("Password reset", email_html_message, settings.EMAIL_HOST_USER, [reset_password_token.user.email])
