# backend/apps/digital_resources/serializers.py

from rest_framework import serializers
from .models import Category, DigitalResource


def make_absolute_url(request, path_or_url):
    """Ensure a file/thumbnail path or URL is returned as a full absolute URL."""
    if not path_or_url:
        return ""
    url_str = str(path_or_url)
    if url_str.startswith("http://") or url_str.startswith("https://"):
        return url_str
    if request:
        return request.build_absolute_uri(url_str)
    # Fallback to local Django development port
    if not url_str.startswith("/"):
        url_str = "/" + url_str
    return f"http://localhost:8000{url_str}"


class CategorySerializer(serializers.ModelSerializer):
    resource_count = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = [
            "id",
            "name",
            "description",
            "created_at",
            "resource_count",
        ]
        read_only_fields = ["id", "created_at", "resource_count"]

    def get_resource_count(self, obj):
        return obj.resources.count()


class DigitalResourceSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(
        source="category.name",
        read_only=True,
        default=None,
    )
    book_title = serializers.CharField(
        source="book.title",
        read_only=True,
        default=None,
    )
    uploaded_by_name = serializers.SerializerMethodField()
    verified_by_name = serializers.SerializerMethodField()
    display_url = serializers.SerializerMethodField()
    file_url = serializers.SerializerMethodField()
    thumbnail_url = serializers.SerializerMethodField()
    resource_type_display = serializers.CharField(
        source="get_resource_type_display",
        read_only=True,
    )
    quality_status_display = serializers.CharField(
        source="get_quality_status_display",
        read_only=True,
    )
    access_level_display = serializers.CharField(
        source="get_access_level_display",
        read_only=True,
    )

    class Meta:
        model = DigitalResource
        fields = [
            "id",
            "title",
            "description",
            "resource_type",
            "resource_type_display",
            "source_type",
            "category",
            "category_name",
            "book",
            "book_title",
            "keywords",
            "file",
            "file_url",
            "external_url",
            "display_url",
            "file_size",
            "thumbnail",
            "thumbnail_url",
            "duration",
            "access_level",
            "access_level_display",
            "quality_status",
            "quality_status_display",
            "quality_notes",
            "downloads_count",
            "views_count",
            "uploaded_by",
            "uploaded_by_name",
            "verified_by",
            "verified_by_name",
            "verified_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "file_size",
            "downloads_count",
            "views_count",
            "uploaded_by",
            "uploaded_by_name",
            "verified_by",
            "verified_by_name",
            "verified_at",
            "created_at",
            "updated_at",
            "display_url",
            "file_url",
            "thumbnail_url",
            "resource_type_display",
            "quality_status_display",
            "access_level_display",
        ]

    def get_uploaded_by_name(self, obj):
        user = obj.uploaded_by
        if not user:
            return None
        return (
            user.get_full_name()
            or getattr(user, "username", None)
            or getattr(user, "email", None)
        )

    def get_verified_by_name(self, obj):
        user = obj.verified_by
        if not user:
            return None
        return (
            user.get_full_name()
            or getattr(user, "username", None)
            or getattr(user, "email", None)
        )

    def get_file_url(self, obj):
        if obj.file:
            request = self.context.get("request")
            return make_absolute_url(request, obj.file.url)
        return ""

    def get_thumbnail_url(self, obj):
        if obj.thumbnail:
            request = self.context.get("request")
            return make_absolute_url(request, obj.thumbnail.url)
        return ""

    def get_display_url(self, obj):
        request = self.context.get("request")
        if obj.source_type == "file" and obj.file:
            return make_absolute_url(request, obj.file.url)
        return obj.external_url or ""

    def validate(self, attrs):
        source_type = attrs.get(
            "source_type",
            getattr(self.instance, "source_type", "file"),
        )
        resource_type = attrs.get(
            "resource_type",
            getattr(self.instance, "resource_type", "other"),
        )
        uploaded_file = attrs.get(
            "file",
            getattr(self.instance, "file", None),
        )
        thumbnail = attrs.get(
            "thumbnail",
            getattr(self.instance, "thumbnail", None),
        )
        external_url = attrs.get(
            "external_url",
            getattr(self.instance, "external_url", ""),
        )

        if source_type == "file":
            # For electronic devices or hardware, allow either an attached document/manual OR a hardware image
            if resource_type == "electronic_device":
                if not uploaded_file and not thumbnail:
                    raise serializers.ValidationError({
                        "file": "Please upload a hardware photo or documentation for this electronic device."
                    })
            elif not uploaded_file:
                raise serializers.ValidationError({
                    "file": "Upload a file for this resource."
                })

        if source_type in ("youtube", "external") and not external_url:
            raise serializers.ValidationError({
                "external_url": "Enter a URL for this resource."
            })

        return attrs

    def create(self, validated_data):
        uploaded_file = validated_data.get("file")
        if uploaded_file and hasattr(uploaded_file, "size"):
            validated_data["file_size"] = uploaded_file.size
        elif not uploaded_file and validated_data.get("thumbnail") and hasattr(validated_data.get("thumbnail"), "size"):
            validated_data["file_size"] = validated_data["thumbnail"].size

        return super().create(validated_data)

    def update(self, instance, validated_data):
        uploaded_file = validated_data.get("file")
        if uploaded_file and hasattr(uploaded_file, "size"):
            validated_data["file_size"] = uploaded_file.size

        return super().update(instance, validated_data)


class DigitalResourceListSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(
        source="category.name",
        read_only=True,
        default=None,
    )
    book_title = serializers.CharField(
        source="book.title",
        read_only=True,
        default=None,
    )
    uploaded_by_name = serializers.SerializerMethodField()
    verified_by_name = serializers.SerializerMethodField()
    display_url = serializers.SerializerMethodField()
    file_url = serializers.SerializerMethodField()
    thumbnail_url = serializers.SerializerMethodField()
    resource_type_display = serializers.CharField(
        source="get_resource_type_display",
        read_only=True,
    )
    quality_status_display = serializers.CharField(
        source="get_quality_status_display",
        read_only=True,
    )
    access_level_display = serializers.CharField(
        source="get_access_level_display",
        read_only=True,
    )

    class Meta:
        model = DigitalResource
        fields = [
            "id",
            "title",
            "description",
            "resource_type",
            "resource_type_display",
            "source_type",
            "category",
            "category_name",
            "book",
            "book_title",
            "keywords",
            "file",
            "file_url",
            "external_url",
            "display_url",
            "file_size",
            "thumbnail",
            "thumbnail_url",
            "duration",
            "access_level",
            "access_level_display",
            "quality_status",
            "quality_status_display",
            "quality_notes",
            "downloads_count",
            "views_count",
            "uploaded_by",
            "uploaded_by_name",
            "verified_by",
            "verified_by_name",
            "verified_at",
            "created_at",
            "updated_at",
        ]

    def get_uploaded_by_name(self, obj):
        user = obj.uploaded_by
        if not user:
            return None
        return (
            user.get_full_name()
            or getattr(user, "username", None)
            or getattr(user, "email", None)
        )

    def get_verified_by_name(self, obj):
        user = obj.verified_by
        if not user:
            return None
        return (
            user.get_full_name()
            or getattr(user, "username", None)
            or getattr(user, "email", None)
        )

    def get_file_url(self, obj):
        if obj.file:
            request = self.context.get("request")
            return make_absolute_url(request, obj.file.url)
        return ""

    def get_thumbnail_url(self, obj):
        if obj.thumbnail:
            request = self.context.get("request")
            return make_absolute_url(request, obj.thumbnail.url)
        return ""

    def get_display_url(self, obj):
        request = self.context.get("request")
        if obj.source_type == "file" and obj.file:
            return make_absolute_url(request, obj.file.url)
        return obj.external_url or ""
