
from django.urls import path
from .payment_views import ChapaFineWebhookView

from .views import (
    FineReportListCreateView,
    FineReportReviewView,
    FineExtensionRequestListCreateView,
    FineExtensionRequestReviewView,
)

from .payment_views import (
    FinePaymentInitializeView,
    FinePaymentVerifyView,
    FinePaymentHistoryView,
    FineListView,
)


urlpatterns = [
    # Fine reports
    path(
        "reports/",
        FineReportListCreateView.as_view(),
        name="fine-report-list-create",
    ),
    path(
        "reports/<int:pk>/review/",
        FineReportReviewView.as_view(),
        name="fine-report-review",
    ),

    # Chapa payments
    path(
        "payments/initialize/",
        FinePaymentInitializeView.as_view(),
        name="fine-payment-initialize",
    ),
    path(
        "payments/verify/",
        FinePaymentVerifyView.as_view(),
        name="fine-payment-verify",
    ),
    path(
        "payments/history/",
        FinePaymentHistoryView.as_view(),
        name="fine-payment-history",
    ),

    path(
    "",
    FineListView.as_view(),
    name="fine-list",
    ),

    path(
    "payments/webhook/",
    ChapaFineWebhookView.as_view(),
    name="chapa-fine-webhook",
    ),

        # Fine payment extensions
    path(
        "extensions/",
        FineExtensionRequestListCreateView.as_view(),
        name="fine-extension-list-create",
    ),
    path(
        "extensions/<int:pk>/review/",
        FineExtensionRequestReviewView.as_view(),
        name="fine-extension-review",
    ),
]
