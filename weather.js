// Weather API Integration for Sakarya Weather Dashboard
// Uses Open-Meteo API (free, no auth required)

class WeatherApp {
    constructor() {
        this.apiBase = 'https://api.open-meteo.com/v1/forecast';
        this.geocodeBase = 'https://geocoding-api.open-meteo.com/v1/search';
        this.openWeatherApiKey = 'REPLACE_WITH_YOUR_OPENWEATHER_API_KEY';
        this.currentLocation = {
            name: 'Adapazarı, Sakarya',
            lat: 40.7833,
            lon: 30.4000
        };
        this.weatherData = null;
        this.airQualityData = null;
        this.selectedIndex = -1;
        this.init();
    }

    async init() {
        try {
            const [weatherData, airQualityData] = await Promise.all([
                this.fetchWeather(this.currentLocation.lat, this.currentLocation.lon),
                this.fetchAirQuality(this.currentLocation.lat, this.currentLocation.lon)
            ]);

            this.weatherData = weatherData;
            this.airQualityData = airQualityData;
            this.updateUI();
        } catch (error) {
            console.error('Initial weather fetch failed:', error);
            this.showError('Unable to load weather data. Please check your connection.');
        }

        this.setupSearch();
    }

    async fetchWeather(lat, lon) {
        const params = new URLSearchParams({
            latitude: lat,
            longitude: lon,
            current_weather: 'true',
            past_days: 10,
            hourly: 'temperature_2m,relative_humidity_2m,wind_speed_10m,apparent_temperature,weathercode',
            daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode,sunrise,sunset,moonphase',
            timezone: 'auto'
        });

        const response = await fetch(`${this.apiBase}?${params}`);

        if (!response.ok) {
            throw new Error(`Weather API error: ${response.status}`);
        }

        return await response.json();
    }

    async fetchAirQuality(lat, lon) {
        if (!this.openWeatherApiKey || this.openWeatherApiKey.includes('REPLACE_WITH')) {
            return null;
        }

        const url = new URL('https://api.openweathermap.org/data/2.5/air_pollution/forecast');
        url.search = new URLSearchParams({
            lat,
            lon,
            appid: this.openWeatherApiKey
        });

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`OpenWeather Air Quality API error: ${response.status}`);
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

