import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db import models, transaction
from django.db.models.signals import post_save
from django.dispatch import receiver

from db.models import EVENT_STATES, Asset, BasicInfo, Organization

logger = logging.getLogger(__name__)


class MachineFault(BasicInfo):
    name = models.CharField(max_length=100, default='')
    machine = models.ForeignKey(Asset, on_delete=models.CASCADE)

    def __str__(self):
        return self.name + ' ' + self.machine.name


class Cell(BasicInfo):
    machine = models.ForeignKey(Asset, on_delete=models.CASCADE)
    name = models.CharField(max_length=50, default="Cell")

    def __str__(self):
        return str(self.name)


class Product(BasicInfo):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE)
    product_id = models.CharField(default='', max_length=200)
    product_name = models.CharField(default='', max_length=200)
    # Minutes per piece (the OEE's performance).
    ideal_cycle = models.FloatField(default=0)

    class Meta:
        constraints = [
            # Each organization has its own product ids.
            models.UniqueConstraint(fields=['organization', 'product_id'], name='unique_product_id_per_organization'),
        ]


class Event(BasicInfo):
    # Deleted with their line (they mean nothing without it).
    machine = models.ForeignKey(Asset, on_delete=models.CASCADE)
    state = models.CharField(max_length=50, choices=EVENT_STATES, default='')
    product = models.ForeignKey(Product, on_delete=models.SET_NULL, blank=True, null=True)
    cell = models.ForeignKey(Cell, on_delete=models.SET_NULL, blank=True, null=True)
    fault = models.ForeignKey(MachineFault, on_delete=models.SET_NULL, blank=True, null=True)
    quantity = models.IntegerField(default=0)
    scrap = models.IntegerField(default=0)
    is_filled = models.BooleanField(default=False)

    class Meta:
        indexes = [
            # Every OEE query reads one line's events in a time window.
            models.Index(fields=['machine', 'created_at'], name='event_machine_created_at'),
        ]

    def __str__(self):
        return f'Event: {self.state} of line: {self.machine.name}'


@receiver(post_save, sender=Event)
def create_first_oee_data(sender, instance=None, created=False, **kwargs):
    """Keeps the line's state in sync and tells its live views (WebSockets) to reload."""
    if not created:
        return
    machine = instance.machine
    machine.state = instance.state
    machine.save(update_fields=['state', 'last_updated_at'])
    if instance.is_filled:
        return  # the event sent by the operator comes right after these: one reload for all

    # After the commit: the live views must not reload before the event is visible to them
    # (or at all, when the transaction is rolled back).
    transaction.on_commit(lambda: notify_live_views(machine))


def notify_live_views(machine):
    # The consumers (consumers.py) reload their data themselves: the message carries no data.
    suffix = f'{machine.organization_id}_{machine.uuid}'
    try:
        channel_layer = get_channel_layer()
        for prefix, handler in (('report', 'report_message'), ('data', 'data_message'), ('oee', 'oee_message')):
            async_to_sync(channel_layer.group_send)(f'{prefix}_{suffix}', {'type': handler})
    except Exception:  # Redis down: the event is saved, only the live update is lost.
        logger.exception('Could not notify the live views of line %s', machine.uuid)


@receiver(post_save, sender=Asset)
def create_off_event(sender, instance, created, **kwargs):
    if created:
        Event.objects.create(machine=instance, state='on')
        Event.objects.create(machine=instance, state='off')
