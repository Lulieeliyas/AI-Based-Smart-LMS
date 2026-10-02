from rest_framework import serializers
from .models import Report, ReportSchedule

class ReportSerializer(serializers.ModelSerializer):
    generated_by_name = serializers.CharField(source='generated_by.username', read_only=True)
    file_url = serializers.SerializerMethodField()
    
    class Meta:
        model = Report
        fields = [
            'id', 'title', 'report_type', 'description', 'parameters',
            'file', 'file_url', 'file_format', 'generated_by', 'generated_by_name',
            'generated_at', 'start_date', 'end_date', 'data', 'is_scheduled',
            'schedule_frequency', 'next_schedule', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'generated_at', 'created_at', 'updated_at']
    
    def get_file_url(self, obj):
        if obj.file:
            request = self.context.get('request')
            return request.build_absolute_uri(obj.file.url) if request else obj.file.url
        return None


class ReportScheduleSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    
    class Meta:
        model = ReportSchedule
        fields = [
            'id', 'report_type', 'title', 'description', 'parameters',
            'frequency', 'format', 'recipients', 'is_active',
            'last_run', 'next_run', 'created_by', 'created_by_name',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'last_run', 'created_at', 'updated_at']


class ReportStatisticsSerializer(serializers.Serializer):
    total_reports = serializers.IntegerField()
    total_users = serializers.IntegerField()
    total_books = serializers.IntegerField()
    total_borrowings = serializers.IntegerField()
    active_borrowings = serializers.IntegerField()
    overdue_borrowings = serializers.IntegerField()
    books_by_category = serializers.DictField()
    borrowings_by_month = serializers.DictField()
    popular_books = serializers.ListField()
    users_by_role = serializers.DictField()
    fine_collected = serializers.DecimalField(max_digits=10, decimal_places=2)