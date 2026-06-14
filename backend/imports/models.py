"""
ImportBatch and ImportAnomaly models.

These models satisfy Meera's requirement: "Clean up duplicates — but I want to
approve anything the app deletes or changes."

Every decision the importer makes — normalising a name, skipping a duplicate,
re-routing a settlement — is recorded as an ImportAnomaly row. Nothing is
silently deleted or merged.

ImportBatch:
  One row per uploaded CSV file. Tracks who ran the import and a summary count.

ImportAnomaly:
  One row per detected issue within a batch. Each row records:
    - The original CSV row (raw_row, stored as JSON for full auditability)
    - What type of problem was found (anomaly_type, maps to the 16 categories)
    - What the importer did about it (applied_policy)
    - Whether it needs human review (status = needs_review)
    - Links to any Expense or Settlement row that was created as a result

  If status = 'needs_review', the UI must surface this row for manual action
  before it can be considered resolved.
"""

from django.conf import settings
from django.db import models


class ImportBatch(models.Model):
    filename = models.CharField(max_length=255)
    imported_at = models.DateTimeField(auto_now_add=True)
    imported_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="import_batches",
    )
    row_count = models.IntegerField(default=0)
    anomaly_count = models.IntegerField(default=0)

    class Meta:
        db_table = "import_batches"
        ordering = ["-imported_at"]

    def __str__(self):
        return f"{self.filename} (imported {self.imported_at:%Y-%m-%d %H:%M})"


class ImportAnomaly(models.Model):
    # Maps to the 16 anomaly categories in SCOPE.md / brief Section 6.
    # Using string codes that appear in the import report UI.
    ANOMALY_TYPE_CHOICES = [
        ("mixed_date_format", "Mixed date format"),
        ("ambiguous_date", "Ambiguous date"),
        ("exact_duplicate", "Exact duplicate row"),
        ("conflicting_duplicate", "Conflicting duplicate"),
        ("settlement_as_expense", "Settlement logged as expense"),
        ("usd_amount", "USD amount converted"),
        ("missing_currency", "Missing currency"),
        ("amount_formatting", "Amount formatting issue"),
        ("negative_amount", "Negative amount (refund?)"),
        ("zero_amount", "Zero amount"),
        ("inconsistent_name", "Inconsistent member name"),
        ("missing_payer", "Missing payer"),
        ("percentage_not_100", "Percentages don't sum to 100%"),
        ("split_type_mismatch", "split_type/details mismatch"),
        ("non_member_in_split", "Non-member in split_with"),
        ("member_outside_window", "Member outside membership window"),
        ("excluded_participant", "Participant excluded (not a registered member)"),
    ]

    AUTO_HANDLED = "auto_handled"
    NEEDS_REVIEW = "needs_review"
    RESOLVED = "resolved"
    STATUS_CHOICES = [
        (AUTO_HANDLED, "Auto handled"),
        (NEEDS_REVIEW, "Needs review"),
        (RESOLVED, "Resolved"),
    ]

    batch = models.ForeignKey(
        ImportBatch,
        on_delete=models.CASCADE,
        related_name="anomalies",
    )
    source_row_number = models.IntegerField()

    # The entire original CSV row stored as JSON.
    # This is the "never silently delete" guarantee — the raw data is always here.
    raw_row = models.JSONField()

    anomaly_type = models.CharField(max_length=50, choices=ANOMALY_TYPE_CHOICES)
    description = models.TextField()     # Human-readable explanation of what was found
    applied_policy = models.TextField()  # Human-readable explanation of what was done

    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default=AUTO_HANDLED
    )

    # If an Expense or Settlement was created as a result of this row, link it.
    # nullable because some anomalies (needs_review) don't produce a row yet.
    linked_expense = models.ForeignKey(
        "expenses.Expense",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="anomalies",
    )
    linked_settlement = models.ForeignKey(
        "expenses.Settlement",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="anomalies",
    )

    class Meta:
        db_table = "import_anomalies"
        ordering = ["batch", "source_row_number"]

    def __str__(self):
        return (
            f"Row {self.source_row_number}: {self.anomaly_type} "
            f"[{self.status}] in {self.batch.filename}"
        )
