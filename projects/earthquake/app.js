/*  ==========================================
    EARTHQUAKE VISUALIZATION
    Live global data from USGS
    Ready for animation enhancements
    ========================================== */

/* --- Config: Global View --- */
const REGION = {
  name: "Global",
  center: [20, 0],              // Center on equator
  zoom: 2,                      // World view
  minMag: 2.5                   // USGS standard for global display
};

/* --- Map Style Options --- */
const MAP_STYLES = {
  standard: {
    name: "Standard",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap contributors",
    maxZoom: 18
  },
  dark: {
    name: "Dark",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: "&copy; OpenStreetMap &copy; CartoDB",
    maxZoom: 19
  },
  light: {
    name: "Light",
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: "&copy; OpenStreetMap &copy; CartoDB",
    maxZoom: 19
  },
  voyager: {
    name: "Voyager",
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    attribution: "&copy; OpenStreetMap &copy; CartoDB",
    maxZoom: 19
  },
  watercolor: {
    name: "Watercolor",
    url: "https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}.jpg",
    attribution: "&copy; Stamen Design &copy; OpenStreetMap",
    maxZoom: 16
  },
  terrain: {
    name: "Terrain",
    url: "https://tiles.stadiamaps.com/tiles/stamen_terrain/{z}/{x}/{y}{r}.png",
    attribution: "&copy; Stamen Design &copy; OpenStreetMap",
    maxZoom: 18
  }
};

let currentStyle = 'dark'; // Default to dark style
let currentTileLayer = null;

/* --- USGS Data Source --- */
const DATA_SOURCES = {
  usgs: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson"
};

/* --- Auto-refresh interval (5 minutes) --- */
const REFRESH_INTERVAL = 5 * 60 * 1000;

/* --- State --- */
let allQuakes = [];
let refreshTimer = null;
let map = null;
let quakesLayer = null;

/* --- Wait for DOM to be ready --- */
document.addEventListener('DOMContentLoaded', function() {
  // Check if Leaflet is loaded
  if (typeof L === 'undefined') {
    console.error("Leaflet library not loaded!");
    document.getElementById("map").innerHTML = '<div style="padding: 40px; text-align: center; color: #ef4444;">Error: Map library failed to load</div>';
    return;
  }
  
  initMap();
});

