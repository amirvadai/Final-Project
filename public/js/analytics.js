document.addEventListener("DOMContentLoaded", () => {
    const page = document.querySelector("[data-analytics-page]");

    if (!page) {
        return;
    }

    const elements = {
        range: document.querySelector("#analytics-range"),
        refresh: document.querySelector("#analytics-refresh"),
        error: document.querySelector("#analytics-error"),
        tooltip: document.querySelector("#analytics-tooltip"),
        periodLabel: document.querySelector("#posts-period-label"),
        summaryUsers: document.querySelector("#summary-users"),
        summaryPosts: document.querySelector("#summary-posts"),
        summaryGroups: document.querySelector("#summary-groups"),
        summaryMedia: document.querySelector("#summary-media"),
        summaryForecast: document.querySelector("#summary-forecast"),
        trend: document.querySelector("#posts-trend-chart"),
        types: document.querySelector("#post-types-chart"),
        authors: document.querySelector("#top-authors-chart"),
        cities: document.querySelector("#city-activity-chart"),
        hours: document.querySelector("#posting-hours-chart"),
        map: document.querySelector("#group-map-chart"),
        weatherForm: document.querySelector("#weather-form"),
        weatherCity: document.querySelector("#weather-city"),
        cityOptions: document.querySelector("#analytics-city-options"),
        weatherError: document.querySelector("#weather-error"),
        weatherLabel: document.querySelector("#weather-location-label"),
        weatherTemperature: document.querySelector(
            "#weather-current-temperature"
        ),
        weatherCondition: document.querySelector(
            "#weather-current-condition"
        ),
        weatherFeels: document.querySelector("#weather-current-feels"),
        weatherWind: document.querySelector("#weather-current-wind"),
        weatherChart: document.querySelector("#weather-chart")
    };

    const state = {
        days: Number(elements.range.value),
        data: null,
        weather: null,
        world: null,
        worldLoaded: false,
        resizeTimer: null
    };

    const styles = getComputedStyle(document.documentElement);
    const colors = {
        primary:
            styles.getPropertyValue("--primary").trim() || "#2563eb",
        primaryDark:
            styles.getPropertyValue("--primary-dark").trim() ||
            "#1d4ed8",
        text: styles.getPropertyValue("--text").trim() || "#182230",
        muted:
            styles.getPropertyValue("--text-muted").trim() ||
            "#667085",
        border:
            styles.getPropertyValue("--border").trim() || "#dfe5ec",
        surface:
            styles.getPropertyValue("--surface").trim() || "#ffffff",
        group: "#7c3aed",
        image: "#0ea5e9",
        video: "#f97316",
        weatherHigh: "#ef4444",
        weatherLow: "#2563eb",
        rain: "#38bdf8"
    };

    function formatNumber(value) {
        return new Intl.NumberFormat().format(value || 0);
    }

    function formatDate(value, options = {}) {
        return new Intl.DateTimeFormat("en", {
            month: "short",
            day: "numeric",
            ...options
        }).format(new Date(`${value}T00:00:00Z`));
    }

    function requestJson(url) {
        return fetch(url, {
            headers: {
                Accept: "application/json"
            }
        }).then(async (response) => {
            const body = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(body.error || "Request failed");
            }

            return body;
        });
    }

    function showError(element, message) {
        element.textContent = message;
        element.hidden = false;
    }

    function hideError(element) {
        element.textContent = "";
        element.hidden = true;
    }

    function setChartLoading(element) {
        element.replaceChildren();
        const loading = document.createElement("div");
        loading.className = "analytics-chart-loading";
        loading.setAttribute("aria-label", "Loading");
        element.append(loading);
    }

    function setChartEmpty(element, message) {
        element.replaceChildren();
        const empty = document.createElement("div");
        empty.className = "analytics-chart-empty";
        empty.textContent = message;
        element.append(empty);
    }

    function chartSize(element, height) {
        return {
            width: Math.max(element.clientWidth || 0, 300),
            height
        };
    }

    function createSvg(element, height) {
        element.replaceChildren();
        const { width } = chartSize(element, height);

        return {
            width,
            height,
            svg: d3
                .select(element)
                .append("svg")
                .attr("viewBox", `0 0 ${width} ${height}`)
                .attr("preserveAspectRatio", "xMidYMid meet")
        };
    }

    function showTooltip(event, rows) {
        elements.tooltip.replaceChildren();

        for (const row of rows) {
            const line = document.createElement("div");
            const label = document.createElement("span");
            const value = document.createElement("strong");

            line.className = "analytics-tooltip-row";
            label.textContent = row.label;
            value.textContent = row.value;
            line.append(label, value);
            elements.tooltip.append(line);
        }

        elements.tooltip.hidden = false;
        moveTooltip(event);
    }

    function moveTooltip(event) {
        const padding = 14;
        const rect = elements.tooltip.getBoundingClientRect();
        let left = event.clientX + padding;
        let top = event.clientY + padding;

        if (left + rect.width > window.innerWidth - padding) {
            left = event.clientX - rect.width - padding;
        }

        if (top + rect.height > window.innerHeight - padding) {
            top = event.clientY - rect.height - padding;
        }

        elements.tooltip.style.left = `${Math.max(padding, left)}px`;
        elements.tooltip.style.top = `${Math.max(padding, top)}px`;
    }

    function hideTooltip() {
        elements.tooltip.hidden = true;
    }

    function drawGrid(svg, scale, width, margin, tickCount = 5) {
        svg.append("g")
            .attr("transform", `translate(${margin.left},0)`)
            .call(
                d3
                    .axisLeft(scale)
                    .ticks(tickCount)
                    .tickSize(
                        -(width - margin.left - margin.right)
                    )
                    .tickFormat("")
            )
            .call((group) => group.select(".domain").remove())
            .call((group) =>
                group
                    .selectAll("line")
                    .attr("stroke", colors.border)
                    .attr("stroke-opacity", .7)
            );
    }

    function renderSummary() {
        const summary = state.data.summary;

        elements.summaryUsers.textContent = formatNumber(
            summary.totalUsers
        );
        elements.summaryPosts.textContent = formatNumber(
            summary.totalPosts
        );
        elements.summaryGroups.textContent = formatNumber(
            summary.totalGroups
        );
        elements.summaryMedia.textContent = `${summary.mediaShare}%`;
        elements.summaryForecast.textContent = formatNumber(
            summary.forecastPosts
        );
        elements.periodLabel.textContent =
            `${formatDate(state.data.period.start)} – ` +
            `${formatDate(state.data.period.end)}`;
    }

    function renderTrendChart() {
        const history = state.data.dailyPosts;
        const forecast = state.data.forecast;

        if (!history.length) {
            setChartEmpty(elements.trend, "No post activity is available.");
            return;
        }

        const { width, height, svg } = createSvg(
            elements.trend,
            370
        );
        const margin = {
            top: 30,
            right: 24,
            bottom: 45,
            left: 48
        };
        const parseDate = d3.utcParse("%Y-%m-%d");
        const actual = history.map((item) => ({
            ...item,
            parsedDate: parseDate(item.date)
        }));
        const predicted = forecast.map((item) => ({
            ...item,
            parsedDate: parseDate(item.date)
        }));
        const forecastLine = [
            {
                date: actual[actual.length - 1].date,
                parsedDate: actual[actual.length - 1].parsedDate,
                total: actual[actual.length - 1].total
            },
            ...predicted
        ];
        const all = [...actual, ...predicted];
        const x = d3
            .scaleUtc()
            .domain(d3.extent(all, (item) => item.parsedDate))
            .range([margin.left, width - margin.right]);
        const maximum = d3.max(all, (item) => item.total) || 1;
        const y = d3
            .scaleLinear()
            .domain([0, maximum])
            .nice()
            .range([height - margin.bottom, margin.top]);

        drawGrid(svg, y, width, margin);

        const area = d3
            .area()
            .x((item) => x(item.parsedDate))
            .y0(y(0))
            .y1((item) => y(item.total))
            .curve(d3.curveMonotoneX);

        const line = d3
            .line()
            .x((item) => x(item.parsedDate))
            .y((item) => y(item.total))
            .curve(d3.curveMonotoneX);

        svg.append("path")
            .datum(actual)
            .attr("fill", colors.primary)
            .attr("fill-opacity", .1)
            .attr("d", area);

        svg.append("path")
            .datum(actual)
            .attr("fill", "none")
            .attr("stroke", colors.primary)
            .attr("stroke-width", 3)
            .attr("d", line);

        svg.append("path")
            .datum(forecastLine)
            .attr("fill", "none")
            .attr("stroke", colors.group)
            .attr("stroke-width", 3)
            .attr("stroke-dasharray", "7 6")
            .attr("d", line);

        svg.selectAll(".analytics-actual-point")
            .data(actual.filter((item) => item.total > 0))
            .join("circle")
            .attr("cx", (item) => x(item.parsedDate))
            .attr("cy", (item) => y(item.total))
            .attr("r", 4)
            .attr("fill", colors.primary)
            .attr("stroke", colors.surface)
            .attr("stroke-width", 2)
            .on("mouseenter", (event, item) =>
                showTooltip(event, [
                    {
                        label: "Date",
                        value: formatDate(item.date, {
                            year: "numeric"
                        })
                    },
                    {
                        label: "All posts",
                        value: formatNumber(item.total)
                    },
                    {
                        label: "Community",
                        value: formatNumber(item.community)
                    },
                    {
                        label: "Groups",
                        value: formatNumber(item.group)
                    }
                ])
            )
            .on("mousemove", moveTooltip)
            .on("mouseleave", hideTooltip);

        svg.selectAll(".analytics-forecast-point")
            .data(predicted)
            .join("circle")
            .attr("cx", (item) => x(item.parsedDate))
            .attr("cy", (item) => y(item.total))
            .attr("r", 4)
            .attr("fill", colors.surface)
            .attr("stroke", colors.group)
            .attr("stroke-width", 2)
            .on("mouseenter", (event, item) =>
                showTooltip(event, [
                    {
                        label: "Forecast date",
                        value: formatDate(item.date, {
                            year: "numeric"
                        })
                    },
                    {
                        label: "Estimated posts",
                        value: formatNumber(item.total)
                    }
                ])
            )
            .on("mousemove", moveTooltip)
            .on("mouseleave", hideTooltip);

        const xTicks = width < 620 ? 5 : 9;

        svg.append("g")
            .attr(
                "transform",
                `translate(0,${height - margin.bottom})`
            )
            .call(
                d3
                    .axisBottom(x)
                    .ticks(xTicks)
                    .tickFormat(d3.utcFormat("%b %d"))
            )
            .call((group) => group.select(".domain").attr("stroke", colors.border));

        svg.append("g")
            .attr("transform", `translate(${margin.left},0)`)
            .call(
                d3
                    .axisLeft(y)
                    .ticks(5)
                    .tickFormat(d3.format("d"))
            )
            .call((group) => group.select(".domain").remove());

        const legend = svg
            .append("g")
            .attr("transform", `translate(${margin.left},12)`);

        legend
            .append("line")
            .attr("x1", 0)
            .attr("x2", 24)
            .attr("stroke", colors.primary)
            .attr("stroke-width", 3);

        legend
            .append("text")
            .attr("x", 31)
            .attr("y", 4)
            .text("Actual");

        legend
            .append("line")
            .attr("x1", 90)
            .attr("x2", 114)
            .attr("stroke", colors.group)
            .attr("stroke-width", 3)
            .attr("stroke-dasharray", "7 6");

        legend
            .append("text")
            .attr("x", 121)
            .attr("y", 4)
            .text("Forecast");
    }

    function renderPostTypesChart() {
        const data = state.data.postTypes;
        const total = d3.sum(data, (item) => item.count);

        if (!total) {
            setChartEmpty(elements.types, "No posts are available.");
            return;
        }

        const { width, height, svg } = createSvg(
            elements.types,
            300
        );
        const compact = width < 470;
        const centerX = compact ? width / 2 : width * .34;
        const centerY = compact ? 115 : height / 2;
        const radius = Math.min(
            compact ? 90 : 105,
            width * .24
        );
        const typeColors = {
            text: colors.primary,
            image: colors.image,
            video: colors.video
        };
        const pie = d3
            .pie()
            .sort(null)
            .value((item) => item.count);
        const arc = d3
            .arc()
            .innerRadius(radius * .58)
            .outerRadius(radius);
        const group = svg
            .append("g")
            .attr("transform", `translate(${centerX},${centerY})`);

        group
            .selectAll("path")
            .data(pie(data))
            .join("path")
            .attr("d", arc)
            .attr(
                "fill",
                (item) =>
                    typeColors[item.data.type] || colors.group
            )
            .attr("stroke", colors.surface)
            .attr("stroke-width", 3)
            .on("mouseenter", (event, item) =>
                showTooltip(event, [
                    {
                        label: "Type",
                        value:
                            item.data.type.charAt(0).toUpperCase() +
                            item.data.type.slice(1)
                    },
                    {
                        label: "Posts",
                        value: formatNumber(item.data.count)
                    },
                    {
                        label: "Share",
                        value: `${Math.round(
                            (item.data.count / total) * 100
                        )}%`
                    }
                ])
            )
            .on("mousemove", moveTooltip)
            .on("mouseleave", hideTooltip);

        group
            .append("text")
            .attr("text-anchor", "middle")
            .attr("y", -3)
            .attr("fill", colors.text)
            .attr("font-size", 25)
            .attr("font-weight", 800)
            .text(formatNumber(total));

        group
            .append("text")
            .attr("text-anchor", "middle")
            .attr("y", 17)
            .text("posts");

        const legendX = compact ? 24 : width * .64;
        const legendY = compact ? 225 : 82;
        const legend = svg
            .append("g")
            .attr("transform", `translate(${legendX},${legendY})`);

        const rows = legend
            .selectAll("g")
            .data(data)
            .join("g")
            .attr(
                "transform",
                (_, index) => `translate(0,${index * 34})`
            );

        rows
            .append("rect")
            .attr("width", 12)
            .attr("height", 12)
            .attr("rx", 3)
            .attr(
                "fill",
                (item) =>
                    typeColors[item.type] || colors.group
            );

        rows
            .append("text")
            .attr("x", 20)
            .attr("y", 10)
            .attr("fill", colors.text)
            .attr("font-weight", 700)
            .text(
                (item) =>
                    item.type.charAt(0).toUpperCase() +
                    item.type.slice(1)
            );

        rows
            .append("text")
            .attr("x", 110)
            .attr("y", 10)
            .attr("text-anchor", "end")
            .text((item) => formatNumber(item.count));
    }

    function renderTopAuthorsChart() {
        const data = state.data.topAuthors;

        if (!data.length) {
            setChartEmpty(
                elements.authors,
                "No contributor data is available."
            );
            return;
        }

        const { width, height, svg } = createSvg(
            elements.authors,
            300
        );
        const margin = {
            top: 16,
            right: 42,
            bottom: 24,
            left: Math.min(145, width * .42)
        };
        const authorKey = (item) =>
            item.userId || item.username || item.displayName;
        const authorByKey = new Map(
            data.map((item) => [authorKey(item), item])
        );
        const x = d3
            .scaleLinear()
            .domain([0, d3.max(data, (item) => item.posts) || 1])
            .nice()
            .range([margin.left, width - margin.right]);
        const y = d3
            .scaleBand()
            .domain(data.map(authorKey))
            .range([margin.top, height - margin.bottom])
            .padding(.28);

        svg.selectAll("rect")
            .data(data)
            .join("rect")
            .attr("x", margin.left)
            .attr("y", (item) => y(authorKey(item)))
            .attr("width", (item) => x(item.posts) - margin.left)
            .attr("height", y.bandwidth())
            .attr("rx", 5)
            .attr("fill", colors.primary)
            .attr("fill-opacity", (_, index) => 1 - index * .065)
            .on("mouseenter", (event, item) =>
                showTooltip(event, [
                    {
                        label: "Member",
                        value: item.displayName
                    },
                    {
                        label: "Username",
                        value: `@${item.username}`
                    },
                    {
                        label: "Posts",
                        value: formatNumber(item.posts)
                    },
                    {
                        label: "Media posts",
                        value: formatNumber(item.mediaPosts)
                    }
                ])
            )
            .on("mousemove", moveTooltip)
            .on("mouseleave", hideTooltip);

        svg.selectAll(".author-value")
            .data(data)
            .join("text")
            .attr("class", "author-value")
            .attr("x", (item) => x(item.posts) + 7)
            .attr(
                "y",
                (item) =>
                    y(authorKey(item)) + y.bandwidth() / 2 + 4
            )
            .attr("fill", colors.text)
            .attr("font-weight", 750)
            .text((item) => item.posts);

        svg.append("g")
            .attr("transform", `translate(${margin.left},0)`)
            .call(
                d3
                    .axisLeft(y)
                    .tickSize(0)
                    .tickFormat((key) => {
                        const value =
                            authorByKey.get(key)?.displayName || key;
                        return value.length > 18
                            ? `${value.slice(0, 17)}…`
                            : value;
                    })
            )
            .call((group) => group.select(".domain").remove());
    }

    function renderCityActivityChart() {
        const data = state.data.cities.slice(0, 9);

        if (!data.length) {
            setChartEmpty(
                elements.cities,
                "No city information is available."
            );
            return;
        }

        const { width, height, svg } = createSvg(
            elements.cities,
            370
        );
        const margin = {
            top: 35,
            right: 24,
            bottom: 85,
            left: 48
        };
        const keys = ["users", "posts", "groups"];
        const keyColors = {
            users: colors.primary,
            posts: colors.group,
            groups: colors.video
        };
        const x0 = d3
            .scaleBand()
            .domain(data.map((item) => item.city))
            .range([margin.left, width - margin.right])
            .padding(.22);
        const x1 = d3
            .scaleBand()
            .domain(keys)
            .range([0, x0.bandwidth()])
            .padding(.08);
        const maximum =
            d3.max(data, (item) =>
                d3.max(keys, (key) => item[key])
            ) || 1;
        const y = d3
            .scaleLinear()
            .domain([0, maximum])
            .nice()
            .range([height - margin.bottom, margin.top]);

        drawGrid(svg, y, width, margin);

        const cityGroups = svg
            .selectAll(".city-group")
            .data(data)
            .join("g")
            .attr("transform", (item) => `translate(${x0(item.city)},0)`);

        cityGroups
            .selectAll("rect")
            .data((item) =>
                keys.map((key) => ({
                    key,
                    value: item[key],
                    city: item.city
                }))
            )
            .join("rect")
            .attr("x", (item) => x1(item.key))
            .attr("y", (item) => y(item.value))
            .attr("width", x1.bandwidth())
            .attr(
                "height",
                (item) => y(0) - y(item.value)
            )
            .attr("rx", 3)
            .attr("fill", (item) => keyColors[item.key])
            .on("mouseenter", (event, item) =>
                showTooltip(event, [
                    {
                        label: "City",
                        value: item.city
                    },
                    {
                        label:
                            item.key.charAt(0).toUpperCase() +
                            item.key.slice(1),
                        value: formatNumber(item.value)
                    }
                ])
            )
            .on("mousemove", moveTooltip)
            .on("mouseleave", hideTooltip);

        svg.append("g")
            .attr(
                "transform",
                `translate(0,${height - margin.bottom})`
            )
            .call(d3.axisBottom(x0).tickSize(0))
            .call((group) => group.select(".domain").attr("stroke", colors.border))
            .selectAll("text")
            .attr("transform", "rotate(-32)")
            .attr("text-anchor", "end")
            .attr("dx", "-.45em")
            .attr("dy", ".35em");

        svg.append("g")
            .attr("transform", `translate(${margin.left},0)`)
            .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format("d")))
            .call((group) => group.select(".domain").remove());

        const legend = svg
            .append("g")
            .attr("transform", `translate(${margin.left},12)`);

        const legendRows = legend
            .selectAll("g")
            .data(keys)
            .join("g")
            .attr(
                "transform",
                (_, index) => `translate(${index * 90},0)`
            );

        legendRows
            .append("rect")
            .attr("width", 11)
            .attr("height", 11)
            .attr("rx", 2)
            .attr("fill", (key) => keyColors[key]);

        legendRows
            .append("text")
            .attr("x", 17)
            .attr("y", 9)
            .text(
                (key) =>
                    key.charAt(0).toUpperCase() + key.slice(1)
            );
    }

    function renderPostingHoursChart() {
        const data = state.data.postingHours;
        const total = d3.sum(data, (item) => item.count);

        if (!total) {
            setChartEmpty(
                elements.hours,
                "No posting-hour data is available."
            );
            return;
        }

        const { width, height, svg } = createSvg(
            elements.hours,
            300
        );
        const margin = {
            top: 28,
            right: 18,
            bottom: 45,
            left: 42
        };
        const x = d3
            .scaleBand()
            .domain(data.map((item) => item.hour))
            .range([margin.left, width - margin.right])
            .padding(.18);
        const y = d3
            .scaleLinear()
            .domain([0, d3.max(data, (item) => item.count) || 1])
            .nice()
            .range([height - margin.bottom, margin.top]);
        const color = d3
            .scaleLinear()
            .domain([0, d3.max(data, (item) => item.count) || 1])
            .range(["#dbeafe", colors.primary]);

        drawGrid(svg, y, width, margin, 4);

        svg.selectAll("rect")
            .data(data)
            .join("rect")
            .attr("x", (item) => x(item.hour))
            .attr("y", (item) => y(item.count))
            .attr("width", x.bandwidth())
            .attr(
                "height",
                (item) => y(0) - y(item.count)
            )
            .attr("rx", 3)
            .attr("fill", (item) => color(item.count))
            .on("mouseenter", (event, item) =>
                showTooltip(event, [
                    {
                        label: "Time",
                        value: `${String(item.hour).padStart(
                            2,
                            "0"
                        )}:00–${String((item.hour + 1) % 24).padStart(
                            2,
                            "0"
                        )}:00`
                    },
                    {
                        label: "Posts",
                        value: formatNumber(item.count)
                    }
                ])
            )
            .on("mousemove", moveTooltip)
            .on("mouseleave", hideTooltip);

        svg.append("g")
            .attr(
                "transform",
                `translate(0,${height - margin.bottom})`
            )
            .call(
                d3
                    .axisBottom(x)
                    .tickValues([0, 3, 6, 9, 12, 15, 18, 21])
                    .tickFormat((hour) =>
                        `${String(hour).padStart(2, "0")}:00`
                    )
            )
            .call((group) => group.select(".domain").attr("stroke", colors.border));

        svg.append("g")
            .attr("transform", `translate(${margin.left},0)`)
            .call(d3.axisLeft(y).ticks(4).tickFormat(d3.format("d")))
            .call((group) => group.select(".domain").remove());
    }

    function renderGroupMapChart() {
        const data = state.data.groupLocations;

        if (!data.length) {
            setChartEmpty(
                elements.map,
                "No group coordinates are available."
            );
            return;
        }

        if (!state.worldLoaded) {
            setChartLoading(elements.map);
            return;
        }

        const { width, height, svg } = createSvg(
            elements.map,
            300
        );
        const longitudes = data.map((item) => item.longitude);
        const latitudes = data.map((item) => item.latitude);
        const longitudeExtent = d3.extent(longitudes);
        const latitudeExtent = d3.extent(latitudes);
        const longitudePadding = Math.max(
            (longitudeExtent[1] - longitudeExtent[0]) * .35,
            .6
        );
        const latitudePadding = Math.max(
            (latitudeExtent[1] - latitudeExtent[0]) * .35,
            .45
        );
        const region = {
            type: "Polygon",
            coordinates: [
                [
                    [
                        longitudeExtent[0] - longitudePadding,
                        latitudeExtent[0] - latitudePadding
                    ],
                    [
                        longitudeExtent[1] + longitudePadding,
                        latitudeExtent[0] - latitudePadding
                    ],
                    [
                        longitudeExtent[1] + longitudePadding,
                        latitudeExtent[1] + latitudePadding
                    ],
                    [
                        longitudeExtent[0] - longitudePadding,
                        latitudeExtent[1] + latitudePadding
                    ],
                    [
                        longitudeExtent[0] - longitudePadding,
                        latitudeExtent[0] - latitudePadding
                    ]
                ]
            ]
        };
        const projection = d3
            .geoMercator()
            .fitExtent(
                [
                    [16, 16],
                    [width - 16, height - 16]
                ],
                region
            );
        const path = d3.geoPath(projection);
        const clipId = `analytics-map-${Math.random()
            .toString(36)
            .slice(2)}`;

        svg.append("defs")
            .append("clipPath")
            .attr("id", clipId)
            .append("rect")
            .attr("width", width)
            .attr("height", height)
            .attr("rx", 10);

        const mapGroup = svg
            .append("g")
            .attr("clip-path", `url(#${clipId})`);

        mapGroup
            .append("rect")
            .attr("width", width)
            .attr("height", height)
            .attr("fill", "#eff6ff");

        if (state.world) {
            mapGroup
                .selectAll("path")
                .data(state.world.features)
                .join("path")
                .attr("d", path)
                .attr("fill", "#f8fafc")
                .attr("stroke", "#cbd5e1")
                .attr("stroke-width", .7);
        }

        const radius = d3
            .scaleSqrt()
            .domain([
                0,
                d3.max(data, (item) => item.memberCount) || 1
            ])
            .range([5, 14]);

        mapGroup
            .selectAll("circle")
            .data(data)
            .join("circle")
            .attr(
                "cx",
                (item) =>
                    projection([
                        item.longitude,
                        item.latitude
                    ])[0]
            )
            .attr(
                "cy",
                (item) =>
                    projection([
                        item.longitude,
                        item.latitude
                    ])[1]
            )
            .attr("r", (item) => radius(item.memberCount))
            .attr("fill", colors.primary)
            .attr("fill-opacity", .72)
            .attr("stroke", "#fff")
            .attr("stroke-width", 2)
            .on("mouseenter", (event, item) =>
                showTooltip(event, [
                    {
                        label: "Group",
                        value: item.name
                    },
                    {
                        label: "Location",
                        value:
                            item.city ||
                            `${item.latitude.toFixed(
                                3
                            )}, ${item.longitude.toFixed(3)}`
                    },
                    {
                        label: "Category",
                        value: item.category
                    },
                    {
                        label: "Members",
                        value: formatNumber(item.memberCount)
                    }
                ])
            )
            .on("mousemove", moveTooltip)
            .on("mouseleave", hideTooltip);

        svg.append("text")
            .attr("x", 12)
            .attr("y", height - 10)
            .text("Circle size represents group membership");
    }

    function weatherDescription(code) {
        if (code === 0) {
            return "Clear";
        }

        if ([1, 2].includes(code)) {
            return "Mostly clear";
        }

        if (code === 3) {
            return "Cloudy";
        }

        if ([45, 48].includes(code)) {
            return "Fog";
        }

        if ([51, 53, 55, 56, 57].includes(code)) {
            return "Drizzle";
        }

        if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
            return "Rain";
        }

        if ([71, 73, 75, 77, 85, 86].includes(code)) {
            return "Snow";
        }

        if ([95, 96, 99].includes(code)) {
            return "Thunderstorm";
        }

        return "Variable";
    }

    function renderCurrentWeather() {
        const current = state.weather.current;
        const location = state.weather.location;

        elements.weatherLabel.textContent = [
            location.name,
            location.admin1,
            location.country
        ]
            .filter(Boolean)
            .join(", ");
        elements.weatherTemperature.textContent =
            current.temperature == null
                ? "—"
                : `${Math.round(current.temperature)}°C`;
        elements.weatherCondition.textContent =
            current.weatherCode == null
                ? "—"
                : weatherDescription(current.weatherCode);
        elements.weatherFeels.textContent =
            current.apparentTemperature == null
                ? "—"
                : `${Math.round(current.apparentTemperature)}°C`;
        elements.weatherWind.textContent =
            current.windSpeed == null
                ? "—"
                : `${Math.round(current.windSpeed)} km/h`;
    }

    function renderWeatherChart() {
        const data = state.weather?.daily || [];

        if (!data.length) {
            setChartEmpty(
                elements.weatherChart,
                "No weather forecast is available."
            );
            return;
        }

        const { width, height, svg } = createSvg(
            elements.weatherChart,
            370
        );
        const margin = {
            top: 35,
            right: 52,
            bottom: 52,
            left: 50
        };
        const x = d3
            .scalePoint()
            .domain(data.map((item) => item.date))
            .range([margin.left, width - margin.right])
            .padding(.45);
        const temperatures = data.flatMap((item) => [
            item.temperatureMin,
            item.temperatureMax
        ]);
        const temperatureExtent = d3.extent(
            temperatures.filter((value) => value != null)
        );
        const yTemperature = d3
            .scaleLinear()
            .domain([
                Math.floor((temperatureExtent[0] || 0) - 2),
                Math.ceil((temperatureExtent[1] || 1) + 2)
            ])
            .nice()
            .range([height - margin.bottom, margin.top]);
        const yRain = d3
            .scaleLinear()
            .domain([0, 100])
            .range([height - margin.bottom, margin.top]);
        const spacing =
            data.length > 1
                ? x(data[1].date) - x(data[0].date)
                : width - margin.left - margin.right;
        const barWidth = Math.min(30, spacing * .48);

        drawGrid(
            svg,
            yTemperature,
            width,
            margin,
            5
        );

        svg.selectAll(".weather-rain-bar")
            .data(data)
            .join("rect")
            .attr("class", "weather-rain-bar")
            .attr(
                "x",
                (item) => x(item.date) - barWidth / 2
            )
            .attr(
                "y",
                (item) =>
                    yRain(item.precipitationProbability || 0)
            )
            .attr("width", barWidth)
            .attr(
                "height",
                (item) =>
                    yRain(0) -
                    yRain(item.precipitationProbability || 0)
            )
            .attr("rx", 4)
            .attr("fill", colors.rain)
            .attr("fill-opacity", .22);

        const line = (field) =>
            d3
                .line()
                .defined((item) => item[field] != null)
                .x((item) => x(item.date))
                .y((item) => yTemperature(item[field]))
                .curve(d3.curveMonotoneX);

        svg.append("path")
            .datum(data)
            .attr("fill", "none")
            .attr("stroke", colors.weatherHigh)
            .attr("stroke-width", 3)
            .attr("d", line("temperatureMax"));

        svg.append("path")
            .datum(data)
            .attr("fill", "none")
            .attr("stroke", colors.weatherLow)
            .attr("stroke-width", 3)
            .attr("d", line("temperatureMin"));

        for (const field of [
            "temperatureMax",
            "temperatureMin"
        ]) {
            svg.selectAll(`.${field}`)
                .data(data.filter((item) => item[field] != null))
                .join("circle")
                .attr("class", field)
                .attr("cx", (item) => x(item.date))
                .attr(
                    "cy",
                    (item) => yTemperature(item[field])
                )
                .attr("r", 4)
                .attr(
                    "fill",
                    field === "temperatureMax"
                        ? colors.weatherHigh
                        : colors.weatherLow
                )
                .attr("stroke", colors.surface)
                .attr("stroke-width", 2)
                .on("mouseenter", (event, item) =>
                    showTooltip(event, [
                        {
                            label: "Date",
                            value: formatDate(item.date, {
                                weekday: "short"
                            })
                        },
                        {
                            label: "Conditions",
                            value: weatherDescription(
                                item.weatherCode
                            )
                        },
                        {
                            label: "High",
                            value: `${Math.round(
                                item.temperatureMax
                            )}°C`
                        },
                        {
                            label: "Low",
                            value: `${Math.round(
                                item.temperatureMin
                            )}°C`
                        },
                        {
                            label: "Rain chance",
                            value: `${
                                item.precipitationProbability || 0
                            }%`
                        },
                        {
                            label: "Max wind",
                            value:
                                item.windSpeedMax == null
                                    ? "—"
                                    : `${Math.round(
                                          item.windSpeedMax
                                      )} km/h`
                        }
                    ])
                )
                .on("mousemove", moveTooltip)
                .on("mouseleave", hideTooltip);
        }

        svg.append("g")
            .attr(
                "transform",
                `translate(0,${height - margin.bottom})`
            )
            .call(
                d3
                    .axisBottom(x)
                    .tickFormat((date) =>
                        formatDate(date, {
                            weekday: "short"
                        })
                    )
            )
            .call((group) => group.select(".domain").attr("stroke", colors.border));

        svg.append("g")
            .attr("transform", `translate(${margin.left},0)`)
            .call(
                d3
                    .axisLeft(yTemperature)
                    .ticks(5)
                    .tickFormat((value) => `${value}°`)
            )
            .call((group) => group.select(".domain").remove());

        svg.append("g")
            .attr(
                "transform",
                `translate(${width - margin.right},0)`
            )
            .call(
                d3
                    .axisRight(yRain)
                    .tickValues([0, 50, 100])
                    .tickFormat((value) => `${value}%`)
            )
            .call((group) => group.select(".domain").remove());

        const legend = svg
            .append("g")
            .attr("transform", `translate(${margin.left},12)`);

        const legendData = [
            {
                label: "High",
                color: colors.weatherHigh,
                x: 0
            },
            {
                label: "Low",
                color: colors.weatherLow,
                x: 76
            },
            {
                label: "Rain",
                color: colors.rain,
                x: 146
            }
        ];

        const rows = legend
            .selectAll("g")
            .data(legendData)
            .join("g")
            .attr(
                "transform",
                (item) => `translate(${item.x},0)`
            );

        rows
            .append("rect")
            .attr("width", 14)
            .attr("height", 8)
            .attr("y", -5)
            .attr("rx", 2)
            .attr("fill", (item) => item.color);

        rows
            .append("text")
            .attr("x", 20)
            .attr("y", 3)
            .text((item) => item.label);
    }

    function populateCityOptions() {
        elements.cityOptions.replaceChildren();

        for (const item of state.data.cities) {
            const option = document.createElement("option");
            option.value = item.city;
            elements.cityOptions.append(option);
        }
    }

    function renderAllCharts() {
        if (!state.data) {
            return;
        }

        renderTrendChart();
        renderPostTypesChart();
        renderTopAuthorsChart();
        renderCityActivityChart();
        renderPostingHoursChart();
        renderGroupMapChart();

        if (state.weather) {
            renderWeatherChart();
        }
    }

    async function loadDashboard() {
        hideError(elements.error);
        elements.refresh.disabled = true;

        for (const element of [
            elements.trend,
            elements.types,
            elements.authors,
            elements.cities,
            elements.hours,
            elements.map
        ]) {
            setChartLoading(element);
        }

        try {
            state.data = await requestJson(
                `/api/analytics?days=${state.days}`
            );
            renderSummary();
            populateCityOptions();
            renderAllCharts();
        } catch (error) {
            showError(elements.error, error.message);
        } finally {
            elements.refresh.disabled = false;
        }
    }

    async function loadWorld() {
        try {
            const topology = await d3.json(
                "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json"
            );

            state.world =
                typeof topojson === "undefined"
                    ? null
                    : topojson.feature(
                          topology,
                          topology.objects.countries
                      );
        } catch {
            state.world = null;
        } finally {
            state.worldLoaded = true;

            if (state.data) {
                renderGroupMapChart();
            }
        }
    }

    async function loadWeather(city) {
        const normalizedCity = String(city || "").trim();

        if (!normalizedCity) {
            showError(elements.weatherError, "Enter a city.");
            return;
        }

        hideError(elements.weatherError);
        setChartLoading(elements.weatherChart);
        elements.weatherForm
            .querySelector("button")
            .setAttribute("disabled", "disabled");

        try {
            state.weather = await requestJson(
                `/api/analytics/weather?city=${encodeURIComponent(
                    normalizedCity
                )}`
            );
            renderCurrentWeather();
            renderWeatherChart();
        } catch (error) {
            state.weather = null;
            setChartEmpty(
                elements.weatherChart,
                "The forecast could not be displayed."
            );
            showError(elements.weatherError, error.message);
        } finally {
            elements.weatherForm
                .querySelector("button")
                .removeAttribute("disabled");
        }
    }

    elements.range.addEventListener("change", () => {
        state.days = Number(elements.range.value);
        loadDashboard();
    });

    elements.refresh.addEventListener("click", loadDashboard);

    elements.weatherForm.addEventListener("submit", (event) => {
        event.preventDefault();
        loadWeather(elements.weatherCity.value);
    });

    window.addEventListener("resize", () => {
        clearTimeout(state.resizeTimer);
        state.resizeTimer = setTimeout(renderAllCharts, 180);
    });

    if (typeof d3 === "undefined") {
        showError(
            elements.error,
            "D3 could not be loaded. Check the internet connection."
        );
        return;
    }

    loadDashboard();
    loadWorld();
    loadWeather(page.dataset.defaultCity);
});
