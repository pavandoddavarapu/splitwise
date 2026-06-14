"""
Views for the expenses app.

ExpenseListCreateView            — GET/POST /api/expenses/ (with ?group=<group_id> filter)
ExpenseRetrieveUpdateDestroyView — GET/PUT/PATCH/DELETE /api/expenses/<id>/
"""

from rest_framework import generics
from .models import Expense
from .serializers import ExpenseSerializer


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
