// Enlarged overall dimensions
const width = 1000;
const height = 1000;
const margin = 70;
const radius = Math.min(width, height) / 2 - margin;

// 1440 total minutes in a day
const totalMinutes = 1440;

// State variables for toggles and brush
let showEstrus = true;
let showNonEstrus = true;
let brushSelection = null;

/**
 * Update the visibility of estrus and non-estrus elements based on toggles.
 */
function updateVisibility() {
    d3.select(".estrus-line").style("opacity", showEstrus ? 1 : 0);
    d3.selectAll(".estrus-circle").style("opacity", showEstrus ? 0.7 : 0);
    d3.select(".non-estrus-line").style("opacity", showNonEstrus ? 1 : 0);
    d3.selectAll(".non-estrus-circle").style("opacity", showNonEstrus ? 0.7 : 0);
}

/**
 * Convert a minute-of-day into "HH:MM AM/PM"
 */
function minuteToTime(minuteOfDay) {
    const hh24 = Math.floor(minuteOfDay / 60);
    const mm = minuteOfDay % 60;
    const ampm = hh24 < 12 ? "AM" : "PM";
    let hh12 = hh24 % 12;
    if (hh12 === 0) hh12 = 12;
    const mmStr = String(mm).padStart(2, "0");
    return `${hh12}:${mmStr} ${ampm}`;
}

/**
 * Compute the angle in radians for a given index.
 * We assume data points are evenly spaced over a day (1440 minutes).
 * The top (0 minutes) corresponds to -π/2 radians.
 */
function getAngle(i) {
    return -Math.PI / 2 + (2 * Math.PI * i) / totalMinutes;
}

// Create a tooltip (hidden by default)
const tooltip = d3.select("body")
    .append("div")
    .attr("class", "tooltip");

// Create a persistent data table in the #selected-data container.
const dataTable = d3.select("#selected-data")
    .append("table");
dataTable.append("thead")
    .append("tr")
    .selectAll("th")
    .data(["Statistic", "Value"])
    .enter()
    .append("th")
    .text(d => d);
dataTable.append("tbody"); // We'll update the tbody later

/**
 * Update the data table with summary statistics.
 * This table is always visible.
 */
function updateDataTable(selectedPoints) {
    const tbody = dataTable.select("tbody");
    tbody.html(""); // Clear previous content

    if (!selectedPoints || selectedPoints.length === 0) {
        tbody.append("tr")
            .append("td")
            .attr("colspan", 2)
            .text("No data points selected");
        return;
    }

    // Compute summary statistics on the "activity" values.
    const count = selectedPoints.length;
    const activities = selectedPoints.map(d => d.activity);
    const minActivity = d3.min(activities);
    const maxActivity = d3.max(activities);
    const meanActivity = d3.mean(activities);
    const medianActivity = d3.median(activities);
    const stdDeviation = d3.deviation(activities);

    // Compute the time range using the stored index property.
    const minIndex = d3.min(selectedPoints, d => d.index);
    const maxIndex = d3.max(selectedPoints, d => d.index);
    const timeRange = minuteToTime(minIndex) + " - " + minuteToTime(maxIndex);

    const summary = [
        { label: "Count", value: count },
        { label: "Min Activity", value: minActivity.toFixed(2) },
        { label: "Max Activity", value: maxActivity.toFixed(2) },
        { label: "Mean Activity", value: meanActivity.toFixed(2) },
        { label: "Median Activity", value: medianActivity.toFixed(2) },
        { label: "Std. Deviation", value: stdDeviation ? stdDeviation.toFixed(2) : "N/A" },
        { label: "Time Range", value: timeRange }
    ];

    summary.forEach(d => {
        const row = tbody.append("tr");
        row.append("td").text(d.label);
        row.append("td").text(d.value);
    });
}

