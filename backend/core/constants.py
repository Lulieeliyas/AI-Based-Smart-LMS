# Application constants

USER_ROLES = {
    'STUDENT': 'student',
    'ACADEMIC_STAFF': 'academic_staff',
    'LIBRARIAN': 'librarian',
    'ADMIN': 'admin',
    'DIGITAL_OFFICER': 'digital_officer',
    'GUEST': 'guest',
}

BOOK_STATUS = {
    'AVAILABLE': 'available',
    'BORROWED': 'borrowed',
    'UNAVAILABLE': 'unavailable',
    'RESERVED': 'reserved',
}

BORROW_STATUS = {
    'BORROWED': 'borrowed',
    'RETURNED': 'returned',
    'OVERDUE': 'overdue',
}

DEFAULT_BORROW_DAYS = 14
MAX_BORROW_LIMIT = 5
FINE_PER_DAY = 0.50  # USD