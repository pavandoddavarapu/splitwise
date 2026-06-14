from datetime import date
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework.authtoken.models import Token
from groups.models import Group, GroupMembership

User = get_user_model()


class GroupMembershipModelTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser@example.com",
            email="testuser@example.com",
            password="password123",
            name="Test User",
        )
        self.group = Group.objects.create(name="Test Group")

    def test_covers_date_no_leave_date(self):
        """Test covers_date when left_at is None."""
        membership = GroupMembership.objects.create(
            group=self.group,
            user=self.user,
            joined_at=date(2026, 2, 1),
            left_at=None,
        )
        # Dates before joined_at should return False
        self.assertFalse(membership.covers_date(date(2026, 1, 31)))
        # Joined date should return True
        self.assertTrue(membership.covers_date(date(2026, 2, 1)))
        # Future dates should return True
        self.assertTrue(membership.covers_date(date(2026, 6, 15)))

    def test_covers_date_with_leave_date(self):
        """Test covers_date when left_at is set."""
        membership = GroupMembership.objects.create(
            group=self.group,
            user=self.user,
            joined_at=date(2026, 2, 1),
            left_at=date(2026, 3, 28),
        )
        # Before joined_at
        self.assertFalse(membership.covers_date(date(2026, 1, 31)))
        # On joined_at
        self.assertTrue(membership.covers_date(date(2026, 2, 1)))
        # Between joined_at and left_at
        self.assertTrue(membership.covers_date(date(2026, 2, 28)))
        # On left_at
        self.assertTrue(membership.covers_date(date(2026, 3, 28)))
        # After left_at
        self.assertFalse(membership.covers_date(date(2026, 3, 29)))


class GroupAPITest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="user@example.com",
            email="user@example.com",
            password="password123",
            name="Alice User",
        )
        self.other_user = User.objects.create_user(
            username="other@example.com",
            email="other@example.com",
            password="password123",
            name="Bob User",
        )
        self.token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION="Token " + self.token.key)
        self.group = Group.objects.create(name="Ski Trip 2026")

    def test_list_groups(self):
        response = self.client.get("/api/groups/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["name"], "Ski Trip 2026")

    def test_create_group(self):
        data = {"name": "Summer Vacation"}
        response = self.client.post("/api/groups/", data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Group.objects.count(), 2)
        self.assertEqual(response.data["name"], "Summer Vacation")

    def test_add_group_member(self):
        data = {
            "user_id": self.other_user.id,
            "joined_at": "2026-02-01",
            "left_at": "2026-03-28",
        }
        url = f"/api/groups/{self.group.id}/members/"
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(GroupMembership.objects.count(), 1)

        membership = GroupMembership.objects.first()
        self.assertEqual(membership.user, self.other_user)
        self.assertEqual(membership.joined_at, date(2026, 2, 1))
        self.assertEqual(membership.left_at, date(2026, 3, 28))

    def test_validation_leave_before_join(self):
        data = {
            "user_id": self.other_user.id,
            "joined_at": "2026-03-28",
            "left_at": "2026-02-01",
        }
        url = f"/api/groups/{self.group.id}/members/"
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("left_at", response.data)

    def test_validation_duplicate_membership(self):
        GroupMembership.objects.create(
            group=self.group, user=self.other_user, joined_at=date(2026, 2, 1)
        )
        data = {"user_id": self.other_user.id, "joined_at": "2026-02-02"}
        url = f"/api/groups/{self.group.id}/members/"
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("user_id", response.data)
