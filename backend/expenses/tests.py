from datetime import date
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework.authtoken.models import Token
from groups.models import Group, GroupMembership
from expenses.models import Expense, ExpenseShare

User = get_user_model()


class ExpenseSplitLogicTest(APITestCase):
    def setUp(self):
        # Create users
        self.payer = User.objects.create_user(
            username="payer@example.com",
            email="payer@example.com",
            password="password123",
            name="Alice Payer",
        )
        self.member1 = User.objects.create_user(
            username="m1@example.com",
            email="m1@example.com",
            password="password123",
            name="Rohan Member",
        )
        self.member2 = User.objects.create_user(
            username="m2@example.com",
            email="m2@example.com",
            password="password123",
            name="Priya Member",
        )
        self.inactive_member = User.objects.create_user(
            username="inactive@example.com",
            email="inactive@example.com",
            password="password123",
            name="Sam Inactive",
        )

        # Authenticate payer
        self.token = Token.objects.create(user=self.payer)
        self.client.credentials(HTTP_AUTHORIZATION="Token " + self.token.key)

        # Create group
        self.group = Group.objects.create(name="Flat 6")

        # Set up memberships
        # Alice Payer and Rohan Member are active from Feb 1st
        GroupMembership.objects.create(
            group=self.group, user=self.payer, joined_at=date(2026, 2, 1)
        )
        GroupMembership.objects.create(
            group=self.group, user=self.member1, joined_at=date(2026, 2, 1)
        )
        # Priya Member is active Feb 1st to Mar 28th
        GroupMembership.objects.create(
            group=self.group,
            user=self.member2,
            joined_at=date(2026, 2, 1),
            left_at=date(2026, 3, 28),
        )
        # Sam Inactive is only active from Apr 8th
        GroupMembership.objects.create(
            group=self.group,
            user=self.inactive_member,
            joined_at=date(2026, 4, 8),
        )

    def test_equal_split_active_users_only(self):
        """
        Equal split on March 1st should split among Alice, Rohan, Priya.
        Sam is inactive on this date and should be excluded.
        Total: 300.00 INR -> 100.00 INR each.
        """
        data = {
            "group": self.group.id,
            "paid_by": self.payer.id,
            "description": "Electricity March",
            "expense_date": "2026-03-01",
            "original_amount": "300.00",
            "original_currency": "INR",
            "split_type": "equal",
        }
        response = self.client.post("/api/expenses/", data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        expense = Expense.objects.get(id=response.data["id"])
        shares = expense.shares.all()
        # Should be 3 shares (Alice, Rohan, Priya)
        self.assertEqual(shares.count(), 3)

        share_user_ids = {s.user_id for s in shares}
        self.assertIn(self.payer.id, share_user_ids)
        self.assertIn(self.member1.id, share_user_ids)
        self.assertIn(self.member2.id, share_user_ids)
        self.assertNotIn(self.inactive_member.id, share_user_ids)

        for s in shares:
            self.assertEqual(s.share_amount_inr, Decimal("100.00"))
            self.assertEqual(s.share_raw, "equal (3 members)")

    def test_equal_split_after_priya_left(self):
        """
        Equal split on April 1st should split among Alice, Rohan.
        Priya has left (Mar 28th), Sam hasn't joined yet (Apr 8th).
        Total: 200.00 INR -> 100.00 INR each.
        """
        data = {
            "group": self.group.id,
            "paid_by": self.payer.id,
            "description": "Internet April",
            "expense_date": "2026-04-01",
            "original_amount": "200.00",
            "original_currency": "INR",
            "split_type": "equal",
        }
        response = self.client.post("/api/expenses/", data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        expense = Expense.objects.get(id=response.data["id"])
        shares = expense.shares.all()
        self.assertEqual(shares.count(), 2)

        share_user_ids = {s.user_id for s in shares}
        self.assertIn(self.payer.id, share_user_ids)
        self.assertIn(self.member1.id, share_user_ids)
        self.assertNotIn(self.member2.id, share_user_ids)

    def test_equal_split_usd_conversion(self):
        """
        $10.00 USD split equally on March 1st.
        Rate: 83.50 -> 835.00 INR total.
        Should split among Alice, Rohan, Priya.
        Largest remainder should handle 835.00 / 3 -> 278.34, 278.33, 278.33.
        """
        data = {
            "group": self.group.id,
            "paid_by": self.payer.id,
            "description": "Dinner USD",
            "expense_date": "2026-03-01",
            "original_amount": "10.00",
            "original_currency": "USD",
            "split_type": "equal",
        }
        response = self.client.post("/api/expenses/", data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        expense = Expense.objects.get(id=response.data["id"])
        self.assertEqual(expense.fx_rate_to_inr, Decimal("83.50"))
        self.assertEqual(expense.amount_inr, Decimal("835.00"))

        shares = list(expense.shares.all().order_by("id"))
        self.assertEqual(len(shares), 3)

        amounts = [s.share_amount_inr for s in shares]
        self.assertEqual(sum(amounts), Decimal("835.00"))
        self.assertEqual(amounts[0], Decimal("278.34"))
        self.assertEqual(amounts[1], Decimal("278.33"))
        self.assertEqual(amounts[2], Decimal("278.33"))

    def test_percentage_split_validation(self):
        """
        Percentage split total must equal 100%.
        """
        data = {
            "group": self.group.id,
            "paid_by": self.payer.id,
            "description": "Groceries",
            "expense_date": "2026-03-01",
            "original_amount": "100.00",
            "original_currency": "INR",
            "split_type": "percentage",
            "splits": [
                {"user_id": self.payer.id, "value": "50"},
                {"user_id": self.member1.id, "value": "40"},
            ],
        }
        response = self.client.post("/api/expenses/", data, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("splits", response.data)

        # Correct sum (50 + 30 + 20 = 100)
        data["splits"] = [
            {"user_id": self.payer.id, "value": "50"},
            {"user_id": self.member1.id, "value": "30"},
            {"user_id": self.member2.id, "value": "20"},
        ]
        response = self.client.post("/api/expenses/", data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        expense = Expense.objects.get(id=response.data["id"])
        shares = list(expense.shares.all().order_by("user_id"))
        # m1 is member1, m2 is member2, payer is payer
        payer_share = next(s for s in shares if s.user_id == self.payer.id)
        member1_share = next(s for s in shares if s.user_id == self.member1.id)
        member2_share = next(s for s in shares if s.user_id == self.member2.id)

        self.assertEqual(payer_share.share_amount_inr, Decimal("50.00"))
        self.assertEqual(payer_share.share_raw, "50%")
        self.assertEqual(member1_share.share_amount_inr, Decimal("30.00"))
        self.assertEqual(member1_share.share_raw, "30%")
        self.assertEqual(member2_share.share_amount_inr, Decimal("20.00"))
        self.assertEqual(member2_share.share_raw, "20%")

    def test_share_split_proportional(self):
        """
        Share split: Alice 2 shares, Rohan 1 share, Priya 1 share.
        Total shares = 4. Total: 100.00 INR -> Alice 50.00, Rohan 25.00, Priya 25.00.
        """
        data = {
            "group": self.group.id,
            "paid_by": self.payer.id,
            "description": "Taxi",
            "expense_date": "2026-03-01",
            "original_amount": "100.00",
            "original_currency": "INR",
            "split_type": "share",
            "splits": [
                {"user_id": self.payer.id, "value": "2"},
                {"user_id": self.member1.id, "value": "1"},
                {"user_id": self.member2.id, "value": "1"},
            ],
        }
        response = self.client.post("/api/expenses/", data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        expense = Expense.objects.get(id=response.data["id"])
        shares = list(expense.shares.all())

        payer_share = next(s for s in shares if s.user_id == self.payer.id)
        self.assertEqual(payer_share.share_amount_inr, Decimal("50.00"))
        self.assertEqual(payer_share.share_raw, "2 shares of 4")

    def test_exact_split_usd_to_inr_matching(self):
        """
        $10.00 USD split exactly:
        Payer gets $4.00, Rohan gets $6.00.
        Payer share in INR: $4.00 * 83.50 = 334.00
        Rohan share in INR: $6.00 * 83.50 = 501.00
        Sum = 835.00 INR.
        """
        data = {
            "group": self.group.id,
            "paid_by": self.payer.id,
            "description": "Coffee USD exact",
            "expense_date": "2026-03-01",
            "original_amount": "10.00",
            "original_currency": "USD",
            "split_type": "exact",
            "splits": [
                {"user_id": self.payer.id, "value": "4.00"},
                {"user_id": self.member1.id, "value": "6.00"},
            ],
        }
        response = self.client.post("/api/expenses/", data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        expense = Expense.objects.get(id=response.data["id"])
        shares = list(expense.shares.all())

        payer_share = next(s for s in shares if s.user_id == self.payer.id)
        member1_share = next(s for s in shares if s.user_id == self.member1.id)

        self.assertEqual(payer_share.share_amount_inr, Decimal("334.00"))
        self.assertEqual(payer_share.share_raw, "$4.00")
        self.assertEqual(member1_share.share_amount_inr, Decimal("501.00"))
        self.assertEqual(member1_share.share_raw, "$6.00")

    def test_split_with_inactive_user_rejected(self):
        """
        Adding Sam (inactive_member) to a March 1st split should fail.
        """
        data = {
            "group": self.group.id,
            "paid_by": self.payer.id,
            "description": "Early April utilities",
            "expense_date": "2026-03-01",
            "original_amount": "100.00",
            "original_currency": "INR",
            "split_type": "percentage",
            "splits": [
                {"user_id": self.payer.id, "value": "50"},
                {"user_id": self.inactive_member.id, "value": "50"},
            ],
        }
        response = self.client.post("/api/expenses/", data, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("splits", response.data)


class GroupBalancesAndSettlementsTest(APITestCase):
    def setUp(self):
        from expenses.models import Settlement

        self.user_alice = User.objects.create_user(
            username="alice@example.com",
            email="alice@example.com",
            password="password123",
            name="Alice",
        )
        self.user_bob = User.objects.create_user(
            username="bob@example.com",
            email="bob@example.com",
            password="password123",
            name="Bob",
        )
        self.user_charlie = User.objects.create_user(
            username="charlie@example.com",
            email="charlie@example.com",
            password="password123",
            name="Charlie",
        )
        self.token = Token.objects.create(user=self.user_alice)
        self.client.credentials(HTTP_AUTHORIZATION="Token " + self.token.key)

        self.group = Group.objects.create(name="Triplets")
        GroupMembership.objects.create(
            group=self.group, user=self.user_alice, joined_at="2026-02-01"
        )
        GroupMembership.objects.create(
            group=self.group, user=self.user_bob, joined_at="2026-02-01"
        )
        GroupMembership.objects.create(
            group=self.group, user=self.user_charlie, joined_at="2026-02-01"
        )

    def test_live_balances_and_greedy_simplification(self):
        # 1. Alice pays 300 INR split equally among Alice, Bob, Charlie (100 each)
        data1 = {
            "group": self.group.id,
            "paid_by": self.user_alice.id,
            "description": "Dinner",
            "expense_date": "2026-02-15",
            "original_amount": "300.00",
            "original_currency": "INR",
            "split_type": "equal",
        }
        self.client.post("/api/expenses/", data1, format="json")

        # 2. Bob pays 150 INR split equally among Bob, Charlie (75 each)
        data2 = {
            "group": self.group.id,
            "paid_by": self.user_bob.id,
            "description": "Taxi",
            "expense_date": "2026-02-15",
            "original_amount": "150.00",
            "original_currency": "INR",
            "split_type": "percentage",
            "splits": [
                {"user_id": self.user_bob.id, "value": "50"},
                {"user_id": self.user_charlie.id, "value": "50"},
            ],
        }
        self.client.post("/api/expenses/", data2, format="json")

        # Get Balances
        response = self.client.get(
            f"/api/expenses/groups/{self.group.id}/balances/"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        balances = {b["user_id"]: b["net_balance"] for b in response.data["balances"]}
        self.assertEqual(balances[self.user_alice.id], 200.00)
        self.assertEqual(balances[self.user_bob.id], -25.00)
        self.assertEqual(balances[self.user_charlie.id], -175.00)

        # Suggested settlements:
        # Charlie pays Alice 175
        # Bob pays Alice 25
        suggested = response.data["suggested_settlements"]
        self.assertEqual(len(suggested), 2)

        # 3. Record a settlement: Bob pays Alice 25 INR
        settle_data = {
            "group": self.group.id,
            "paid_by": self.user_bob.id,
            "paid_to": self.user_alice.id,
            "amount_inr": "25.00",
            "settled_at": "2026-02-20T12:00:00Z",
            "notes": "Settled Taxi debt",
        }
        response_settle = self.client.post(
            "/api/expenses/settlements/", settle_data, format="json"
        )
        self.assertEqual(response_settle.status_code, status.HTTP_201_CREATED)

        # 4. Check balances again
        response = self.client.get(
            f"/api/expenses/groups/{self.group.id}/balances/"
        )
        balances = {b["user_id"]: b["net_balance"] for b in response.data["balances"]}
        self.assertEqual(balances[self.user_alice.id], 175.00)  # 200 - 25 received
        self.assertEqual(balances[self.user_bob.id], 0.00)  # -25 + 25 paid
        self.assertEqual(
            balances[self.user_charlie.id], -175.00
        )  # no changes for Charlie

        # 5. Check user balance detail (drill-down) for Alice
        detail_url = f"/api/expenses/users/{self.user_alice.id}/balance-detail/?group={self.group.id}"
        response_detail = self.client.get(detail_url)
        self.assertEqual(response_detail.status_code, status.HTTP_200_OK)

        self.assertEqual(len(response_detail.data["expenses_paid"]), 1)
        self.assertEqual(len(response_detail.data["shares_owed"]), 1)
        self.assertEqual(len(response_detail.data["settlements_received"]), 1)
        self.assertEqual(len(response_detail.data["settlements_paid"]), 0)

