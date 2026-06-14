from datetime import date
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APITestCase
from rest_framework.authtoken.models import Token
from rest_framework import status
import io

from groups.models import Group, GroupMembership
from expenses.models import Expense, ExpenseShare, Settlement
from imports.models import ImportBatch, ImportAnomaly

User = get_user_model()


class ImportPipelineTest(APITestCase):
    def setUp(self):
        # Create user / authenticator
        self.payer = User.objects.create_user(
            username="payer@example.com",
            email="payer@example.com",
            password="password123",
            name="Priya",
        )
        self.member1 = User.objects.create_user(
            username="m1@example.com",
            email="m1@example.com",
            password="password123",
            name="Rohan",
        )
        self.token = Token.objects.create(user=self.payer)
        self.client.credentials(HTTP_AUTHORIZATION="Token " + self.token.key)

        self.group = Group.objects.create(name="Import Group")

        # Member Priya is active from Feb 1st, Rohan is active from Feb 1st to Mar 28th
        GroupMembership.objects.create(
            group=self.group, user=self.payer, joined_at=date(2026, 2, 1)
        )
        GroupMembership.objects.create(
            group=self.group,
            user=self.member1,
            joined_at=date(2026, 2, 1),
            left_at=date(2026, 3, 28),
        )

    def test_rule_3_exact_duplicate(self):
        """
        Rule 3: Exact duplicate row
        Import first, skip second, log both as anomaly.
        """
        csv_content = (
            "Date,Description,Amount,Currency,Payer,Split Type,Split Details\n"
            "2026-02-15,Dinner,150.00,INR,Priya,equal,\n"
            "2026-02-15,Dinner,150.00,INR,Priya,equal,\n"
        )
        csv_file = io.BytesIO(csv_content.encode("utf-8"))
        csv_file.name = "exact_dup.csv"

        response = self.client.post(
            "/api/imports/upload/",
            {"group": self.group.id, "file": csv_file},
            format="multipart"
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["row_count"], 2)

        # Check that only 1 expense was created
        expenses = Expense.objects.filter(group=self.group)
        self.assertEqual(expenses.count(), 1)
        self.assertEqual(expenses.first().amount_inr, Decimal("150.00"))

        # Check anomalies
        anomalies = ImportAnomaly.objects.filter(batch_id=response.data["batch_id"])
        # Should have 1 exact_duplicate anomaly
        self.assertTrue(anomalies.filter(anomaly_type="exact_duplicate").exists())
        exact_anom = anomalies.filter(anomaly_type="exact_duplicate").first()
        self.assertEqual(exact_anom.status, ImportAnomaly.AUTO_HANDLED)

    def test_rule_4_conflicting_duplicate(self):
        """
        Rule 4: Conflicting duplicate rows
        Import both but mark status as disputed, and log both.
        """
        csv_content = (
            "Date,Description,Amount,Currency,Payer,Split Type,Split Details\n"
            "2026-02-15,Dinner Rohan,150.00,INR,Priya,equal,\n"
            "2026-02-15,Dinner Priya,150.00,INR,Priya,percentage,Priya:100\n"
        )
        csv_file = io.BytesIO(csv_content.encode("utf-8"))
        csv_file.name = "conflict_dup.csv"

        response = self.client.post(
            "/api/imports/upload/",
            {"group": self.group.id, "file": csv_file},
            format="multipart"
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # Check that both expenses were created
        expenses = Expense.objects.filter(group=self.group)
        self.assertEqual(expenses.count(), 2)

        # Both should have status 'disputed'
        for exp in expenses:
            self.assertEqual(exp.status, Expense.DISPUTED)

        # Check conflicting duplicate anomalies
        anomalies = ImportAnomaly.objects.filter(batch_id=response.data["batch_id"])
        self.assertEqual(anomalies.filter(anomaly_type="conflicting_duplicate").count(), 2)

    def test_rule_5_settlement_as_expense(self):
        """
        Rule 5: Settlement logged as expense
        Create settlement row instead of expense.
        """
        csv_content = (
            "Date,Description,Amount,Currency,Payer,Split Type,Split Details\n"
            "2026-02-15,Settle up debt,120.00,INR,Priya,exact,Rohan:120\n"
        )
        csv_file = io.BytesIO(csv_content.encode("utf-8"))
        csv_file.name = "settle_as_exp.csv"

        response = self.client.post(
            "/api/imports/upload/",
            {"group": self.group.id, "file": csv_file},
            format="multipart"
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # No expense should be created
        self.assertEqual(Expense.objects.filter(group=self.group).count(), 0)

        # 1 Settlement should be created
        settlements = Settlement.objects.filter(group=self.group)
        self.assertEqual(settlements.count(), 1)
        self.assertEqual(settlements.first().amount_inr, Decimal("120.00"))
        self.assertEqual(settlements.first().paid_by, self.payer)
        self.assertEqual(settlements.first().paid_to, self.member1)

        # Anomaly logged
        anomalies = ImportAnomaly.objects.filter(batch_id=response.data["batch_id"])
        self.assertTrue(anomalies.filter(anomaly_type="settlement_as_expense").exists())

    def test_rule_12_missing_payer_blocks_creation(self):
        """
        Rule 12: Missing payer blocks database row creation and sets anomaly to needs_review.
        """
        csv_content = (
            "Date,Description,Amount,Currency,Payer,Split Type,Split Details\n"
            "2026-02-15,Dinner,,INR,,equal,\n"
        )
        csv_file = io.BytesIO(csv_content.encode("utf-8"))
        csv_file.name = "missing_payer.csv"

        response = self.client.post(
            "/api/imports/upload/",
            {"group": self.group.id, "file": csv_file},
            format="multipart"
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # No expense or settlement created
        self.assertEqual(Expense.objects.filter(group=self.group).count(), 0)
        self.assertEqual(Settlement.objects.filter(group=self.group).count(), 0)

        # Anomaly should be needs_review
        anomalies = ImportAnomaly.objects.filter(batch_id=response.data["batch_id"])
        self.assertTrue(anomalies.filter(anomaly_type="missing_payer").exists())
        self.assertEqual(anomalies.filter(anomaly_type="missing_payer").first().status, ImportAnomaly.NEEDS_REVIEW)

        # Test resolution via resolve endpoint
        anomaly = anomalies.filter(anomaly_type="missing_payer").first()
        resolve_response = self.client.post(
            f"/api/imports/anomalies/{anomaly.id}/resolve/",
            {"action": "approve", "payer_id": self.payer.id},
            format="json"
        )
        self.assertEqual(resolve_response.status_code, status.HTTP_200_OK)
        
        # Verify expense created after manual approval
        self.assertEqual(Expense.objects.filter(group=self.group).count(), 1)
        anomaly.refresh_from_db()
        self.assertEqual(anomaly.status, ImportAnomaly.RESOLVED)

    def test_rule_16_member_outside_window(self):
        """
        Rule 16: Member outside membership window
        Exclude from split, recompute, flag.
        Rohan is active until Mar 28th. Dinner on Apr 1st split with Rohan should exclude Rohan.
        """
        csv_content = (
            "Date,Description,Amount,Currency,Payer,Split Type,Split Details\n"
            "2026-04-01,Dinner,100.00,INR,Priya,equal,\"Priya:1,Rohan:1\"\n"
        )
        csv_file = io.BytesIO(csv_content.encode("utf-8"))
        csv_file.name = "outside_window.csv"

        response = self.client.post(
            "/api/imports/upload/",
            {"group": self.group.id, "file": csv_file},
            format="multipart"
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # Expense should be created
        expenses = Expense.objects.filter(group=self.group)
        self.assertEqual(expenses.count(), 1)
        
        # Priya should be the only one in the split, owing 100% (100 INR)
        shares = ExpenseShare.objects.filter(expense=expenses.first())
        self.assertEqual(shares.count(), 1)
        self.assertEqual(shares.first().user, self.payer)
        self.assertEqual(shares.first().share_amount_inr, Decimal("100.00"))

        # Anomaly logged
        anomalies = ImportAnomaly.objects.filter(batch_id=response.data["batch_id"])
        self.assertTrue(anomalies.filter(anomaly_type="member_outside_window").exists())
