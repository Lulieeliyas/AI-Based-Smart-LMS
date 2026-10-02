from django.utils.deprecation import MiddlewareMixin
import logging

logger = logging.getLogger(__name__)

class RequestLoggingMiddleware(MiddlewareMixin):
    """Middleware to log all requests."""
    
    def process_request(self, request):
        logger.info(f"Request: {request.method} {request.path} - User: {request.user if request.user.is_authenticated else 'Anonymous'}")
        return None
    
    def process_response(self, request, response):
        logger.info(f"Response: {request.method} {request.path} - Status: {response.status_code}")
        return response