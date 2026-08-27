document.addEventListener("DOMContentLoaded", () => {
    const textarea = document.querySelector("#messageText");
    const counter = document.querySelector("#messageCharacterCount");
    const chat = document.querySelector("#chatMessages");
    const mediaInput = document.querySelector("#messageMedia");
    const mediaName = document.querySelector("#messageMediaName");

    if (textarea && counter) {
        const updateCounter = () => {
            counter.textContent = `${textarea.value.length} / 2000`;
        };

        textarea.addEventListener("input", updateCounter);
        updateCounter();
    }

    if (mediaInput && mediaName) {
        mediaInput.addEventListener("change", () => {
            mediaName.textContent = mediaInput.files?.[0]?.name || "No media selected";
        });
    }

    if (chat) {
        chat.scrollTop = chat.scrollHeight;
    }
});
