document.addEventListener("DOMContentLoaded", () => {
    const page = document.querySelector("[data-post-map-page]");

    if (!page) {
        return;
    }

    const mapElement = document.querySelector("#post-map");
    const mapMessage = page.querySelector("[data-map-message]");
    const dateInput = page.querySelector("[data-map-date]");
    const last24Button = page.querySelector("[data-map-last-24]");
    const summary = page.querySelector("[data-map-summary]");
    const directionsPanel = page.querySelector(
        "[data-directions-panel]"
    );
    const directionsEmpty = page.querySelector(
        "[data-directions-empty]"
    );
    const directionsContent = page.querySelector(
        "[data-directions-content]"
    );
    const directionsLocation = page.querySelector(
        "[data-directions-location]"
    );
    const directionsAuthor = page.querySelector(
        "[data-directions-author]"
    );
    const directionsTime = page.querySelector(
        "[data-directions-time]"
    );
    const drivingLink = page.querySelector(
        "[data-direction-driving]"
    );
    const walkingLink = page.querySelector(
        "[data-direction-walking]"
    );
    const apiKey = page.dataset.googleMapsKey;
    const initialPostId = page.dataset.selectedPostId;

    let map;
    let InfoWindow;
    let AdvancedMarkerElement;
    let infoWindow;
    let markers = [];
    let posts = [];

    function setMapMessage(message) {
        mapMessage.textContent = message;
        mapMessage.hidden = !message;
    }

    function loadGoogleMaps() {
        if (
            window.google?.maps?.Map &&
            window.google?.maps?.marker?.AdvancedMarkerElement
        ) {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            const callbackName =
                `__postMapReady_${Date.now()}_${Math.floor(
                    Math.random() * 100000
                )}`;
            const script = document.createElement("script");
            const parameters = new URLSearchParams({
                key: apiKey,
                v: "weekly",
                loading: "async",
                libraries: "marker",
                callback: callbackName
            });

            window[callbackName] = () => {
                delete window[callbackName];
                resolve();
            };

            script.src =
                `https://maps.googleapis.com/maps/api/js?${parameters}`;
            script.async = true;
            script.onerror = () => {
                delete window[callbackName];
                reject(new Error("Google Maps could not be loaded."));
            };

            document.head.appendChild(script);
        });
    }

    function localDateValue(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");

        return `${year}-${month}-${day}`;
    }

    function dayWindow(value) {
        const [year, month, day] = value
            .split("-")
            .map((part) => Number(part));
        const start = new Date(year, month - 1, day);
        const end = new Date(year, month - 1, day + 1);

        return {
            start,
            end
        };
    }

    function clearMarkers() {
        for (const marker of markers) {
            marker.map = null;
        }

        markers = [];
        infoWindow?.close();
    }

    function hashValue(value) {
        let hash = 0;

        for (let index = 0; index < value.length; index += 1) {
            hash = (hash * 31 + value.charCodeAt(index)) | 0;
        }

        return Math.abs(hash);
    }

    function displayPosition(post) {
        const hash = hashValue(String(post._id));
        const angle = ((hash % 360) * Math.PI) / 180;
        const distance = ((hash % 4) + 1) * 0.00006;

        return {
            lat: Number(post.latitude) + Math.sin(angle) * distance,
            lng: Number(post.longitude) + Math.cos(angle) * distance
        };
    }

    function buildInfoContent(post) {
        const container = document.createElement("div");
        container.className = "map-info-window";

        const name = document.createElement("strong");
        name.textContent =
            post.author?.displayName ||
            post.author?.username ||
            "Community member";

        const username = document.createElement("span");
        username.textContent = post.author?.username
            ? `@${post.author.username}`
            : "";

        const time = document.createElement("time");
        time.textContent = new Date(post.createdAt).toLocaleString();

        const text = document.createElement("p");
        const postText = String(post.text || "");
        text.textContent =
            postText.length > 110
                ? `${postText.slice(0, 107)}…`
                : postText;

        const location = document.createElement("span");
        location.className = "map-info-location";
        location.textContent = `📍 ${post.locationName}`;

        container.append(name, username, time, text, location);

        return container;
    }

    function openHoverInfo(marker, post) {
        infoWindow.setContent(buildInfoContent(post));
        infoWindow.open({
            map,
            anchor: marker
        });
    }

    function createMarker(post) {
        const dot = document.createElement("div");
        dot.className = "post-map-dot";
        dot.setAttribute("role", "button");
        dot.setAttribute("tabindex", "0");
        dot.setAttribute(
            "aria-label",
            `${post.author?.displayName || "Community member"} posted at ${post.locationName}`
        );

        const marker = new AdvancedMarkerElement({
            map,
            position: displayPosition(post),
            title:
                `${post.author?.displayName || "Community member"} · ` +
                new Date(post.createdAt).toLocaleString(),
            content: dot,
            gmpClickable: true
        });

        dot.addEventListener("mouseenter", () => {
            openHoverInfo(marker, post);
        });

        dot.addEventListener("mouseleave", () => {
            infoWindow.close();
        });

        dot.addEventListener("click", () => {
            selectPost(post);
        });

        dot.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                selectPost(post);
            }
        });

        markers.push(marker);
    }

    function fitPostsToMap() {
        if (posts.length === 0) {
            map.setCenter({
                lat: 31.8,
                lng: 34.8
            });
            map.setZoom(8);
            return;
        }

        if (posts.length === 1) {
            map.setCenter({
                lat: Number(posts[0].latitude),
                lng: Number(posts[0].longitude)
            });
            map.setZoom(14);
            return;
        }

        const bounds = new google.maps.LatLngBounds();

        for (const post of posts) {
            bounds.extend({
                lat: Number(post.latitude),
                lng: Number(post.longitude)
            });
        }

        map.fitBounds(bounds, 70);
    }

    function renderPosts() {
        clearMarkers();

        for (const post of posts) {
            createMarker(post);
        }

        summary.textContent =
            posts.length === 1
                ? "1 mapped post"
                : `${posts.length} mapped posts`;

        setMapMessage(
            posts.length === 0
                ? "No posts with locations were found in this period."
                : ""
        );

        fitPostsToMap();
    }

    async function loadPosts(start, end) {
        summary.textContent = "Loading posts…";
        setMapMessage("");

        const parameters = new URLSearchParams({
            start: start.toISOString(),
            end: end.toISOString()
        });
        const response = await fetch(
            `/api/map/posts?${parameters.toString()}`
        );
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Posts could not be loaded.");
        }

        posts = data.posts || [];
        renderPosts();
    }

    async function loadLast24Hours() {
        last24Button.classList.add("is-active");
        dateInput.value = "";
        const end = new Date();
        const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);

        await loadPosts(start, end);
    }

    async function loadDate(value) {
        last24Button.classList.remove("is-active");
        const window = dayWindow(value);

        await loadPosts(window.start, window.end);
    }

    function googleMapsUrl(post, travelMode) {
        const parameters = new URLSearchParams({
            api: "1",
            destination: `${post.latitude},${post.longitude}`,
            travelmode: travelMode
        });

        return `https://www.google.com/maps/dir/?${parameters}`;
    }

    function selectPost(post) {
        directionsEmpty.hidden = true;
        directionsContent.hidden = false;
        directionsLocation.textContent = post.locationName;
        directionsAuthor.textContent =
            `Posted by ${post.author?.displayName || post.author?.username || "Community member"}`;
        directionsTime.textContent =
            new Date(post.createdAt).toLocaleString();
        drivingLink.href = googleMapsUrl(post, "driving");
        walkingLink.href = googleMapsUrl(post, "walking");

        map.panTo({
            lat: Number(post.latitude),
            lng: Number(post.longitude)
        });

        if (map.getZoom() < 13) {
            map.setZoom(13);
        }

        directionsPanel.scrollIntoView({
            behavior: "smooth",
            block: "nearest"
        });
    }

    async function loadInitialPost(postId) {
        const response = await fetch(`/api/map/posts/${postId}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.error || "The post location could not be loaded."
            );
        }

        const initialPost = data.post;
        const postDate = new Date(initialPost.createdAt);
        const dateValue = localDateValue(postDate);

        dateInput.value = dateValue;
        await loadDate(dateValue);

        const loadedPost =
            posts.find(
                (post) => String(post._id) === String(initialPost._id)
            ) || initialPost;

        selectPost(loadedPost);
    }

    async function initialize() {
        dateInput.max = localDateValue(new Date());

        if (!apiKey) {
            setMapMessage(
                "GOOGLE_MAPS_API_KEY is missing from the environment."
            );
            summary.textContent = "Map unavailable";
            return;
        }

        await loadGoogleMaps();

        InfoWindow = google.maps.InfoWindow;
        AdvancedMarkerElement =
            google.maps.marker?.AdvancedMarkerElement;

        if (!AdvancedMarkerElement) {
            throw new Error(
                "The Google Maps marker library could not be loaded."
            );
        }

        map = new google.maps.Map(mapElement, {
            center: {
                lat: 31.8,
                lng: 34.8
            },
            zoom: 8,
            mapId: "DEMO_MAP_ID",
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true
        });
        infoWindow = new InfoWindow();

        last24Button.addEventListener("click", () => {
            loadLast24Hours().catch((error) => {
                setMapMessage(error.message);
                summary.textContent = "Could not load posts";
            });
        });

        dateInput.addEventListener("change", () => {
            if (!dateInput.value) {
                return;
            }

            loadDate(dateInput.value).catch((error) => {
                setMapMessage(error.message);
                summary.textContent = "Could not load posts";
            });
        });

        if (initialPostId) {
            await loadInitialPost(initialPostId);
        } else {
            await loadLast24Hours();
        }
    }

    initialize().catch((error) => {
        console.error(error);
        setMapMessage(error.message);
        summary.textContent = "Map unavailable";
    });
});
