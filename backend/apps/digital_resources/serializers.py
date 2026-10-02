from rest_framework import serializers
from .models import DigitalResource, Category


class DigitalCategorySerializer(serializers.ModelSerializer):
    resource_count = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ['id', 'name', 'description', 'resource_count', 'created_at']

    def get_resource_count(self, obj):
        return obj.resources.count()


class DigitalResourceSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    uploaded_by_name = serializers.CharField(source='uploaded_by.username', read_only=True)
    verified_by_name = serializers.CharField(source='verified_by.username', read_only=True)
    book_title = serializers.CharField(source='book.title', read_only=True)
    display_url = serializers.CharField(read_only=True)
    resource_type_display = serializers.CharField(source='get_resource_type_display', read_only=True)
    quality_status_display = serializers.CharField(source='get_quality_status_display', read_only=True)
    access_level_display = serializers.CharField(source='get_access_level_display', read_only=True)

    class Meta:
        model = DigitalResource
        fields = [
            'id', 'title', 'description', 'resource_type', 'resource_type_display',
            'source_type', 'category', 'category_name', 'book', 'book_title',
            'keywords', 'file', 'external_url', 'display_url',
            'file_size', 'thumbnail', 'duration',
            'access_level', 'access_level_display',
            'quality_status', 'quality_status_display', 'quality_notes',
            'downloads_count', 'views_count',
            'uploaded_by', 'uploaded_by_name',
            'verified_by', 'verified_by_name', 'verified_at',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'downloads_count', 'views_count',
            'uploaded_by', 'verified_by', 'verified_at',
            'created_at', 'updated_at', 'file_size',
        ]

    def validate_file(self, value):
        if value and value.size > 50 * 1024 * 1024:
            raise serializers.ValidationError('File size exceeds 50 MB limit.')
        return value

    def validate(self, data):
        source = data.get('source_type') or (self.instance.source_type if self.instance else 'file')

        if source == 'file':
            if not data.get('file') and not (self.instance and self.instance.file):
                raise serializers.ValidationError(
                    {'file': 'A file is required when source type is "file".'}
                )
        elif source in ['youtube', 'external']:
            if not data.get('external_url') and not (self.instance and self.instance.external_url):
                raise serializers.ValidationError(
                    {'external_url': 'A URL is required for external/YouTube resources.'}
                )
        return data

    def create(self, validated_data):
        # Auto-set file size
        if validated_data.get('file'):
            validated_data['file_size'] = validated_data['file'].size
        return super().create(validated_data)

    def update(self, instance, validated_data):
        if validated_data.get('file'):
            validated_data['file_size'] = validated_data['file'].size
        return super().update(instance, validated_data)