"""
Expense, ExpenseShare, and Settlement models.

Architecture note (see DECISIONS.md D-006 and SCOPE.md):
  Balances are NEVER stored. Every balance is computed live as a SUM over
  ExpenseShare rows (and Settlement rows). This is Rohan's requirement —
  every number shown in the UI must be directly traceable to underlying rows.

Expense:
  Represents a real-world payment made by one person on behalf of the group.
  The paid_by person is owed back their share from the others.

ExpenseShare:
  The most important table. One row per (expense, user) pair that is included
  in the split. The sum of all share_amount_inr rows for an expense must equal
  the expense's amount_inr.

  share_raw stores the human-readable split detail (e.g. "33.33%" for percentage,
  "2" for share-based, "500.00" for exact). This is shown in Rohan's drill-down
  so the user can trace exactly how the number was computed.

Settlement:
  A direct payment from one person to another to clear a debt. Reduces both
  parties' outstanding balances. Source field tracks whether it was entered
  manually or detected from the CSV (anomaly #5).
"""

from django.conf import settings
from django.db import models


class Expense(models.Model):
    # ── Choice constants ──────────────────────────────────────────────────────
    EQUAL = "equal"
    PERCENTAGE = "percentage"
    EXACT = "exact"
    SHARE = "share"
    SPLIT_TYPE_CHOICES = [
        (EQUAL, "Equal"),
        (PERCENTAGE, "Percentage"),
        (EXACT, "Exact amounts"),
        (SHARE, "Share / ratio"),
    ]

    ACTIVE = "active"
    DISPUTED = "disputed"
    VOIDED = "voided"
    STATUS_CHOICES = [
        (ACTIVE, "Active"),
        (DISPUTED, "Disputed"),   # Conflicting duplicate rows from CSV (anomaly #4)
        (VOIDED, "Voided"),       # Zero-amount import (anomaly #10)
    ]

    MANUAL = "manual"
    IMPORT = "import"
    SOURCE_CHOICES = [
        (MANUAL, "Manual"),
        (IMPORT, "CSV import"),
    ]

    # ── Fields ────────────────────────────────────────────────────────────────
    group = models.ForeignKey(
        "groups.Group",
        on_delete=models.CASCADE,
        related_name="expenses",
    )
    paid_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,   # Don't cascade-delete expenses if a user is removed
        related_name="expenses_paid",
    )
    description = models.TextField()
    expense_date = models.DateField()

    # Store original values for auditability (especially USD amounts).
    # Priya's requirement: the app must not pretend a dollar is a rupee.
    original_amount = models.DecimalField(max_digits=12, decimal_places=2)
    original_currency = models.CharField(max_length=3, default="INR")

    # Only populated when original_currency != 'INR'.
    # For this project: 83.50 for all USD rows (see DECISIONS.md D-002).
    fx_rate_to_inr = models.DecimalField(
        max_digits=10, decimal_places=4, null=True, blank=True
    )

    # The canonical amount used for all balance calculations.
    # = original_amount * fx_rate_to_inr (if USD), else = original_amount.
    amount_inr = models.DecimalField(max_digits=12, decimal_places=2)

    split_type = models.CharField(
        max_length=20, choices=SPLIT_TYPE_CHOICES, default=EQUAL
    )
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default=ACTIVE
    )
    source = models.CharField(
        max_length=20, choices=SOURCE_CHOICES, default=MANUAL
    )
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "expenses"
        ordering = ["-expense_date", "-created_at"]

    def __str__(self):
        return f"{self.description} (₹{self.amount_inr}) on {self.expense_date}"


class ExpenseShare(models.Model):
    """
    One row per (expense, user) in the split.

    This table is the source of truth for balances. Rohan's drill-down shows
    the list of these rows that sum to his displayed balance.

    share_raw examples by split_type:
      equal       → "equal (4 members)"
      percentage  → "33.33%"
      exact       → "₹500.00"
      share       → "2 shares of 6"
    """

    expense = models.ForeignKey(
        Expense,
        on_delete=models.CASCADE,
        related_name="shares",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="expense_shares",
    )
    share_amount_inr = models.DecimalField(max_digits=12, decimal_places=2)
    # Human-readable record of how this share was computed (for Rohan's drill-down)
    share_raw = models.CharField(max_length=200, blank=True)

    class Meta:
        db_table = "expense_shares"
        unique_together = [("expense", "user")]

    def __str__(self):
        return f"{self.user} owes ₹{self.share_amount_inr} for {self.expense}"


class Settlement(models.Model):
    """
    A direct payment from one person to another to clear a debt.

    Balance formula (DECISIONS.md D-006):
      net = paid_expenses - owed_shares + settlements_received - settlements_paid
    """

    MANUAL = "manual"
    IMPORT = "import"
    SOURCE_CHOICES = [
        (MANUAL, "Manual"),
        (IMPORT, "CSV import"),  # Anomaly #5: settlement detected in CSV
    ]

    group = models.ForeignKey(
        "groups.Group",
        on_delete=models.CASCADE,
        related_name="settlements",
    )
    paid_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="settlements_paid",
    )
    paid_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="settlements_received",
    )
    amount_inr = models.DecimalField(max_digits=12, decimal_places=2)
    settled_at = models.DateTimeField()
    source = models.CharField(
        max_length=20, choices=SOURCE_CHOICES, default=MANUAL
    )
    notes = models.TextField(blank=True)

    class Meta:
        db_table = "settlements"
        ordering = ["-settled_at"]

    def __str__(self):
        return f"{self.paid_by} → {self.paid_to}: ₹{self.amount_inr} on {self.settled_at}"