// --------------------------
// Load the JSON data and build the chart
// --------------------------
Promise.all([
    d3.json("lib/estrus_activity.json"),
    d3.json("lib/non_estrus_activity.json")
]).then(([estrusData, nonEstrusData]) => {

    // Add each point's index and assign its type.
    estrusData = estrusData.map((d, i) => ({ ...d, index: i, type: "Estrus" }));
    nonEstrusData = nonEstrusData.map((d, i) => ({ ...d, index: i, type: "Non-Estrus" }));

    // For the radial scale, compute the maximum activity over both datasets.
    const allActivities = estrusData.concat(nonEstrusData).map(d => d.activity);
    const maxActivity = d3.max(allActivities);

    // Create the main SVG container and centered group.
    const svg = d3.select("#radarChart")
        .attr("width", width)
        .attr("height", height)
        .append("g")
        .attr("transform", `translate(${width / 2}, ${height / 2})`);

    // Define radial scale for activity -> radius mapping.
    const rScale = d3.scaleLinear()
        .domain([0, maxActivity])
        .range([0, radius]);

    svg.append("path")
        .attr("class", "dark-period")
        .attr("d", d3.arc()
            .innerRadius(0)
            .outerRadius(radius)
            .startAngle(-2 * Math.PI)
            .endAngle(-Math.PI)
        );

    svg.append("path")
        .attr("class", "light-period")
        .attr("d", d3.arc()
            .innerRadius(0)
            .outerRadius(radius)
            .startAngle(2 * Math.PI)
            .endAngle(Math.PI)
        );

    // Draw radial grid circles with class "grid-circle" and disable pointer events.
    const numCircles = 5;
    for (let i = 1; i <= numCircles; i++) {
        const level = (i / numCircles) * maxActivity;
        svg.append("circle")
            .attr("class", "grid-circle")
            .attr("r", rScale(level))
            .attr("fill", "none")
            .attr("stroke", "#ccc")
            .attr("stroke-dasharray", "4 4")
            .style("pointer-events", "none");
    }

    // ---- TIME MARKERS ----
    const labelHours = [0, 4, 8, 12, 16, 20];
    labelHours.forEach(h => {
        const minuteOfDay = h * 60;
        const angle = -Math.PI / 2 + (2 * Math.PI * minuteOfDay) / 1440;
        const x = Math.cos(angle) * (radius + 25);
        const y = Math.sin(angle) * (radius + 25);
        const label = minuteToTime(minuteOfDay);
        svg.append("text")
            .attr("x", x)
            .attr("y", y)
            .attr("class", "axis-label")
            .attr("text-anchor", "middle")
            .text(label);
    });

    // ---- Polar to Cartesian Conversion ----
    // Compute the angle from the data point's index.
    function polarToCartesian(d, i) {
        const angle = getAngle(i);
        return {
            x: Math.cos(angle) * rScale(d.activity),
            y: Math.sin(angle) * rScale(d.activity)
        };
    }

    // ---- Build Lines ----
    const estrusPoints = estrusData.map((d, i) => polarToCartesian(d, i));
    const nonEstrusPoints = nonEstrusData.map((d, i) => polarToCartesian(d, i));

    svg.append("path")
        .datum(estrusPoints)
        .attr("class", "estrus-line")
        .attr("d", d3.line()
            .x(d => d.x)
            .y(d => d.y)
            .curve(d3.curveCardinal)
        );

    svg.append("path")
        .datum(nonEstrusPoints)
        .attr("class", "non-estrus-line")
        .attr("d", d3.line()
            .x(d => d.x)
            .y(d => d.y)
            .curve(d3.curveCardinal)
        );

    // ---- Draw Circles for Interaction ----
    const sampleRate = 10;
    const estrusSample = estrusData.filter((d, i) => i % sampleRate === 0);
    const nonEstrusSample = nonEstrusData.filter((d, i) => i % sampleRate === 0);

    svg.selectAll(".estrus-circle")
        .data(estrusSample)
        .enter()
        .append("circle")
        .attr("class", "estrus-circle")
        .attr("r", 3)
        .attr("cx", d => polarToCartesian(d, d.index).x)
        .attr("cy", d => polarToCartesian(d, d.index).y)
        .style("fill", "red")
        .style("cursor", "pointer");

    svg.selectAll(".non-estrus-circle")
        .data(nonEstrusSample)
        .enter()
        .append("circle")
        .attr("class", "non-estrus-circle")
        .attr("r", 3)
        .attr("cx", d => polarToCartesian(d, d.index).x)
        .attr("cy", d => polarToCartesian(d, d.index).y)
        .style("fill", "blue")
        .style("cursor", "pointer");

    // ---- VERTICAL ENERGY-LEVEL SCALE (Axis with Labels) ----
    // Draw a vertical line from center to the edge.
    svg.append("line")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", 0)
        .attr("y2", radius)
        .attr("stroke", "black")
        .attr("stroke-width", 1);

    // Draw tick marks and labels along this vertical axis.
    const tickCount = 5;
    for (let i = 0; i <= tickCount; i++) {
        const level = (i / tickCount) * maxActivity;
        const yPos = rScale(level);
        // Draw a tick line
        svg.append("line")
            .attr("x1", -5)
            .attr("x2", 0)
            .attr("y1", yPos)
            .attr("y2", yPos)
            .attr("stroke", "black");
        // Add text label
        svg.append("text")
            .attr("x", -10)
            .attr("y", yPos + 4)
            .attr("text-anchor", "end")
            .attr("font-size", 12)
            .text(level.toFixed(0));
    }
    // Label for the vertical axis.
    svg.append("text")
        .attr("x", 0)
        .attr("y", radius + 35)
        .attr("text-anchor", "middle")
        .attr("font-size", 14)
    // .text("Activity Level");

    // ---- LEGEND (Example) ----
    const legendData = [
        { label: "Estrus", color: "red" },
        { label: "Non-Estrus", color: "blue" },
        { label: "Dark Period", color: "rgba(169, 169, 169, 0.3)" },
        { label: "Light Period", color: "rgba(255, 213, 37, 0.3)" }
    ];

    const legend = d3.select("#radarChart")
        .append("svg")
        .attr("width", 200)
        .attr("height", 100)
        .append("g")
        .attr("transform", "translate(20,20)");

    legend.selectAll("rect")
        .data(legendData)
        .enter()
        .append("rect")
        .attr("x", 0)
        .attr("y", (d, i) => i * 20)
        .attr("width", 12)
        .attr("height", 12)
        .attr("fill", d => d.color);

    legend.selectAll("text")
        .data(legendData)
        .enter()
        .append("text")
        .attr("x", 20)
        .attr("y", (d, i) => i * 20 + 10)
        .text(d => d.label)
        .attr("font-size", "14px")
        .attr("fill", "black");

    // ---- BRUSH SETUP ----
    const brushContainer = svg.append("g")
        .attr("class", "brush");

    function brushed(event) {
        brushSelection = event.selection;
        if (!brushSelection) {
            updateDataTable([]);
            return;
        }
        const [[x0, y0], [x1, y1]] = brushSelection;
        const selectedPoints = [];
        // Only consider data circles.
        svg.selectAll(".estrus-circle, .non-estrus-circle").each(function (d) {
            const circle = d3.select(this);
            const cx = +circle.attr("cx");
            const cy = +circle.attr("cy");
            const isSelected = (cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1);
            circle.classed("selected", isSelected);
            if (isSelected) {
                selectedPoints.push(d);
            }
        });
        updateDataTable(selectedPoints);
    }

    const brush = d3.brush()
        .extent([[-width / 2, -height / 2], [width / 2, height / 2]])
        .on("brush end", brushed);

    brushContainer.call(brush);
    svg.selectAll("circle").raise();

    // ---- TOOLTIP INTERACTIONS ----
    svg.selectAll(".estrus-circle, .non-estrus-circle")
        .style("pointer-events", "all")
        .on("mouseover", function (event, d) {
            d3.select(this)
                .transition()
                .duration(200)
                .attr("r", 6);
            showTooltip(event, d);
        })
        .on("mouseout", function () {
            d3.select(this)
                .transition()
                .duration(200)
                .attr("r", 3);
            tooltip.transition()
                .duration(200)
                .style("opacity", 0);
        });

    // ---- TOGGLE BUTTON HANDLERS ----
    d3.select("#toggle-estrus")
        .on("click", function () {
            showEstrus = !showEstrus;
            d3.select(this).classed("active", showEstrus);
            updateVisibility();
        });

    d3.select("#toggle-non-estrus")
        .on("click", function () {
            showNonEstrus = !showNonEstrus;
            d3.select(this).classed("active", showNonEstrus);
            updateVisibility();
        });

    d3.select("#toggle-estrus").classed("active", true);
    d3.select("#toggle-non-estrus").classed("active", true);
    updateVisibility();

}).catch(error => {
    console.error("Error loading the data: ", error);
});

/**
 * Helper function for showing a tooltip.
 */
function showTooltip(event, d) {
    const timeStr = minuteToTime(d.index);
    tooltip.html(`
    <strong>Type:</strong> ${d.type}<br/>
    <strong>Time:</strong> ${timeStr}<br/>
    <strong>Activity:</strong> ${d.activity.toFixed(2)}
  `)
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 28) + "px")
        .style("opacity", 0.9);
}
