// Enlarged overall dimensions
const width = 1000;
const height = 1000;
const margin = 70;
const radius = Math.min(width, height) / 2 - margin;

// 1440 total minutes in a day
const totalMinutes = 1440;

// Add state variables for visibility toggles
let showEstrus = true;
let showNonEstrus = true;
let brushSelection = null;

// Update visibility function
function updateVisibility() {
  d3.select(".estrus-line").style("opacity", showEstrus ? 1 : 0);
  d3.selectAll(".estrus-circle").style("opacity", showEstrus ? 0.7 : 0);
  
  d3.select(".non-estrus-line").style("opacity", showNonEstrus ? 1 : 0);
  d3.selectAll(".non-estrus-circle").style("opacity", showNonEstrus ? 0.7 : 0);
}

// Initialize toggle buttons
document.addEventListener('DOMContentLoaded', () => {
  const estrusBtn = document.getElementById('toggle-estrus');
  const nonEstrusBtn = document.getElementById('toggle-non-estrus');
  
  estrusBtn.classList.add('active');
  nonEstrusBtn.classList.add('active');
  
  estrusBtn.addEventListener('click', () => {
    showEstrus = !showEstrus;
    estrusBtn.classList.toggle('active');
    updateVisibility();
  });
  
  nonEstrusBtn.addEventListener('click', () => {
    showNonEstrus = !showNonEstrus;
    nonEstrusBtn.classList.toggle('active');
    updateVisibility();
  });
});

/**
 * Convert a minute-of-day into "HH:MM AM/PM"
 */
function minuteToTime(minuteOfDay) {
  const hh24 = Math.floor(minuteOfDay / 60);
  const mm = minuteOfDay % 60;
  const ampm = hh24 < 12 ? "AM" : "PM";
  let hh12 = hh24 % 12;
  if (hh12 === 0) hh12 = 12; // Convert 0 or 12 -> 12
  const mmStr = String(mm).padStart(2, "0");
  return `${hh12}:${mmStr} ${ampm}`;
}

/**
 * We define an angle so that:
 *  - minute 0 => angle = -π/2 (TOP)
 *  - minute 720 => angle = π/2 (BOTTOM)
 */
function getAngle(minuteIndex) {
  return -Math.PI + (2 * Math.PI * minuteIndex) / totalMinutes;
}

// Create a tooltip (hidden by default)
const tooltip = d3.select("body")
  .append("div")
  .attr("class", "tooltip");

