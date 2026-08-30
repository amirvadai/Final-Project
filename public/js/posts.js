document.addEventListener("DOMContentLoaded", () => {
    document
        .querySelectorAll("[data-post-location-form]")
        .forEach((form) => {
            form.addEventListener("submit", (event) => {
                if (form.dataset.locationReady === "true") {
                    return;
                }

                event.preventDefault();

                const latitudeInput =
                    form.querySelector("[data-post-lat]");
                const longitudeInput =
                    form.querySelector("[data-post-lon]");
                const status =
                    form.querySelector("[data-post-location-status]");

                const finish = () => {
                    form.dataset.locationReady = "true";
                    form.requestSubmit();
                };

                if (!navigator.geolocation) {
                    if (status) {
                        status.textContent =
                            "Using your account city for this post.";
                    }

                    finish();
                    return;
                }

                if (status) {
                    status.textContent =
                        "Getting your posting location…";
                }

                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        if (latitudeInput) {
                            latitudeInput.value =
                                position.coords.latitude;
                        }

                        if (longitudeInput) {
                            longitudeInput.value =
                                position.coords.longitude;
                        }

                        if (status) {
                            status.textContent =
                                "Location captured.";
                        }

                        finish();
                    },
                    () => {
                        if (status) {
                            status.textContent =
                                "Using your account city for this post.";
                        }

                        finish();
                    },
                    {
                        enableHighAccuracy: false,
                        timeout: 6000,
                        maximumAge: 300000
                    }
                );
            });
        });
});
