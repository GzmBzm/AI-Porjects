// Weather API Integration for Sakarya Weather Dashboard
// Uses Open-Meteo API (free, no auth required)

class WeatherApp {
    constructor() {
        this.apiBase = 'https://api.open-meteo.com/v1/forecast';
        this.geocodeBase = 'https://geocoding-api.open-meteo.com/v1/search';
        this.currentLocation = {
            name: 'Adapazarı, Sakarya',
            lat: 40.7833,
            lon: 30.4000
        };
        this.weatherData = null;
        this.init();
    }

    init() {
        // Initialize with default location
        this.fetchWeather(this.currentLocation.lat, this.currentLocation.lon)
            .then(data => {
                this.weatherData = data;
                this.updateUI();
            })
            .catch(error => {
                console.error('Initial weather fetch failed:', error);
                this.showError('Unable to load weather data. Please check your connection.');
            });

        // Set up search functionality
        this.setupSearch();
    }

    async fetchWeather(lat, lon) {
        const params = new URLSearchParams({
            latitude: lat,
            longitude: lon,
            current: 'temperature_2m,wind_speed_10m,relative_humidity_2m,apparent_temperature',
            hourly: 'temperature_2m,relative_humidity_2m,wind_speed_10m',
            daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code',
            timezone: 'auto'
        });

        const response = await fetch(`${this.apiBase}?${params}`);

        if (!response.ok) {
            throw new Error(`Weather API error: ${response.status}`);
        }

        return await response.json();
    }

    async geocodeLocation(locationName) {
        const params = new URLSearchParams({
            name: locationName,
            count: 5,
            language: 'en',
            format: 'json'
        });

        const response = await fetch(`${this.geocodeBase}?${params}`);

        if (!response.ok) {
            throw new Error(`Geocoding API error: ${response.status}`);
        }

        const data = await response.json();
        return data.results || [];
    }

