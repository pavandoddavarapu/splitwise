"""
Expenses URL configuration.

Maps endpoints to Expense, Balance Calculation, Drill-down, and Settlement views.
"""

from django.urls import path
from .views import (
    ExpenseListCreateView,
    ExpenseRetrieveUpdateDestroyView,
    GroupBalancesView,
    UserBalanceDetailView,
    SettlementListCreateView,
)

urlpatterns = [
    # Expenses CRUD
    path("", ExpenseListCreateView.as_view(), name="expense-list-create"),
    path("<int:pk>/", ExpenseRetrieveUpdateDestroyView.as_view(), name="expense-detail"),
    
    # Balances & Drill-down
    path("groups/<int:group_id>/balances/", GroupBalancesView.as_view(), name="group-balances"),
    path("users/<int:user_id>/balance-detail/", UserBalanceDetailView.as_view(), name="user-balance-detail"),
    
    # Settlements CRUD
    path("settlements/", SettlementListCreateView.as_view(), name="settlement-list-create"),
]
