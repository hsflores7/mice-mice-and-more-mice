// Set dimensions
const width = 700, height = 700, margin = 50;
const radius = (Math.min(width, height) / 2) - margin;

// Define time labels
const timeLabels = ["Midnight", "4 AM", "8 AM", "Noon", "4 PM", "8 PM"];
const angles = d3.range(0, 2 * Math.PI, (2 * Math.PI) / 1440);

// Load actual JSON data from "root/lib/"
Promise.all([
    d3.json("lib/estrus_activity.json"),
    d3.json("lib/non_estrus_activity.json")
]).then(([estrusData, nonEstrusData]) => {
    
    // Extract activity values
    const estrusActivity = estrusData.map(d => d.activity);
    const nonEstrusActivity = nonEstrusData.map(d => d.activity);

    // Find max activity for scaling
    const maxActivity = d3.max([...estrusActivity, ...nonEstrusActivity]);

    // Create SVG
    const svg = d3.select("#radarChart")
        .attr("width", width)
        .attr("height", height)
        .append("g")
        .attr("transform", `translate(${width / 2}, ${height / 2})`);

    // Define radial scale
    const rScale = d3.scaleLinear()
        .domain([0, maxActivity])
        .range([0, radius]);

    // Define angle scale
    const angleScale = d3.scaleLinear()
        .domain([0, 2 * Math.PI])
        .range([0, 360]);

    // Create light and dark period shading
    svg.append("path")
        .attr("d", d3.arc()
            .innerRadius(0)
            .outerRadius(radius)
            .startAngle(0)  // Dark period starts at 0 degrees
            .endAngle(Math.PI)  // Ends at 180 degrees
        )
        .attr("class", "dark-period");

    svg.append("path")
        .attr("d", d3.arc()
            .innerRadius(0)
            .outerRadius(radius)
            .startAngle(Math.PI)  // Light period starts at 180 degrees
            .endAngle(2 * Math.PI)  // Ends at 360 degrees
        )
        .attr("class", "light-period");

    // Draw radial grid lines
    const numCircles = 5;
    for (let i = 1; i <= numCircles; i++) {
        let level = (i / numCircles) * maxActivity;
        svg.append("circle")
            .attr("r", rScale(level))
            .attr("fill", "none")
            .attr("stroke", "#ccc")
            .attr("stroke-dasharray", "4 4");
    }

    // Draw axis labels
    timeLabels.forEach((label, i) => {
        let angle = (i / 6) * 2 * Math.PI - Math.PI / 2; // Adjust for rotation
        let x = Math.cos(angle) * (radius + 20);
        let y = Math.sin(angle) * (radius + 20);

        svg.append("text")
            .attr("x", x)
            .attr("y", y)
            .attr("class", "axis-label")
            .attr("text-anchor", "middle")
            .text(label);
    });

    // Function to convert polar data to cartesian coordinates
    function polarToCartesian(angle, value) {
        return {
            x: Math.cos(angle) * rScale(value),
            y: Math.sin(angle) * rScale(value)
        };
    }

    // Create line function
    const line = d3.line()
        .x(d => d.x)
        .y(d => d.y)
        .curve(d3.curveCardinal);

    // Convert polar data to cartesian for estrus
    const estrusPath = estrusActivity.map((d, i) => polarToCartesian(angles[i], d));
    svg.append("path")
        .datum(estrusPath)
        .attr("d", line)
        .attr("class", "estrus-line");

    // Convert polar data to cartesian for non-estrus
    const nonEstrusPath = nonEstrusActivity.map((d, i) => polarToCartesian(angles[i], d));
    svg.append("path")
        .datum(nonEstrusPath)
        .attr("d", line)
        .attr("class", "non-estrus-line");

    // Add legend
    const legend = svg.append("g").attr("transform", `translate(-${width / 2.5}, ${height / 3})`);
    const legendData = [
        { label: "Estrus", color: "red" },
        { label: "Non-Estrus", color: "blue" },
        { label: "Light Period", color: "rgba(255, 213, 37, 0.5)" },
        { label: "Dark Period", color: "rgba(169, 169, 169, 0.5)" }
    ];
    
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
        .attr("font-size", "12px")
        .attr("fill", "black");

});
