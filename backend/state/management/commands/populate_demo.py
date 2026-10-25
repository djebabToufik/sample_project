import os
import random

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone
from openpyxl import load_workbook

from db.models import Asset, MaintenancePlan, Organization, UserProfile
from state.models import Cell, Event, MachineFault, Product


class Command(BaseCommand):
    """
    Create a superuser if none exist
    Example:
        manage.py createsuperuser_if_none_exists --user=admin --password=changeme
    """

    def handle(self, *args, **options):
        organization = Organization.objects.filter(demo=True).first()
        if organization and organization.demo:
            self.stdout.write('Demo already populated — skipping.')
            return
        if not organization:
            self.stdout.write('Creating demo data, this might take few minutes ...')
            organization = Organization.objects.create(name='Demo Organization', subdomain='demo', demo=True)

        User = get_user_model()
        profile = UserProfile.objects.filter(organization=organization).first()
        if not profile:
            # Prefer an existing superuser, otherwise create one using OEE_SUPERUSER_* env vars
            if User.objects.filter(is_superuser=True).exists():
                user = User.objects.filter(is_superuser=True).first()
            else:
                username = os.getenv('OEE_SUPERUSER_USERNAME')
                password = os.getenv('OEE_SUPERUSER_PASSWORD')
                email = os.getenv('OEE_SUPERUSER_EMAIL', '')
                if not username or not password:
                    self.stdout.write(
                        self.style.WARNING(
                            'OEE_SUPERUSER_USERNAME / OEE_SUPERUSER_PASSWORD not set. Skipping user creation.'
                        )
                    )
                    return
                User.objects.create_superuser(username=username, email=email, password=password)
                user = User.objects.get(username=username)
                self.stdout.write(self.style.SUCCESS(f'Created superuser: {username}'))

            profile = UserProfile.objects.create(organization=organization, user=user, type='Admin')
        else:
            user = profile.user

        date_time_obj = timezone.now()
        product_1 = Product.objects.create(
            organization=organization, product_id='Product_300', product_name='Product_300', ideal_cycle=1
        )
        product_2 = Product.objects.create(
            organization=organization, product_id='Product_310', product_name='Product_310', ideal_cycle=0.5
        )
        wb = load_workbook(filename='state/oee_demo_data.xlsx')
        ws = wb['oee_data']
        list_cells = ['Extruder head', 'Cooling-1', 'Cooling-2', 'Accumulator', 'Winder']
        list_fault = ['Setup', 'Change over', 'Maintenance', 'Technical', 'Materials short', 'Uncategorized']

        events = list(ws.columns)[0]
        products = list(ws.columns)[6]
        quantity = list(ws.columns)[7]
        scrap = list(ws.columns)[8]

        # Spreadsheet rows 4-90: one recorded state per hour, in cycles that each start with "on"
        # (rows 4, 54, 76) and end with the line off. Every demo line replays all rows, starting
        # at another cycle, so the lines show different charts and every state sequence stays valid.
        recorded_rows = list(range(4, 91))
        demo_lines = [('Extrusion line 1', 4), ('Extrusion line 2', 54), ('Extrusion line 3', 76)]
        for line_name, first_row in demo_lines:
            starting_time = date_time_obj - timezone.timedelta(hours=89)
            start = recorded_rows.index(first_row)
            rows = recorded_rows[start:] + recorded_rows[:start]
            line = Asset.objects.create(
                name=line_name,
                organization=organization,
                running_hour_consumption_kw=100,
                on_hour_consumption_kw=75,
                running_hour_cost=200,
                on_hour_cost=150,
            )

            # Create 5 maintenance plans for this machine
            for m in range(5):
                plan = MaintenancePlan.objects.create(
                    name=f"Routine Maintenance {m + 1} for {line_name}",
                    asset=line,
                    created_by=user,
                    assigned_to=user,
                    planned_starting_date=date_time_obj + timezone.timedelta(days=m),
                    planned_finished=date_time_obj + timezone.timedelta(days=m, hours=2),
                    type="Planned",
                    priority=random.choice(["Low", "Medium", "High"]),
                    status="Pending",
                    estimated_cost=100.00 + m * 50,
                )
                self.stdout.write(f"Created MaintenancePlan {plan.name}")

            for cell in list_cells:
                Cell.objects.create(machine=line, name=cell)
            for fault in list_fault:
                MachineFault.objects.create(machine=line, name=fault)

            cells = [cell for cell in Cell.objects.filter(machine=line)]
            faults = [fault for fault in MachineFault.objects.filter(machine=line)]
            for idx in rows:
                row = events[idx]
                if row.value == 'report':
                    if products[idx].value == 'product 1':
                        product = product_1
                    else:
                        product = product_2
                    # adding reports uniformly
                    qty_per_min = quantity[idx].value / 60
                    scrap_per_min = scrap[idx].value / 60
                    r_time = starting_time - timezone.timedelta(hours=1)
                    for _ in range(60):
                        Event.objects.create(
                            machine=line,
                            state='report',
                            quantity=qty_per_min,
                            scrap=scrap_per_min,
                            product=product,
                            created_at=r_time,
                        )
                        r_time = r_time + timezone.timedelta(minutes=1)
                elif row.value in ('fault', 'failure'):
                    Event.objects.create(
                        machine=line,
                        state=row.value,
                        fault=random.choice(faults),
                        cell=random.choice(cells),
                        created_at=starting_time,
                    )
                else:
                    Event.objects.create(machine=line, state=row.value, created_at=starting_time)
                starting_time += timezone.timedelta(hours=1)
