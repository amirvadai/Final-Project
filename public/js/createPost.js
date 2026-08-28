const searchBtn = document.getElementById('searchLocBtn');
const searchInput = document.getElementById('locationSearch');
const resultsList = document.getElementById('locationResults');
const hiddenLocName = document.getElementById('locationName');
const hiddenLat = document.getElementById('lat');
const hiddenLon = document.getElementById('lon');

searchBtn.addEventListener('click', async () => {
    const query = searchInput.value.trim();
    if (!query) return;
    
    resultsList.innerHTML = '<li class="location-status-message">Searching...</li>';
    resultsList.style.display = 'block';

    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
        const data = await res.json();

        resultsList.innerHTML = ''; 

        if (data.length === 0) {
            resultsList.innerHTML = '<li class="location-status-message">No results found.</li>';
            return;
        }

        data.forEach(place => {
            const li = document.createElement('li');
            li.textContent = place.display_name;
            li.className = 'location-results-item';

            li.addEventListener('click', () => {
                let simpleName = place.display_name.split(',')[0]; 
                searchInput.value = simpleName; 
                
                hiddenLocName.value = simpleName;
                hiddenLat.value = place.lat;
                hiddenLon.value = place.lon;
                
                resultsList.style.display = 'none'; 
            });

            resultsList.appendChild(li);
        });
    } catch (err) {
        console.error(err);
        resultsList.innerHTML = '<li class="location-error-message">Error fetching location.</li>';
    }
});