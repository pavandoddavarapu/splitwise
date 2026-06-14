"""
Views for the expenses app.

ExpenseListCreateView            — GET/POST /api/expenses/ (with ?group=<group_id> filter)
ExpenseRetrieveUpdateDestroyView — GET/PUT/PATCH/DELETE /api/expenses/<id>/
GroupBalancesView                — GET /api/expenses/groups/<group_id>/balances/ (Aisha's greedy view)
UserBalanceDetailView            — GET /api/expenses/users/<user_id>/balance-detail/ (Rohan's drill-down)
SettlementListCreateView         — GET/POST /api/expenses/settlements/
"""

from decimal import Decimal
from django.db.models import Sum
from django.shortcuts import get_object_or_404
from rest_framework import generics, serializers
from rest_framework.views import APIView
from rest_framework.response import Response

from groups.models import Group, GroupMembership
from .models import Expense, ExpenseShare, Settlement
from .serializers import ExpenseSerializer, SettlementSerializer


class ExpenseListCreateView(generics.ListCreateAPIView):
    """
    GET /api/expenses/
    POST /api/expenses/
    Supports query parameter: ?group=<group_id>
    """

    serializer_class = ExpenseSerializer

    def get_queryset(self):
        queryset = Expense.objects.all().order_by("-expense_date", "-created_at")
        group_id = self.request.query_params.get("group")
        if group_id:
            queryset = queryset.filter(group_id=group_id)
        return queryset


class ExpenseRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET /api/expenses/<id>/
    PUT/PATCH /api/expenses/<id>/
    DELETE /api/expenses/<id>/
    """

    queryset = Expense.objects.all()
    serializer_class = ExpenseSerializer


class GroupBalancesView(APIView):
    """
    GET /api/expenses/groups/<group_id>/balances/

    Calculates net outstanding balances for all group members live from rows:
      net = paid_expenses - shares_owed + settlements_received - settlements_paid

    Runs a greedy simplification algorithm (Hare-Niemeyer / Largest Remainder style)
    to find the minimal direct transfers needed to settle all outstanding debts.
    """

    def get(self, request, group_id):
        group = get_object_or_404(Group, pk=group_id)
        memberships = GroupMembership.objects.filter(group=group)

        balances = []
        for m in memberships:
            user = m.user

            # Sum of active expenses paid by this user
            paid = (
                Expense.objects.filter(group=group, paid_by=user)
                .exclude(status=Expense.VOIDED)
                .aggregate(total=Sum("amount_inr"))["total"]
                or Decimal("0.00")
            )

            # Sum of active shares owed by this user
            owed = (
                ExpenseShare.objects.filter(expense__group=group, user=user)
                .exclude(expense__status=Expense.VOIDED)
                .aggregate(total=Sum("share_amount_inr"))["total"]
                or Decimal("0.00")
            )

            # Sum of settlements paid by this user
            settled_paid = (
                Settlement.objects.filter(group=group, paid_by=user)
                .aggregate(total=Sum("amount_inr"))["total"]
                or Decimal("0.00")
            )

            # Sum of settlements received by this user
            settled_received = (
                Settlement.objects.filter(group=group, paid_to=user)
                .aggregate(total=Sum("amount_inr"))["total"]
                or Decimal("0.00")
            )

            net = paid - owed + settled_paid - settled_received

            balances.append(
                {
                    "user_id": user.id,
                    "user_name": user.name,
                    "user_email": user.email,
                    "expenses_paid": float(paid),
                    "shares_owed": float(owed),
                    "settlements_paid": float(settled_paid),
                    "settlements_received": float(settled_received),
                    "net_balance": float(net),
                }
            )

        # Proposed greedy settlement transfers to clear outstanding debts
        suggested = []
        balances_dec = [
            {
                "user_id": b["user_id"],
                "user_name": b["user_name"],
                "net_balance": Decimal(str(b["net_balance"])),
            }
            for b in balances
        ]

        debtors = []
        creditors = []
        for b in balances_dec:
            bal = b["net_balance"]
            if bal < -Decimal("0.005"):
                debtors.append(
                    {"id": b["user_id"], "name": b["user_name"], "amount": -bal}
                )
            elif bal > Decimal("0.005"):
                creditors.append(
                    {"id": b["user_id"], "name": b["user_name"], "amount": bal}
                )

        while debtors and creditors:
            # Sort descending by outstanding amount to pair the biggest debtor/creditor
            debtors.sort(key=lambda x: x["amount"], reverse=True)
            creditors.sort(key=lambda x: x["amount"], reverse=True)

            d = debtors[0]
            c = creditors[0]

            amount = min(d["amount"], c["amount"])
            if amount < Decimal("0.005"):
                break

            suggested.append(
                {
                    "from_user": {"id": d["id"], "name": d["name"]},
                    "to_user": {"id": c["id"], "name": c["name"]},
                    "amount_inr": float(amount),
                }
            )

            d["amount"] -= amount
            c["amount"] -= amount

            if d["amount"] < Decimal("0.005"):
                debtors.pop(0)
            if c["amount"] < Decimal("0.005"):
                creditors.pop(0)

        return Response({"balances": balances, "suggested_settlements": suggested})


class UserBalanceDetailView(APIView):
    """
    GET /api/expenses/users/<user_id>/balance-detail/?group=<group_id>

    Rohan's drill-down verification endpoint.
    Returns all transaction lines (paid expenses, shares owed, and settlements)
    that justify a user's net outstanding balance in a specific group.
    """

    def get(self, request, user_id):
        from accounts.models import User

        user = get_object_or_404(User, pk=user_id)
        group_id = request.query_params.get("group")

        if not group_id:
            return Response(
                {"error": "group query parameter is required"}, status=400
            )

        group = get_object_or_404(Group, pk=group_id)

        # Expenses paid in group (exclude voided)
        expenses_paid = (
            Expense.objects.filter(group=group, paid_by=user)
            .exclude(status=Expense.VOIDED)
            .order_by("-expense_date")
        )

        # Shares owed in group (exclude voided)
        shares = (
            ExpenseShare.objects.filter(expense__group=group, user=user)
            .exclude(expense__status=Expense.VOIDED)
            .order_by("-expense__expense_date")
        )

        # Settlements paid
        settlements_paid = Settlement.objects.filter(
            group=group, paid_by=user
        ).order_by("-settled_at")

        # Settlements received
        settlements_received = Settlement.objects.filter(
            group=group, paid_to=user
        ).order_by("-settled_at")

        # Serializers for response packaging
        class SimpleExpenseSerializer(serializers.ModelSerializer):
            class Meta:
                model = Expense
                fields = [
                    "id",
                    "description",
                    "expense_date",
                    "original_amount",
                    "original_currency",
                    "amount_inr",
                ]

        class SimpleShareSerializer(serializers.ModelSerializer):
            expense_description = serializers.CharField(source="expense.description")
            expense_date = serializers.DateField(source="expense.expense_date")

            class Meta:
                model = ExpenseShare
                fields = [
                    "id",
                    "expense_description",
                    "expense_date",
                    "share_amount_inr",
                    "share_raw",
                ]

        return Response(
            {
                "expenses_paid": SimpleExpenseSerializer(
                    expenses_paid, many=True
                ).data,
                "shares_owed": SimpleShareSerializer(shares, many=True).data,
                "settlements_paid": SettlementSerializer(
                    settlements_paid, many=True
                ).data,
                "settlements_received": SettlementSerializer(
                    settlements_received, many=True
                ).data,
            }
        )


class SettlementListCreateView(generics.ListCreateAPIView):
    """
    GET /api/expenses/settlements/ (supports ?group=<group_id>)
    POST /api/expenses/settlements/
    """

    serializer_class = SettlementSerializer

    def get_queryset(self):
        queryset = Settlement.objects.all().order_by("-settled_at")
        group_id = self.request.query_params.get("group")
        if group_id:
            queryset = queryset.filter(group_id=group_id)
        return queryset
