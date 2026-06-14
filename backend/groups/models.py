"""
Groups and GroupMembership models.

Why two tables?
  Groups hold shared metadata (name, created date).
  GroupMembership is a junction table that also carries the join/leave dates —
  this is how Sam's requirement is satisfied: expenses are split only among
  members whose membership window covers the expense date.

  The `left_at` field is nullable — NULL means "still a member."
"""

from django.conf import settings
from django.db import models


class Group(models.Model):
    name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        # Avoid collision with Django's built-in auth.Group table name.
        db_table = "expense_groups"

    def __str__(self):
        return self.name


class GroupMembership(models.Model):
    """
    Records a single membership interval for one user in one group.

    A user who leaves and rejoins would have two rows (different intervals).
    For this project's scope, each person has at most one interval.

    joined_at / left_at are DateField (date only, not datetime) because
    the CSV and brief both speak of join/leave by date, not time-of-day.
    """

    group = models.ForeignKey(
        Group,
        on_delete=models.CASCADE,
        related_name="memberships",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="memberships",
    )
    joined_at = models.DateField()
    left_at = models.DateField(null=True, blank=True)

    class Meta:
        db_table = "group_memberships"
        # One active interval per user per group (enforced at the application layer too).
        unique_together = [("group", "user", "joined_at")]

    def __str__(self):
        end = self.left_at or "present"
        return f"{self.user} in {self.group} ({self.joined_at} → {end})"

    def covers_date(self, date) -> bool:
        """Return True if `date` falls within this membership interval."""
        if date < self.joined_at:
            return False
        if self.left_at is not None and date > self.left_at:
            return False
        return True
