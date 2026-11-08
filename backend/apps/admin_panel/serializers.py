from rest_framework import serializers
from .models import BackupRecord, SystemSetting, RestoreLog, AuditLog

class BackupRecordSerializer(serializers.ModelSerializer):
    created_by = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = BackupRecord
        fields = ['id', 'filename', 'created_at', 'size_bytes', 'status', 'created_by']
        read_only_fields = ['id', 'created_at', 'created_by', 'size_bytes', 'status']

class SystemSettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemSetting
        fields = ['id', 'key', 'value', 'description']
        read_only_fields = ['id', 'key']

    def validate(self, attrs):
        # Add custom validation for known keys
        key = self.instance.key if self.instance else attrs.get('key')
        if key == 'borrowing_duration':
            try:
                val = int(attrs.get('value'))
                if val <= 0:
                    raise serializers.ValidationError('Duration must be positive integer days.')
            except ValueError:
                raise serializers.ValidationError('Duration must be integer days.')
        return attrs

class RestoreLogSerializer(serializers.ModelSerializer):
    backup = serializers.StringRelatedField(read_only=True)
    initiated_by = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = RestoreLog
        fields = ['id', 'backup', 'started_at', 'finished_at', 'status', 'initiated_by', 'notes']
        read_only_fields = ['id', 'started_at', 'finished_at', 'status', 'initiated_by']

class AuditLogSerializer(serializers.ModelSerializer):
    actor = serializers.StringRelatedField()

    class Meta:
        model = AuditLog
        fields = ['id', 'actor', 'action', 'object_repr', 'timestamp', 'details', 'success']
        read_only_fields = fields
