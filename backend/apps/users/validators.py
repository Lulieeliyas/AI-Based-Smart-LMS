from django.core.exceptions import ValidationError
import re


class StrongPasswordValidator:
    """Validate password strength"""
    
    def validate(self, password, user=None):
        errors = []
        
        if len(password) < 8:
            errors.append("Password must be at least 8 characters long.")
        
        if not re.search(r'[A-Z]', password):
            errors.append("Password must contain at least one uppercase letter (A-Z).")
        
        if not re.search(r'[a-z]', password):
            errors.append("Password must contain at least one lowercase letter (a-z).")
        
        if not re.search(r'\d', password):
            errors.append("Password must contain at least one number (0-9).")
        
        if not re.search(r'[!@#$%^&*()_+\-=\[\]{};:\'",.<>/?\\|`~]', password):
            errors.append("Password must contain at least one special character (!@#$%^&*).")
        
        if re.search(r'\s', password):
            errors.append("Password must not contain spaces.")
        
        if errors:
            raise ValidationError(errors)
    
    def get_help_text(self):
        return (
            "Password must be at least 8 characters long and contain "
            "uppercase, lowercase, number, and special character."
        )