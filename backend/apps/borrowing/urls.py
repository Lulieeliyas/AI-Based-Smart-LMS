from django.urls import path
from .views import (
    BorrowBookView, ReturnBookView, RenewBookView,
    BorrowHistoryView, ActiveBorrowingsView, OverdueBorrowingsView,
    AllBorrowingsView, BorrowDetailView, BorrowHistoryListView,
    BorrowingStatisticsView, VerifyIDView, CanBorrowView,
    ReportDamageView, CreatePaymentView, VerifyPaymentView,
    CheckPaymentStatusView
)
from . import views
urlpatterns = [
    # User endpoints
    path('borrow/', BorrowBookView.as_view(), name='borrow-book'),
    path('borrow/<int:id>/return/', ReturnBookView.as_view(), name='return-book'),
    path('borrow/<int:id>/renew/', RenewBookView.as_view(), name='renew-book'),
    path('borrow/history/', BorrowHistoryView.as_view(), name='borrow-history'),
    
    # Check if user can borrow
    path('can-borrow/', CanBorrowView.as_view(), name='can-borrow'),
    
    # ID Verification
    path('verify-id/', VerifyIDView.as_view(), name='verify-id'),
    
    # ✅ Damage/Loss reporting
    path('borrow/<int:borrow_id>/report-damage/', ReportDamageView.as_view(), name='report-damage'),
    
    # ✅ Payment endpoints
    path('borrow/<int:borrow_id>/create-payment/', CreatePaymentView.as_view(), name='create-payment'),
    path('borrow/<int:borrow_id>/verify-payment/', VerifyPaymentView.as_view(), name='verify-payment'),
    path('borrow/<int:borrow_id>/payment-status/', CheckPaymentStatusView.as_view(), name='payment-status'),
    path('my-statistics/', views.MyBorrowingStatisticsView.as_view(), name='my-borrowing-statistics'),
    # Admin/Librarian endpoints
    path('borrow/all/', AllBorrowingsView.as_view(), name='all-borrowings'),
    path('borrow/<int:id>/detail/', BorrowDetailView.as_view(), name='borrow-detail'),
    path('borrow/<int:borrow_id>/history/', BorrowHistoryListView.as_view(), name='borrow-history-list'),
    path('borrow/active/', ActiveBorrowingsView.as_view(), name='active-borrowings'),
    path('borrow/overdue/', OverdueBorrowingsView.as_view(), name='overdue-borrowings'),
    path('borrow/statistics/', BorrowingStatisticsView.as_view(), name='borrowing-statistics'),
]