// Load the actual JSON data
Promise.all([
  d3.json("lib/estrus_activity.json"),
  d3.json("lib/non_estrus_activity.json")
]).then(([estrusData, nonEstrusData]) => {

  // Extract activity from the loaded data
  const estrusActivity = estrusData.map(d => d.activity);
  const nonEstrusActivity = nonEstrusData.map(d => d.activity);

  // Determine max for radial scale
  const maxActivity = d3.max([...estrusActivity, ...nonEstrusActivity]);

  // Create the main SVG container
  const svg = d3.select("#radarChart")
    .attr("width", width)
    .attr("height", height)
    .append("g")
    // Move to the center
    .attr("transform", `translate(${width / 2}, ${height / 2})`);


  // Define radial scale: activity -> radius
  const rScale = d3.scaleLinear()
    .domain([0, maxActivity])
    .range([0, radius]);

  // ---- DARK PERIOD ARC (TOP HALF) ----
  //  minute 0..720 => angles from -π/2.. π/2
  svg.append("path")
    .attr("class", "dark-period")
    .attr("d", d3.arc()
      .innerRadius(0)
      .outerRadius(radius)
      .startAngle(-Math.PI / 2)  // top
      .endAngle(Math.PI / 2)     // bottom
    );

  // ---- LIGHT PERIOD ARC (BOTTOM HALF) ----
  //  minute 720..1440 => angles from π/2.. 3π/2
  svg.append("path")
    .attr("class", "light-period")
    .attr("d", d3.arc()
      .innerRadius(0)
      .outerRadius(radius)
      .startAngle(Math.PI / 2)
      .endAngle((3 * Math.PI) / 2)
    );

  // Draw radial grid lines (for visual reference)
  const numCircles = 5;
  for (let i = 1; i <= numCircles; i++) {
    const level = (i / numCircles) * maxActivity;
    svg.append("circle")
      .attr("r", rScale(level))
      .attr("fill", "none")
      .attr("stroke", "#ccc")
      .attr("stroke-dasharray", "4 4");
  }

  /**
   * Time markers:
   * We'll place 6 markers: 0, 4, 8, 12, 16, 20 hours
   * => minutes: 0, 240, 480, 720, 960, 1200
   */
  const labelHours = [0, 4, 8, 12, 16, 20];
  labelHours.forEach(h => {
    const minuteOfDay = h * 60;
    const angle = getAngle(minuteOfDay); // angle in radians
    const x = Math.cos(angle) * (radius + 25);
    const y = Math.sin(angle) * (radius + 25);

    // Convert to label string (e.g. "12:00 AM", "4:00 AM", etc.)
    const label = minuteToTime(minuteOfDay);

    svg.append("text")
      .attr("x", x)
      .attr("y", y)
      .attr("class", "axis-label")
      .attr("text-anchor", "middle")
      .text(label);
  });

  // Convert polar to Cartesian
  function polarToCartesian(minIndex, activityVal) {
    const a = getAngle(minIndex); // angle in radians
    return {
      x: Math.cos(a) * rScale(activityVal),
      y: Math.sin(a) * rScale(activityVal)
    };
  }

  // D3 line generator
  const lineGen = d3.line()
    .x(d => d.x)
    .y(d => d.y)
    .curve(d3.curveCardinal);

  // Build arrays of (x, y) for estrus / non-estrus lines
  const estrusPoints = estrusActivity.map((val, i) => polarToCartesian(i, val));
  const nonEstrusPoints = nonEstrusActivity.map((val, i) => polarToCartesian(i, val));

  // Draw estrus line
  svg.append("path")
    .datum(estrusPoints)
    .attr("class", "estrus-line")
    .attr("d", lineGen);

  // Draw non-estrus line
  svg.append("path")
    .datum(nonEstrusPoints)
    .attr("class", "non-estrus-line")
    .attr("d", lineGen);

  // For interactive tooltips, sample every 10th data point
  const sampleRate = 10;
  const estrusSample = estrusActivity
    .map((activity, i) => ({ activity, i, type: "Estrus" }))
    .filter(d => d.i % sampleRate === 0);

  const nonEstrusSample = nonEstrusActivity
    .map((activity, i) => ({ activity, i, type: "Non-Estrus" }))
    .filter(d => d.i % sampleRate === 0);

  // Helper function for tooltip positioning and content
function showTooltip(event, d) {
    const timeStr = minuteToTime(d.i);
    tooltip.html(`
      <strong>Type:</strong> ${d.type}<br/>
      <strong>Time:</strong> ${timeStr}<br/>
      <strong>Activity:</strong> ${d.activity.toFixed(2)}
    `)
      .style("left", (event.pageX + 10) + "px")
      .style("top", (event.pageY - 28) + "px")
      .style("opacity", 0.9);
  }
  
  // Modify the circle creation for estrus
  svg.selectAll(".estrus-circle")
    .data(estrusSample)
    .enter()
    .append("circle")
    .attr("class", "estrus-circle")
    .attr("r", 3)
    .attr("cx", d => polarToCartesian(d.i, d.activity).x)
    .attr("cy", d => polarToCartesian(d.i, d.activity).y)
    .style("fill", "red")
    .style("cursor", "pointer")
    .style("pointer-events", "all") // Ensure circles capture events
    ;
  
  // Modify the circle creation for non-estrus
  svg.selectAll(".non-estrus-circle")
    .data(nonEstrusSample)
    .enter()
    .append("circle")
    .attr("class", "non-estrus-circle")
    .attr("r", 3)
    .attr("cx", d => polarToCartesian(d.i, d.activity).x)
    .attr("cy", d => polarToCartesian(d.i, d.activity).y)
    .style("fill", "blue")
    .style("cursor", "pointer")
    .style("pointer-events", "all") // Ensure circles capture events
    ;
  // ---- ADD A VERTICAL ENERGY-LEVEL SCALE ----
  //  from center (0,0) down to (0, radius).
  //  We'll add ticks and a label "Energy (units)" at the bottom.

  // Draw the axis line from center to bottom
  svg.append("line")
    .attr("x1", 0)
    .attr("y1", 0)
    .attr("x2", 0)
    .attr("y2", radius)
    .attr("stroke", "black")
    .attr("stroke-width", 1);

  // Ticks for the radial axis (0..maxActivity)
  const tickCount = 5;
  for (let i = 0; i <= tickCount; i++) {
    const level = (i / tickCount) * maxActivity; // activity
    const yPos = rScale(level); // pixel distance from center

    // small horizontal tick
    svg.append("line")
      .attr("x1", -5)
      .attr("x2", 0)
      .attr("y1", yPos)
      .attr("y2", yPos)
      .attr("stroke", "black");

    // text label for the tick
    svg.append("text")
      .attr("x", -10)
      .attr("y", yPos + 4)
      .attr("text-anchor", "end")
      .attr("font-size", 12)
      .text(level.toFixed(0));
  }

  // Label for the radial axis at the bottom
  svg.append("text")
    .attr("x", 0)
    .attr("y", radius + 35)
    .attr("text-anchor", "middle")
    .attr("font-size", 14)
    .text("Energy Level");

  // ---- LEGEND (top-left corner) ----
  const legendData = [
    { label: "Estrus", color: "red" },
    { label: "Non-Estrus", color: "blue" },
    { label: "Dark Period", color: "rgba(169, 169, 169, 0.3)" },
    { label: "Light Period", color: "rgba(255, 213, 37, 0.3)" }
  ];

  const legend = d3.select("#radarChart")
    .append("g")
    .attr("transform", "translate(20, 20)");

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

// Add brush container (move to after all visualization elements)
const brushContainer = svg.append("g")
    .attr("class", "brush");

function brushed(event) {
    brushSelection = event.selection;
    if (!brushSelection) {
        // Clear selection
        svg.selectAll("circle").classed("selected", false);
        updateDataTable([]);
        return;
    }
        
    // Transform brush coordinates to our coordinate system
    const [[x0, y0], [x1, y1]] = brushSelection;
        
    // Select points within brush
    const selectedPoints = [];
    svg.selectAll("circle").each(function(d) {
        const circle = d3.select(this);
        const cx = +circle.attr("cx");
        const cy = +circle.attr("cy");
            
        const selected = cx >= (x0 - width/2) && cx <= (x1 - width/2) && 
                cy >= (y0 - height/2) && cy <= (y1 - height/2);
        circle.classed("selected", selected);
            
        if (selected) {
            selectedPoints.push({
                Time: minuteToTime(d.i),
                Type: d.type,
                Activity: d.activity.toFixed(2)
            });
        }
    });
    
        updateDataTable(selectedPoints);
    }
    function updateDataTable(selectedPoints) {
        const container = d3.select("#selected-data");
        container.html(""); // Clear previous content
    
        if (!selectedPoints || selectedPoints.length === 0) {
            container.append("p")
                .text("No data points selected");
            return;
        }
    
        const table = container.append("table");
        
        // Add headers
        const headers = Object.keys(selectedPoints[0]);
        table.append("thead")
            .append("tr")
            .selectAll("th")
            .data(headers)
            .enter()
            .append("th")
            .text(d => d);
    
        // Add rows
        const rows = table.append("tbody")
            .selectAll("tr")
            .data(selectedPoints)
            .enter()
            .append("tr");
    
        // Add cells
        rows.selectAll("td")
            .data(d => Object.values(d))
            .enter()
            .append("td")
            .text(d => d);
    }
// Create brush with pointer events handling
const brush = d3.brush()
    .extent([[-width/2, -height/2], [width/2, height/2]])
    .on("start brush end", brushed);

brushContainer.call(brush);

// Make sure overlay doesn't block tooltips
brushContainer.select(".overlay")
    .style("pointer-events", "painted");

// Modify circle interactions to work with both brush and tooltips
svg.selectAll("circle")
    .style("pointer-events", "all")
    .on("mouseover", function(event, d) {
        if (!event.target.classList.contains("brush")) {
            d3.select(this)
                .transition()
                .duration(200)
                .attr("r", 6);
            showTooltip(event, d);
        }
    })
    .on("mouseout", function() {
        d3.select(this)
            .transition()
            .duration(200)
            .attr("r", 3);
        tooltip.transition()
            .duration(200)
            .style("opacity", 0);
    });

// Make sure visual elements are above brush overlay but can still be interacted with
svg.selectAll(".dots, .overlay ~ *").raise();

}).catch(error => {
  console.error("Error loading the data: ", error);
});