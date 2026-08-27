const analyticsModel = require("../models/analyticsModel");

const ALLOWED_PERIODS = new Set([7, 30, 90, 365]);

function getDays(value) {
    const days = Number.parseInt(value, 10);
    return ALLOWED_PERIODS.has(days) ? days : 30;
}

async function fetchJson(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                Accept: "application/json"
            }
        });

        if (!response.ok) {
            throw new Error(`Request failed with status ${response.status}`);
        }

        return response.json();
    } finally {
        clearTimeout(timeout);
    }
}

function page(req, res) {
    res.render("analytics/index", {
        defaultCity: res.locals.currentUser?.city || "Tel Aviv"
    });
}

async function data(req, res) {
    try {
        const dashboard = await analyticsModel.getDashboardData(
            req.session.userId,
            getDays(req.query.days)
        );

        res.set("Cache-Control", "no-store");
        res.json(dashboard);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: "Analytics data could not be loaded"
        });
    }
}

async function weather(req, res) {
    try {
        const fallbackCity = res.locals.currentUser?.city || "Tel Aviv";
        const city = String(req.query.city || fallbackCity)
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 100);

        if (city.length < 2) {
            return res.status(400).json({
                error: "Enter a valid city"
            });
        }

        const geocodingParameters = new URLSearchParams({
            name: city,
            count: "1",
            language: "en",
            format: "json"
        });

        const geocodingData = await fetchJson(
            `https://geocoding-api.open-meteo.com/v1/search?${geocodingParameters}`
        );
        const location = geocodingData.results?.[0];

        if (!location) {
            return res.status(404).json({
                error: "Location not found"
            });
        }

        const forecastParameters = new URLSearchParams({
            latitude: String(location.latitude),
            longitude: String(location.longitude),
            current:
                "temperature_2m,apparent_temperature,weather_code,wind_speed_10m",
            daily:
                "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max",
            timezone: "auto",
            forecast_days: "7",
            temperature_unit: "celsius",
            wind_speed_unit: "kmh"
        });

        const forecastData = await fetchJson(
            `https://api.open-meteo.com/v1/forecast?${forecastParameters}`
        );

        const daily = (forecastData.daily?.time || []).map(
            (date, index) => ({
                date,
                weatherCode:
                    forecastData.daily.weather_code?.[index] ?? null,
                temperatureMax:
                    forecastData.daily.temperature_2m_max?.[index] ??
                    null,
                temperatureMin:
                    forecastData.daily.temperature_2m_min?.[index] ??
                    null,
                precipitationProbability:
                    forecastData.daily
                        .precipitation_probability_max?.[index] ?? null,
                windSpeedMax:
                    forecastData.daily.wind_speed_10m_max?.[index] ??
                    null
            })
        );

        res.set("Cache-Control", "no-store");
        res.json({
            location: {
                name: location.name,
                country: location.country || "",
                admin1: location.admin1 || "",
                latitude: location.latitude,
                longitude: location.longitude,
                timezone:
                    forecastData.timezone ||
                    location.timezone ||
                    ""
            },
            current: {
                time: forecastData.current?.time || null,
                temperature:
                    forecastData.current?.temperature_2m ?? null,
                apparentTemperature:
                    forecastData.current?.apparent_temperature ??
                    null,
                weatherCode:
                    forecastData.current?.weather_code ?? null,
                windSpeed:
                    forecastData.current?.wind_speed_10m ?? null
            },
            daily
        });
    } catch (error) {
        console.error(error);
        res.status(502).json({
            error: "Weather forecast could not be loaded"
        });
    }
}

module.exports = {
    page,
    data,
    weather
};