        searchInput.addEventListener('keydown', (e) => {
            const items = suggestionsContainer.querySelectorAll('div[data-suggestion]');
            
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.selectedIndex = Math.min(this.selectedIndex + 1, items.length - 1);
                updateSelection();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.selectedIndex = Math.max(this.selectedIndex - 1, -1);
                updateSelection();
            } else if (e.key === 'Enter' && this.selectedIndex >= 0) {
                e.preventDefault();
                items[this.selectedIndex].click();
            } else if (e.key === 'Escape') {
                suggestionsContainer.style.display = 'none';
                this.selectedIndex = -1;
            }
        });

        const updateSelection = () => {
            const items = suggestionsContainer.querySelectorAll('div[data-suggestion]');
            items.forEach((item, index) => {
                if (index === this.selectedIndex) {
                    item.classList.add('bg-primary-container');
                    item.classList.remove('hover:bg-surface-container');
                } else {
                    item.classList.remove('bg-primary-container');
                    item.classList.add('hover:bg-surface-container');
                }
            });
        };

        // Hide suggestions when clicking outside
        document.addEventListener('click', (e) => {
            if (!searchInput.contains(e.target) && !suggestionsContainer.contains(e.target)) {
                suggestionsContainer.style.display = 'none';
                this.selectedIndex = -1;
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
        this.selectedIndex = -1; // Reset selection

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

                Promise.all([
                    this.fetchWeather(this.currentLocation.lat, this.currentLocation.lon),
                    this.fetchAirQuality(this.currentLocation.lat, this.currentLocation.lon)
                ])
                    .then(([weatherData, airQualityData]) => {
                        this.weatherData = weatherData;
                        this.airQualityData = airQualityData;
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
        this.updateAirQuality();
        this.updateSunMoon();
        this.updateLocationDisplay();
    }

    updateCurrentWeather() {
        const current = this.weatherData.current_weather;
        const hourly = this.weatherData.hourly;
        const index = this.findCurrentHourIndex(hourly);

        const tempElement = document.getElementById('current-temperature');
        if (tempElement) {
            tempElement.textContent = Math.round(current.temperature);
        }

        const windElement = document.getElementById('current-wind-speed');
        if (windElement) {
            windElement.textContent = `${Math.round(current.windspeed)} km/h`;
        }

        const humidityElement = document.getElementById('current-humidity');
        if (humidityElement && hourly.relative_humidity_2m) {
            humidityElement.textContent = `${Math.round(hourly.relative_humidity_2m[index])}%`;
        }

        const realFeelElement = document.getElementById('current-real-feel');
        if (realFeelElement && hourly.apparent_temperature) {
            realFeelElement.textContent = `RealFeel® ${Math.round(hourly.apparent_temperature[index])}°`;
        }

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

        const existingCards = container.querySelectorAll('.hourly-card');
        existingCards.forEach(card => card.remove());

        const startIndex = this.findCurrentHourIndex(hourly);
        const displayCount = Math.min(24, hourly.time.length - startIndex);

        for (let offset = 0; offset < displayCount; offset++) {
            const hourIndex = startIndex + offset;
            const time = new Date(hourly.time[hourIndex]);
            const temp = Math.round(hourly.temperature_2m[hourIndex]);
            const iconName = this.weatherCodeToIcon(hourly.weathercode[hourIndex]);
            const label = offset === 0 ? 'NOW' : time.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });

            const card = document.createElement('div');
            card.className = 'flex-shrink-0 w-24 flex flex-col items-center p-unit-4 hover:bg-surface-container rounded-xl transition-colors hourly-card';
            card.innerHTML = `
                <p class="text-label-caps font-label-caps text-on-surface-variant">${label}</p>
                <span class="material-symbols-outlined text-primary my-unit-2">${iconName}</span>
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
            const weathercode = daily.weathercode[i];
            const iconName = this.weatherCodeToIcon(weathercode);
            const description = this.weatherCodeToSummary(weathercode);

            const dayElement = row.querySelector('.forecast-day');
            if (dayElement) dayElement.textContent = dayName;

            const iconElement = row.querySelector('.material-symbols-outlined');
            if (iconElement) {
                iconElement.textContent = iconName;
                iconElement.dataset.icon = iconName;
            }

            const descriptionElement = row.querySelector('.text-body-sm');
            if (descriptionElement) {
                descriptionElement.textContent = description;
            }

            const highElement = row.querySelector('.forecast-high');
            if (highElement) highElement.textContent = `${high}°`;

            const lowElement = row.querySelector('.forecast-low');
            if (lowElement) lowElement.textContent = `${low}°`;
        }
    }

    updateAirQuality() {
        const statusElement = document.getElementById('air-quality-status');
        const summaryElement = document.getElementById('air-quality-summary');
        const valueElement = document.getElementById('air-quality-value');
        if (!statusElement || !summaryElement || !valueElement) return;

        if (!this.airQualityData || !this.airQualityData.list || this.airQualityData.list.length === 0) {
            statusElement.textContent = 'Unavailable';
            statusElement.className = 'text-headline-lg font-headline-lg text-on-surface-variant';
            summaryElement.textContent = 'Air quality data is not available for this location.';
            valueElement.textContent = '--';
            return;
        }

        const now = Date.now() / 1000;
        const nearest = this.airQualityData.list.reduce((closest, item) => {
            return Math.abs(item.dt - now) < Math.abs(closest.dt - now) ? item : closest;
        }, this.airQualityData.list[0]);

        const aqi = this.getAqiCategory(nearest.main.aqi);
        const pm25 = nearest.components.pm2_5;

        statusElement.textContent = aqi.label;
        statusElement.className = `text-headline-lg font-headline-lg ${aqi.colorClass}`;
        summaryElement.textContent = aqi.message;
        valueElement.textContent = pm25 != null ? `${Math.round(pm25)} μg/m³` : '--';
    }

    updateSunMoon() {
        const daily = this.weatherData.daily;
        if (!daily) return;

        const sunriseElement = document.getElementById('sunrise-time');
        const sunsetElement = document.getElementById('sunset-time');
        const moonElement = document.getElementById('moon-phase');

        if (sunriseElement) sunriseElement.textContent = daily.sunrise[0] ? new Date(daily.sunrise[0]).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : '--';
        if (sunsetElement) sunsetElement.textContent = daily.sunset[0] ? new Date(daily.sunset[0]).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : '--';
        if (moonElement) {
            const phase = daily.moonphase && daily.moonphase[0] != null ? daily.moonphase[0] : null;
            moonElement.textContent = phase != null ? this.getMoonPhaseName(phase) : 'Unavailable';
        }
    }

    updateLocationDisplay() {
        const locationElement = document.getElementById('current-location');
        if (locationElement) {
            locationElement.textContent = this.currentLocation.name;
        }
    }

    findCurrentHourIndex(hourly) {
        const now = new Date();
        return hourly.time.findIndex(timeString => {
            const date = new Date(timeString);
            return date.getFullYear() === now.getFullYear() &&
                date.getMonth() === now.getMonth() &&
                date.getDate() === now.getDate() &&
                date.getHours() === now.getHours();
        }) || 0;
    }

    weatherCodeToIcon(code) {
        if (code === 0) return 'wb_sunny';
        if (code === 1 || code === 2) return 'partly_cloudy_day';
        if (code === 3 || code === 45 || code === 48) return 'cloud';
        if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return 'rainy';
        if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snowing';
        if ([95, 96, 99].includes(code)) return 'thunderstorm';
        return 'cloud';
    }

    weatherCodeToSummary(code) {
        if (code === 0) return 'Clear skies';
        if (code === 1 || code === 2) return 'Partly cloudy';
        if (code === 3) return 'Overcast';
        if (code === 45 || code === 48) return 'Foggy conditions';
        if ([51, 53, 55].includes(code)) return 'Light rain';
        if ([61, 63, 65].includes(code)) return 'Rain showers';
        if ([71, 73, 75, 77].includes(code)) return 'Snowy';
        if ([80, 81, 82].includes(code)) return 'Rain with possible storms';
        if ([85, 86].includes(code)) return 'Snow showers';
        if ([95, 96, 99].includes(code)) return 'Thunderstorms';
        return 'Mixed conditions';
    }

    getAqiCategory(aqi) {
        switch (aqi) {
            case 1:
                return { label: 'Good', message: 'Air quality is good. Perfect for outdoor plans.', colorClass: 'text-primary' };
            case 2:
                return { label: 'Fair', message: 'Air quality is acceptable. Sensitive people should take care.', colorClass: 'text-warning-orange' };
            case 3:
                return { label: 'Moderate', message: 'Air quality is moderate. Some may experience discomfort.', colorClass: 'text-warning-orange' };
            case 4:
                return { label: 'Poor', message: 'Air quality is poor. Reduce extended outdoor exposure.', colorClass: 'text-error' };
            case 5:
                return { label: 'Very Poor', message: 'Air quality is very poor. Avoid outdoor activity.', colorClass: 'text-error' };
            default:
                return { label: 'Unknown', message: 'Air quality data unavailable.', colorClass: 'text-on-surface-variant' };
        }
    }

    getMoonPhaseName(phase) {
        if (phase <= 0.03 || phase >= 0.97) return 'New Moon';
        if (phase <= 0.22) return 'Waxing Crescent';
        if (phase <= 0.28) return 'First Quarter';
        if (phase <= 0.47) return 'Waxing Gibbous';
        if (phase <= 0.53) return 'Full Moon';
        if (phase <= 0.72) return 'Waning Gibbous';
        if (phase <= 0.78) return 'Last Quarter';
        return 'Waning Crescent';
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
});