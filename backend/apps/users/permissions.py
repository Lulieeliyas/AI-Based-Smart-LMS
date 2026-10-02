from rest_framework import permissions

class IsAdminUser(permissions.BasePermission):
    """
    Allows access only to admin users.
    """
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role == 'admin'
    
    def has_object_permission(self, request, view, obj):
        return self.has_permission(request, view)

class IsLibrarianUser(permissions.BasePermission):
    """
    Allows access only to librarians and admins.
    """
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role in ['admin', 'librarian']
    
    def has_object_permission(self, request, view, obj):
        return self.has_permission(request, view)

class IsDigitalOfficer(permissions.BasePermission):
    """
    Allows access only to digital officers and admins.
    """
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role in ['admin', 'digital_officer']
    
    def has_object_permission(self, request, view, obj):
        return self.has_permission(request, view)

class IsStudentOrStaff(permissions.BasePermission):
    """
    Allows access only to students and academic staff.
    """
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role in ['student', 'academic_staff']
    
    def has_object_permission(self, request, view, obj):
        return self.has_permission(request, view)

class IsGuest(permissions.BasePermission):
    """
    Allows access only to guest users.
    """
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role == 'guest'
    
    def has_object_permission(self, request, view, obj):
        return self.has_permission(request, view)

class IsAuthenticatedReadOnly(permissions.BasePermission):
    """
    Allows authenticated users to view, but only admins/librarians to modify.
    """
    SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS']
    
    def has_permission(self, request, view):
        if request.method in self.SAFE_METHODS:
            return request.user and request.user.is_authenticated
        return request.user and request.user.is_authenticated and request.user.role in ['admin', 'librarian']
    
    def has_object_permission(self, request, view, obj):
        return self.has_permission(request, view)
    
    
    class IsDigitalOfficer(permissions.BasePermission):
        """Allow digital officers and admins."""
    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            request.user.role in ['admin', 'digital_officer']
        )