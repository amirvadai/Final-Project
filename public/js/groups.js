document.addEventListener("DOMContentLoaded", () => {
    document
        .querySelectorAll("[data-image-preview-input]")
        .forEach((input) => {
            input.addEventListener("change", () => {
                const file = input.files?.[0];
                const previewSelector = input.dataset.imagePreviewInput;
                const preview = document.querySelector(previewSelector);

                if (!file || !preview) {
                    return;
                }

                if (!file.type.startsWith("image/")) {
                    input.value = "";
                    window.alert("Please choose an image file.");
                    return;
                }

                const objectUrl = URL.createObjectURL(file);
                preview.src = objectUrl;

                preview.addEventListener(
                    "load",
                    () => URL.revokeObjectURL(objectUrl),
                    { once: true }
                );
            });
        });

    document.querySelectorAll("[data-file-label]").forEach((input) => {
        input.addEventListener("change", () => {
            const label = document.querySelector(input.dataset.fileLabel);
            const file = input.files?.[0];

            if (!label) {
                return;
            }

            label.textContent = file
                ? `${file.name} (${formatFileSize(file.size)})`
                : "No file selected.";
        });
    });

    document.querySelectorAll("[data-character-count]").forEach((field) => {
        const counter = document.querySelector(
            field.dataset.characterCount
        );

        if (!counter) {
            return;
        }

        const updateCounter = () => {
            const maximum = field.maxLength > 0
                ? field.maxLength
                : "∞";

            counter.textContent =
                `${field.value.length} / ${maximum}`;
        };

        field.addEventListener("input", updateCounter);
        updateCounter();
    });

    document.querySelectorAll("[data-privacy-select]").forEach((select) => {
        const help = select
            .closest(".group-field")
            ?.querySelector("[data-privacy-help]");

        const updateHelp = () => {
            if (!help) {
                return;
            }

            help.textContent =
                select.value === "private"
                    ? "Only members can view posts. New members need manager approval."
                    : "Anyone can view posts; only members can publish.";
        };

        select.addEventListener("change", updateHelp);
        updateHelp();
    });

    document.querySelectorAll("form[data-confirm]").forEach((form) => {
        form.addEventListener("submit", (event) => {
            const message =
                form.dataset.confirm ||
                "Are you sure you want to continue?";

            if (!window.confirm(message)) {
                event.preventDefault();
            }
        });
    });
});

function formatFileSize(bytes) {
    if (bytes < 1024) {
        return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
