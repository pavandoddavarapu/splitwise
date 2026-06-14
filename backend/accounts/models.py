"""
Custom User model for Spreetail.

Why AbstractUser instead of the built-in User?
  - AbstractUser gives us Django's full auth machinery (password hashing,
    session, admin, password validators) without a separate Profile table.
  - We can add fields here freely.
  - AUTH_USER_MODEL = 'accounts.User' is set in settings.py before any
    migration runs — changing it later would require resetting all migrations
    (see DECISIONS.md D-003).

We add a `name` field (full display name) separate from first_name/last_name
because flatmates identified themselves by single names in the CSV.
"""

from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    # `name` is the full display name used throughout the app.
    # first_name / last_name from AbstractUser are still present but unused.
    name = models.CharField(max_length=255, blank=True)

    # created_at mirrors the schema's timestamp column.
    # auto_now_add=True sets it once on INSERT and never updates it.
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "users"

    def __str__(self):
        return self.name or self.username