    setupSearch() {
        const searchInput = document.getElementById('location-search');
        if (!searchInput) return;

        let searchTimeout;
        let selectedIndex = -1;
        const suggestionsContainer = document.createElement('div');
        suggestionsContainer.className = 'absolute top-full left-0 right-0 bg-surface border border-outline rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto mt-1';
        suggestionsContainer.style.display = 'none';
        searchInput.parentElement.appendChild(suggestionsContainer);

        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            clearTimeout(searchTimeout);

            if (query.length < 2) {
                suggestionsContainer.style.display = 'none';
                return;
            }

            // Show loading state
            suggestionsContainer.innerHTML = '<div class="p-3 text-on-surface-variant">Searching...</div>';
            suggestionsContainer.style.display = 'block';

            searchTimeout = setTimeout(async () => {
                try {
                    const results = await this.geocodeLocation(query);
                    this.showSuggestions(results, suggestionsContainer, searchInput);
                } catch (error) {
                    console.error('Geocoding failed:', error);
                    suggestionsContainer.innerHTML = '<div class="p-3 text-error">Search failed. Please try again.</div>';
                    suggestionsContainer.style.display = 'block';
                    setTimeout(() => {
                        suggestionsContainer.style.display = 'none';
                    }, 2000);
                }
            }, 300);
        });

        let selectedIndex = -1;

        searchInput.addEventListener('keydown', (e) => {
            const items = suggestionsContainer.querySelectorAll('div[data-suggestion]');
            
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
                updateSelection();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                selectedIndex = Math.max(selectedIndex - 1, -1);
                updateSelection();
            } else if (e.key === 'Enter' && selectedIndex >= 0) {
                e.preventDefault();
                items[selectedIndex].click();
            } else if (e.key === 'Escape') {
                suggestionsContainer.style.display = 'none';
                selectedIndex = -1;
            }
        });

        function updateSelection() {
            const items = suggestionsContainer.querySelectorAll('div[data-suggestion]');
            items.forEach((item, index) => {
                if (index === selectedIndex) {
                    item.classList.add('bg-primary-container');
                    item.classList.remove('hover:bg-surface-container');
                } else {
                    item.classList.remove('bg-primary-container');
                    item.classList.add('hover:bg-surface-container');
                }
            });
        }

        // Hide suggestions when clicking outside
        document.addEventListener('click', (e) => {
            if (!searchInput.contains(e.target) && !suggestionsContainer.contains(e.target)) {
                suggestionsContainer.style.display = 'none';
                selectedIndex = -1;
            }
        });

        // Reset selection when input is focused
        searchInput.addEventListener('focus', () => {
            if (searchInput.value.trim().length >= 2) {
                // Re-show suggestions if we have a query
                const query = searchInput.value.trim();
                this.geocodeLocation(query)
                    .then(results => this.showSuggestions(results, suggestionsContainer, searchInput))
                    .catch(() => {});
            }
        });
    }

    showSuggestions(results, container, input) {
        container.innerHTML = '';
        selectedIndex = -1; // Reset selection

        if (results.length === 0) {
            container.innerHTML = '<div class="p-3 text-on-surface-variant">No locations found</div>';
            container.style.display = 'block';
            return;
        }

        results.forEach((result, index) => {
            const item = document.createElement('div');
            item.className = 'p-3 hover:bg-surface-container cursor-pointer border-b border-surface-container-low last:border-0 transition-colors';
            item.setAttribute('data-suggestion', index);
            item.innerHTML = `
                <div class="font-medium text-on-surface">${result.name}</div>
                <div class="text-sm text-on-surface-variant">
                    ${result.admin1 && result.admin1 !== result.name ? result.admin1 + ', ' : ''}${result.country}
                </div>
            `;

            item.addEventListener('click', () => {
                // Format location name properly
                let locationName = result.name;
                if (result.admin1 && result.admin1 !== result.name) {
                    locationName += `, ${result.admin1}`;
                }
                if (result.country) {
                    locationName += `, ${result.country}`;
                }

                this.currentLocation = {
                    name: locationName,
                    lat: result.latitude,
                    lon: result.longitude
                };
                input.value = this.currentLocation.name;
                container.style.display = 'none';

                // Fetch new weather data
                this.fetchWeather(this.currentLocation.lat, this.currentLocation.lon)
                    .then(data => {
                        this.weatherData = data;
                        this.updateUI();
                    })
                    .catch(error => {
                        console.error('Weather fetch failed:', error);
                        this.showError('Unable to load weather for this location.');
                    });
            });

            container.appendChild(item);
        });

        container.style.display = 'block';
    }

    updateUI() {
        if (!this.weatherData) return;

        this.updateCurrentWeather();
        this.updateHourlyForecast();
        this.updateTenDayForecast();
        this.updateLocationDisplay();
    }

    updateCurrentWeather() {
        const current = this.weatherData.current;

        // Update temperature
        const tempElement = document.getElementById('current-temperature');
        if (tempElement) {
            tempElement.textContent = Math.round(current.temperature_2m);
        }

        // Update wind speed
        const windElement = document.getElementById('current-wind-speed');
        if (windElement) {
            windElement.textContent = `${Math.round(current.wind_speed_10m)} km/h`;
        }

        // Update humidity
        const humidityElement = document.getElementById('current-humidity');
        if (humidityElement) {
            humidityElement.textContent = `${Math.round(current.relative_humidity_2m)}%`;
        }

        // Update RealFeel (apparent temperature)
        const realFeelElement = document.getElementById('current-real-feel');
        if (realFeelElement) {
            realFeelElement.textContent = `RealFeel® ${Math.round(current.apparent_temperature)}°`;
        }

        // Update time
        const timeElement = document.getElementById('current-time');
        if (timeElement) {
            const now = new Date();
            timeElement.textContent = now.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            }) + ' • ' + now.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            });
        }
    }

    updateHourlyForecast() {
        const hourly = this.weatherData.hourly;
        const container = document.getElementById('hourly-forecast-container');
        if (!container) return;

        // Clear existing cards except the first one (NOW)
        const existingCards = container.querySelectorAll('.hourly-card');
        existingCards.forEach(card => card.remove());

        // Get next 24 hours starting from current hour
        const now = new Date();
        const currentHour = now.getHours();

        for (let i = 1; i <= 24; i++) {
            const hourIndex = (currentHour + i) % 24;
            const time = new Date(hourly.time[hourIndex]);
            const temp = Math.round(hourly.temperature_2m[hourIndex]);
            const wind = Math.round(hourly.wind_speed_10m[hourIndex]);

            const card = document.createElement('div');
            card.className = 'flex-shrink-0 w-24 flex flex-col items-center p-unit-4 hover:bg-surface-container rounded-xl transition-colors hourly-card';
            card.innerHTML = `
                <p class="text-label-caps font-label-caps text-on-surface-variant">${time.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true })}</p>
                <span class="material-symbols-outlined text-slate-text my-unit-2" data-icon="wb_sunny">wb_sunny</span>
                <p class="text-body-lg font-bold">${temp}°</p>
            `;

            container.appendChild(card);
        }
    }

    updateTenDayForecast() {
        const daily = this.weatherData.daily;
        const container = document.getElementById('ten-day-forecast-container');
        if (!container) return;

        const dayRows = container.querySelectorAll('.day-forecast-row');
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        for (let i = 0; i < Math.min(dayRows.length, daily.time.length); i++) {
            const row = dayRows[i];
            const date = new Date(daily.time[i]);
            const dayName = i === 0 ? 'Today' : days[date.getDay()].substring(0, 3);
            const high = Math.round(daily.temperature_2m_max[i]);
            const low = Math.round(daily.temperature_2m_min[i]);

            // Update day name
            const dayElement = row.querySelector('.forecast-day');
            if (dayElement) dayElement.textContent = dayName;

            // Update high temp
            const highElement = row.querySelector('.forecast-high');
            if (highElement) highElement.textContent = `${high}°`;

            // Update low temp
            const lowElement = row.querySelector('.forecast-low');
            if (lowElement) lowElement.textContent = `${low}°`;
        }
    }

    updateLocationDisplay() {
        const locationElement = document.getElementById('current-location');
        if (locationElement) {
            locationElement.textContent = this.currentLocation.name;
        }
    }

    showError(message) {
        // Create or update error banner
        let errorBanner = document.getElementById('error-banner');
        if (!errorBanner) {
            errorBanner = document.createElement('div');
            errorBanner.id = 'error-banner';
            errorBanner.className = 'bg-error text-on-error p-unit-4 rounded-xl flex items-center justify-between shadow-lg mb-unit-4';
            errorBanner.innerHTML = `
                <div class="flex items-center gap-unit-4">
                    <span class="material-symbols-outlined text-on-error text-3xl">error</span>
                    <div>
                        <p class="font-bold text-body-lg">Weather Error</p>
                        <p class="text-body-sm opacity-90" id="error-message"></p>
                    </div>
                </div>
                <button class="bg-on-error/20 hover:bg-on-error/30 px-unit-4 py-unit-2 rounded-lg text-label-caps font-label-caps transition-colors" onclick="this.parentElement.remove()">Dismiss</button>
            `;
            const main = document.querySelector('main');
            if (main) {
                main.insertBefore(errorBanner, main.firstChild);
            }
        }

        const messageElement = errorBanner.querySelector('#error-message');
        if (messageElement) {
            messageElement.textContent = message;
        }

        // Auto-hide after 10 seconds
        setTimeout(() => {
            if (errorBanner.parentElement) {
                errorBanner.remove();
            }
        }, 10000);
    }
}

// Initialize the weather app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.weatherApp = new WeatherApp();
});</content>
<parameter name="filePath">c:\AI-Porjects\weather.js