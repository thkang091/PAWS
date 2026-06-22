class ImageValidationService:
    def validate(self, storage_path: str | None) -> tuple[bool, str | None]:
        if not storage_path:
            return False, "Missing verification photo."
        if not storage_path.lower().endswith((".jpg", ".jpeg", ".png", ".heic")):
            return False, "Unsupported photo format."
        return True, None
