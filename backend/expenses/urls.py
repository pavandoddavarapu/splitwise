"""
Expenses URL configuration.

Maps endpoints to Expense and (eventually) Settlement views.
"""

from django.urls import path
from .views import (
    ExpenseListCreateView,
    ExpenseRetrieveUpdateDestroyView,
)

urlpatterns = [
    # Step 4: Expenses CRUD
    path("", ExpenseListCreateView.as_view(), name="expense-list-create"),
    path("<int:pk>/", ExpenseRetrieveUpdateDestroyView.as_view(), name="expense-detail"),
    
    # Step 5 placeholder (to be wired in next step)
    # path("groups/<int:group_id>/balances/", ..., name="group-balances"),
    # path("users/<int:user_id>/balance-detail/", ..., name="user-balance-detail"),
    
    # Step 6 placeholder (to be wired in settlement step)
    # path("settlements/", ..., name="settlement-list-create"),
]