function initMap() {
  /* --- DOM Elements --- */
  const magMinInput = document.getElementById("magMin");
  const magMinVal = document.getElementById("magMinVal");
  const quakeCountEl = document.getElementById("quakeCount");
  const mapEl = document.getElementById("map");
  
  if (!mapEl) {
    console.error("Map container not found!");
    return;
  }

  /* --- Update magnitude label and filter --- */
  function updateMagLabel() {
    const val = Number(magMinInput.value);
    magMinVal.textContent = val.toFixed(1);
    
    // Update range input gradient fill
    const percent = (val / 7) * 100;
    magMinInput.style.background = `linear-gradient(to right, var(--accent-blue) ${percent}%, rgba(0, 113, 227, 0.2) ${percent}%)`;
    
    // Re-render markers with new filter (only if data is loaded)
    if (allQuakes.length > 0) {
      renderQuakes();
    }
  }

  updateMagLabel();
  magMinInput.addEventListener("input", updateMagLabel);
  
  /* --- Map Style Switcher --- */
  function switchMapStyle(styleName) {
    if (!MAP_STYLES[styleName]) return;
    
    currentStyle = styleName;
    
    // Remove old tile layer
    if (currentTileLayer) {
      map.removeLayer(currentTileLayer);
    }
    
    // Add new tile layer
    const style = MAP_STYLES[styleName];
    currentTileLayer = L.tileLayer(style.url, {
      maxZoom: style.maxZoom,
      attribution: style.attribution,
    }).addTo(map);
    
    // LayerGroup doesn't have bringToFront, but we can remove and re-add
    if (quakesLayer && map.hasLayer(quakesLayer)) {
      quakesLayer.remove();
      quakesLayer.addTo(map);
    }
    
    // Update active button state
    document.querySelectorAll('.map-style-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    document.querySelector(`[data-style="${styleName}"]`)?.classList.add('active');
  }

  /* --- Initialize Leaflet map --- */
  // Clear any existing content in map div
  mapEl.innerHTML = '';
  
  try {
    map = L.map("map", {
      zoomControl: true,
      attributionControl: true,
      minZoom: 2,
      maxZoom: 12,
      preferCanvas: false // Use SVG for CSS animations to work
    });

    map.setView(REGION.center, REGION.zoom);

    /* --- Default tile layer (dark style) --- */
    const style = MAP_STYLES[currentStyle];
    currentTileLayer = L.tileLayer(style.url, {
      maxZoom: style.maxZoom,
      attribution: style.attribution,
    }).addTo(map);

    /* --- Layer group to hold quake markers --- */
    quakesLayer = L.layerGroup().addTo(map);

    /* --- Force map to invalidate size after load --- */
    setTimeout(() => {
      map.invalidateSize();
    }, 250);
    
  } catch (err) {
    console.error("Error initializing map:", err);
    mapEl.innerHTML = '<div style="padding: 40px; text-align: center; color: #ef4444;">Error initializing map: ' + err.message + '</div>';
    return;
  }
  
  /* --- Setup map style buttons --- */
  document.querySelectorAll('.map-style-btn').forEach(btn => {
    const styleName = btn.getAttribute('data-style');
    
    // Set initial active state
    if (styleName === currentStyle) {
      btn.classList.add('active');
    }
    
    // Add click handler
    btn.addEventListener('click', () => {
      switchMapStyle(styleName);
    });
  });

  /* --- Color by depth (km) buckets --- */
  function depthColor(depthKm) {
    if (depthKm == null || isNaN(depthKm)) return "#999999";
    if (depthKm < 10) return "#22c55e";     // shallow = green
    if (depthKm < 30) return "#84cc16";
    if (depthKm < 70) return "#eab308";
    if (depthKm < 300) return "#f59e0b";
    return "#ef4444";                       // very deep = red
  }

  /* --- Radius in pixels from magnitude - smaller and more subtle --- */
  function magRadius(mag) {
    if (mag == null || isNaN(mag)) return 3;
    // Smaller scale: range 3-12px for better readability
    return Math.max(3, Math.min(12, Math.pow(mag, 1.3) * 1.5));
  }

  /* --- Format time as relative (e.g., "2 hours ago") --- */
  function timeAgo(utcMs) {
    const now = Date.now();
    const diff = now - utcMs;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  }

  /* --- Local time (UTC for global view) --- */
  function fmtLocal(utcMs) {
    try {
      const dt = new Date(utcMs);
      return new Intl.DateTimeFormat("en-US", {
        timeZone: "UTC",
        year: "numeric", month: "short", day: "2-digit",
        hour: "2-digit", minute: "2-digit",
        timeZoneName: "short"
      }).format(dt);
    } catch {
      return new Date(utcMs).toUTCString();
    }
  }

  /* --- Check if earthquake is recent (last 2 hours) --- */
  function isRecent(utcMs) {
    const twoHours = 2 * 60 * 60 * 1000;
    return (Date.now() - utcMs) < twoHours;
  }

  /* --- Within bounding box? --- */
  function inBbox(lon, lat, bbox) {
    const [minLon, minLat, maxLon, maxLat] = bbox;
    return lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat;
  }

  /* --- Render earthquake markers based on current filter --- */
  function renderQuakes() {
    const minMag = Number(magMinInput.value);
    
    // Clear existing markers
    quakesLayer.clearLayers();
    
    let visibleCount = 0;
    let recentCount = 0;
    
    for (const quake of allQuakes) {
      const { lon, lat, depth, mag, time, place } = quake;
      
      // Apply magnitude filter
      if (!isNaN(minMag) && !isNaN(mag) && mag < minMag) continue;
      
      visibleCount++;
      const recent = isRecent(time);
      if (recent) recentCount++;
      
      // Determine magnitude class for animation intensity
      let magClass = 'mag-small';
      if (mag >= 6.5) {
        magClass = 'mag-major';
      } else if (mag >= 5.5) {
        magClass = 'mag-large';
      } else if (mag >= 4.0) {
        magClass = 'mag-medium';
      }
      
      // Calculate animation speed based on magnitude
      let animSpeed = '4s'; // Small
      if (mag >= 6.5) animSpeed = '1.5s';      // Major
      else if (mag >= 5.5) animSpeed = '2s';   // Large  
      else if (mag >= 4.0) animSpeed = '3s';   // Medium
      
      // Recent earthquakes breathe faster
      if (recent) {
        if (mag >= 6.5) animSpeed = '1.2s';
        else if (mag >= 5.5) animSpeed = '1.8s';
        else if (mag >= 4.0) animSpeed = '2.5s';
        else animSpeed = '3s';
      }
      
      // Create open circle marker with magnitude-based ripple effect
      const circle = L.circleMarker([lat, lon], {
        radius: magRadius(mag),
        color: depthColor(depth),           // Border color by depth
        weight: 2,                          // Thicker stroke for visibility
        fillColor: depthColor(depth),
        fillOpacity: 0.15,                  // Very transparent fill (almost hollow)
        opacity: recent ? 0.95 : 0.7,       // Border opacity
        // Use data attributes instead of classes
        'data-mag': mag,
        'data-recent': recent ? 'true' : 'false'
      });
      
      // Apply animation speed via inline style after adding to map
      circle.on('add', function() {
        const el = circle.getElement();
        console.log('Circle element:', el, 'Tag:', el?.tagName);
        if (el) {
          el.style.animation = `breathe ${animSpeed} ease-in-out infinite`;
          el.style.transformOrigin = 'center';
          el.style.transform = 'none';
          console.log('Applied animation:', el.style.animation);
        } else {
          console.log('❌ No element found!');
        }
      });
      
      // Calculate time strings for popup
      const localTime = fmtLocal(time);
      const relativeTime = timeAgo(time);
      
      // Add a minimalist pin icon for recent earthquakes
      if (recent) {
        const pinIcon = L.divIcon({
          className: 'recent-pin-marker',
          html: `<div class="pin-icon" style="color: ${depthColor(depth)}">
                   <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2">
                     <circle cx="12" cy="12" r="3"/>
                   </svg>
                 </div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8]
        });
        
        const pinMarker = L.marker([lat, lon], { 
          icon: pinIcon,
          zIndexOffset: 1000 // Keep on top
        }).addTo(quakesLayer);
        
        // Share the same popup
        const popupContent = createPopupContent(mag, place, depth, time, recent, relativeTime, localTime);
        pinMarker.bindPopup(popupContent, {
          maxWidth: 300,
          className: 'earthquake-popup'
        });
      }
      
      // Popup with details for circle marker
      const popupContent = createPopupContent(mag, place, depth, time, recent, relativeTime, localTime);
      
      circle.bindPopup(popupContent, {
        maxWidth: 300,
        className: 'earthquake-popup'
      });
      
      circle.addTo(quakesLayer);
    }
    
    // Update stats
    quakeCountEl.textContent = visibleCount;
    
    const recentStat = document.getElementById('recentStat');
    const recentCountEl = document.getElementById('recentCount');
    if (recentCount > 0) {
      recentCountEl.textContent = recentCount;
      recentStat.style.display = 'flex';
    } else {
      recentStat.style.display = 'none';
    }
  }
  
  /* --- Create popup content --- */
  function createPopupContent(mag, place, depth, time, recent, relativeTime, localTime) {
    return `
      <div style="font-family: inherit;">
        <div style="margin-bottom: 8px;">
          <strong style="font-size: 16px; color: var(--text-primary);">
            M ${isNaN(mag) ? "—" : mag.toFixed(1)}
          </strong>
          ${recent ? '<span style="color: #ef4444; font-weight: 600; margin-left: 8px;">● RECENT</span>' : ''}
        </div>
        <div style="margin-bottom: 6px; color: var(--text-secondary); font-size: 14px;">
          ${place || "—"}
        </div>
        <div style="margin-bottom: 4px; color: var(--text-secondary); font-size: 13px;">
          <strong>Depth:</strong> ${isNaN(depth) ? "—" : depth.toFixed(0)} km
        </div>
        <div style="margin-bottom: 4px; color: var(--text-secondary); font-size: 13px;">
          <strong>Time:</strong> ${relativeTime} (${localTime})
        </div>
      </div>
    `;
  }

  /* --- Parse OVSICORI HTML table --- */
  function parseOvsicoriTable(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const earthquakes = [];
    
    // Find the table rows - OVSICORI uses a specific table structure
    const rows = doc.querySelectorAll('table tbody tr');
    
    console.log(`Found ${rows.length} table rows in OVSICORI data`);
    
    for (const row of rows) {
      const cells = row.querySelectorAll('td');
      if (cells.length < 7) continue; // Need at least 7 columns
      
      try {
        // OVSICORI table format (approximate):
        // Date | Time | Lat | Lon | Depth | Magnitude | Location
        const dateStr = cells[0]?.textContent.trim();
        const timeStr = cells[1]?.textContent.trim();
        const latStr = cells[2]?.textContent.trim();
        const lonStr = cells[3]?.textContent.trim();
        const depthStr = cells[4]?.textContent.trim();
        const magStr = cells[5]?.textContent.trim();
        const location = cells[6]?.textContent.trim();
        
        // Parse coordinates
        const lat = parseFloat(latStr);
        const lon = parseFloat(lonStr);
        const depthKm = parseFloat(depthStr);
        const mag = parseFloat(magStr);
        
        // Parse date/time to timestamp
        const dateTime = `${dateStr} ${timeStr}`;
        const timestamp = new Date(dateTime).getTime();
        
        if (isNaN(lat) || isNaN(lon)) continue;
        
        earthquakes.push({
          lat,
          lon,
          depthKm: isNaN(depthKm) ? 10 : depthKm,
          mag: isNaN(mag) ? 2.0 : mag,
          time: isNaN(timestamp) ? Date.now() : timestamp,
          place: location || "Costa Rica",
          url: "https://www.ovsicori.una.ac.cr/index.php/localizacion-automatica",
          type: "earthquake"
        });
      } catch (err) {
        console.warn("Error parsing row:", err);
        continue;
      }
    }
    
    return earthquakes;
  }

  /* --- Fetch earthquake data from OVSICORI --- */
  async function fetchQuakes() {
    // Show loading state
    mapEl.classList.add('loading');
    quakeCountEl.classList.add('updating');
    
    try {
      // USGS GeoJSON Feed API - Past 7 days, magnitude 2.5+, worldwide
      const usgsUrl = DATA_SOURCES.usgs;
      
      const response = await fetch(usgsUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        mode: 'cors'
      });
      
      if (!response.ok) {
        throw new Error(`USGS API returned ${response.status}: ${response.statusText}`);
      }
      
      const geojson = await response.json();
      
      // Transform USGS GeoJSON to our format (no filtering - show all)
      allQuakes = geojson.features
        .map(feature => {
          const [lon, lat, depth] = feature.geometry.coordinates;
          const props = feature.properties;
          
          return {
            time: props.time,
            lat,
            lon,
            depth: depth || 10,
            mag: props.mag || 0,
            place: props.place || 'Unknown location',
            status: props.status || 'automatic',
            source: 'USGS'
          };
        })
        .filter(eq => eq.mag >= REGION.minMag); // Only filter by minimum magnitude
      
      console.log(`✅ Loaded ${allQuakes.length} earthquakes (magnitude ${REGION.minMag}+)`);
      
      // Sort by time (most recent first)
      allQuakes.sort((a, b) => b.time - a.time);
      
      // Render with current filter
      renderQuakes();
      
      console.log(`✅ Rendered earthquakes on map`);
      
    } catch (err) {
      console.error("❌ Failed to load earthquake data:", err);
      console.warn("⚠️  Falling back to mock data");
      
      // Fallback to mock data
      allQuakes = generateMockData();
      allQuakes.sort((a, b) => b.time - a.time);
      
      renderQuakes();
      
      quakeCountEl.textContent = `${allQuakes.length}`;
    } finally {
      // Remove loading state
      mapEl.classList.remove('loading');
      quakeCountEl.classList.remove('updating');
    }
  }
  
  /* --- Generate mock data for demonstration --- */
  function generateMockData() {
    const mockQuakes = [];
    const now = Date.now();
    
    // Create some realistic global earthquakes
    const locations = [
      { lat: 35.5, lon: 139.7, place: "near Tokyo, Japan", mag: 4.2, depth: 35 },
      { lat: -33.4, lon: -70.6, place: "Santiago, Chile", mag: 5.1, depth: 55 },
      { lat: 40.7, lon: -124.3, place: "off coast of California", mag: 3.8, depth: 12 },
      { lat: 61.2, lon: -149.9, place: "Alaska Peninsula", mag: 4.5, depth: 40 },
      { lat: 38.0, lon: 23.7, place: "Athens, Greece", mag: 3.2, depth: 18 },
      { lat: -6.2, lon: 130.5, place: "Banda Sea, Indonesia", mag: 5.3, depth: 120 },
      { lat: 19.4, lon: -155.3, place: "Hawaii", mag: 2.9, depth: 8 },
      { lat: 42.5, lon: 142.8, place: "Hokkaido, Japan", mag: 4.8, depth: 28 },
      { lat: -15.8, lon: -173.3, place: "Tonga region", mag: 5.6, depth: 150 },
      { lat: 10.2, lon: -84.1, place: "Costa Rica", mag: 3.4, depth: 15 }
    ];
    
    locations.forEach((loc, i) => {
      mockQuakes.push({
        lat: loc.lat,
        lon: loc.lon,
        depth: loc.depth,
        mag: loc.mag,
        time: now - (i * 3600000), // Each 1 hour apart
        place: loc.place,
        status: "automatic",
        source: "MOCK"
      });
    });
    
    return mockQuakes;
  }

  /* --- Setup auto-refresh --- */
  function startAutoRefresh() {
    if (refreshTimer) clearInterval(refreshTimer);
    
    refreshTimer = setInterval(() => {
      console.log("Auto-refreshing earthquake data...");
      fetchQuakes();
    }, REFRESH_INTERVAL);
  }

  /* --- Initial load --- */
  fetchQuakes();
  startAutoRefresh();

  /* --- Manual refresh on visibility change (when user returns to tab) --- */
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      console.log("Tab visible again, refreshing data...");
      fetchQuakes();
    }
  });

} // End of initMap