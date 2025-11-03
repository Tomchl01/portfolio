/**
 * EARTHQUAKE VISUALIZATION
 * Real-time global seismic activity from USGS
 */

// Configuration
const REGION = {
  name: "Global",
  center: [20, 0],
  zoom: 2,
  minMag: 2.5
};

// Map tile providers
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

let currentStyle = 'dark';
let currentTileLayer = null;

// Data source
const DATA_SOURCES = {
  usgs: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson"
};

// Auto-refresh every 5 minutes
const REFRESH_INTERVAL = 5 * 60 * 1000;

// State
let allQuakes = [];
let refreshTimer = null;
let map = null;
let quakesLayer = null;

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', function() {
  if (typeof L === 'undefined') {
    console.error("Leaflet library not loaded!");
    document.getElementById("map").innerHTML = '<div style="padding: 40px; text-align: center; color: #ef4444;">Error: Map library failed to load</div>';
    return;
  }
  
  initMap();
});

function initMap() {
  // DOM elements
  const magMinInput = document.getElementById("magMin");
  const magMinVal = document.getElementById("magMinVal");
  const quakeCountEl = document.getElementById("quakeCount");
  const mapEl = document.getElementById("map");
  
  if (!mapEl) {
    console.error("Map container not found!");
    return;
  }

  // Update magnitude filter label
  function updateMagLabel() {
    const val = Number(magMinInput.value);
    magMinVal.textContent = val.toFixed(1);
    
    // Update slider gradient
    const percent = (val / 7) * 100;
    magMinInput.style.background = `linear-gradient(to right, var(--accent-blue) ${percent}%, rgba(0, 113, 227, 0.2) ${percent}%)`;
    
    if (allQuakes.length > 0) {
      renderQuakes();
    }
  }

  updateMagLabel();
  magMinInput.addEventListener("input", updateMagLabel);
  
  // Switch map tile style
  function switchMapStyle(styleName) {
    if (!MAP_STYLES[styleName]) return;
    
    currentStyle = styleName;
    
    if (currentTileLayer) {
      map.removeLayer(currentTileLayer);
    }
    
    const style = MAP_STYLES[styleName];
    currentTileLayer = L.tileLayer(style.url, {
      maxZoom: style.maxZoom,
      attribution: style.attribution,
    }).addTo(map);
    
    // Keep quake layer on top
    if (quakesLayer && map.hasLayer(quakesLayer)) {
      quakesLayer.remove();
      quakesLayer.addTo(map);
    }
    
    // Update button states
    document.querySelectorAll('.map-style-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    document.querySelector(`[data-style="${styleName}"]`)?.classList.add('active');
  }

  // Initialize Leaflet map
  mapEl.innerHTML = '';
  
  try {
    map = L.map("map", {
      zoomControl: true,
      attributionControl: false,
      minZoom: 2,
      maxZoom: 12,
      preferCanvas: false
    });

    map.setView(REGION.center, REGION.zoom);

    const style = MAP_STYLES[currentStyle];
    currentTileLayer = L.tileLayer(style.url, {
      maxZoom: style.maxZoom,
      attribution: style.attribution,
    }).addTo(map);

    quakesLayer = L.layerGroup().addTo(map);

    setTimeout(() => {
      map.invalidateSize();
    }, 250);
    
  } catch (err) {
    console.error("Error initializing map:", err);
    mapEl.innerHTML = '<div style="padding: 40px; text-align: center; color: #ef4444;">Error initializing map: ' + err.message + '</div>';
    return;
  }
  
  // Setup style switcher buttons
  document.querySelectorAll('.map-style-btn').forEach(btn => {
    const styleName = btn.getAttribute('data-style');
    
    if (styleName === currentStyle) {
      btn.classList.add('active');
    }
    
    btn.addEventListener('click', () => {
      switchMapStyle(styleName);
    });
  });

  // Color scale based on depth
  function depthColor(depthKm) {
    if (depthKm == null || isNaN(depthKm)) return "#999999";
    if (depthKm < 10) return "#22c55e";
    if (depthKm < 30) return "#84cc16";
    if (depthKm < 70) return "#eab308";
    if (depthKm < 300) return "#f59e0b";
    return "#ef4444";
  }

  // Calculate marker radius from magnitude
  function magRadius(mag) {
    if (mag == null || isNaN(mag)) return 3;
    return Math.max(3, Math.min(12, Math.pow(mag, 1.3) * 1.5));
  }

  // Format time as relative string
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

  // Format UTC timestamp as local time
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

  // Check if earthquake occurred within last 2 hours
  function isRecent(utcMs) {
    const twoHours = 2 * 60 * 60 * 1000;
    return (Date.now() - utcMs) < twoHours;
  }

  // Check if coordinates are within bounding box
  function inBbox(lon, lat, bbox) {
    const [minLon, minLat, maxLon, maxLat] = bbox;
    return lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat;
  }

  // Render earthquake markers on map
  function renderQuakes() {                       // very deep = red
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
    quakesLayer.clearLayers();
    
    let visibleCount = 0;
    let recentCount = 0;
    
    for (const quake of allQuakes) {
      const { lon, lat, depth, mag, time, place, tsunami, alert, felt, url, type } = quake;
      
      if (!isNaN(minMag) && !isNaN(mag) && mag < minMag) continue;
      
      visibleCount++;
      const recent = isRecent(time);
      if (recent) recentCount++;
      
      // Magnitude classification
      let magClass = 'mag-small';
      if (mag >= 6.5) {
        magClass = 'mag-major';
      } else if (mag >= 5.5) {
        magClass = 'mag-large';
      } else if (mag >= 4.0) {
        magClass = 'mag-medium';
      }
      
      // Animation speed varies by magnitude
      let animSpeed = '4s';
      if (mag >= 6.5) animSpeed = '1.5s';
      else if (mag >= 5.5) animSpeed = '2s';
      else if (mag >= 4.0) animSpeed = '3s';
      
      // Recent events breathe faster
      if (recent) {
        if (mag >= 6.5) animSpeed = '1.2s';
        else if (mag >= 5.5) animSpeed = '1.8s';
        else if (mag >= 4.0) animSpeed = '2.5s';
        else animSpeed = '3s';
      }
      
      // Create circle marker
      const circle = L.circleMarker([lat, lon], {
        radius: magRadius(mag),
        color: depthColor(depth),
        weight: 2,
        fillColor: depthColor(depth),
        fillOpacity: 0.15,
        opacity: recent ? 0.95 : 0.7,
        'data-mag': mag,
        'data-recent': recent ? 'true' : 'false'
      });
      
      // Apply CSS animation via inline style
      circle.on('add', function() {
        const el = circle.getElement();
        if (el) {
          el.style.animation = `breathe ${animSpeed} ease-in-out infinite`;
          el.style.transformOrigin = 'center';
          el.style.transform = 'none';
        }
      });
      
      const localTime = fmtLocal(time);
      const relativeTime = timeAgo(time);
      
      // Add pin marker for recent earthquakes
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
          zIndexOffset: 1000
        }).addTo(quakesLayer);
        
        const popupContent = createPopupContent(mag, place, depth, time, recent, relativeTime, localTime, tsunami, alert, felt, url, type);
        pinMarker.bindPopup(popupContent, {
          maxWidth: 300,
          className: 'earthquake-popup'
        });
      }
      
      const popupContent = createPopupContent(mag, place, depth, time, recent, relativeTime, localTime, tsunami, alert, felt, url, type);
      
      circle.bindPopup(popupContent, {
        maxWidth: 300,
        className: 'earthquake-popup'
      });
      
      circle.addTo(quakesLayer);
    }
    
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
  
  // Create popup HTML with earthquake details
  function createPopupContent(mag, place, depth, time, recent, relativeTime, localTime, tsunami, alert, felt, url, type) {
    const alertColors = {
      green: '#22c55e',
      yellow: '#eab308',
      orange: '#f97316',
      red: '#ef4444'
    };
    const alertColor = alert ? alertColors[alert] : null;
    
    return `
      <div style="font-family: inherit;">
        <div style="margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between;">
          <div>
            <strong style="font-size: 16px; color: var(--text-primary);">
              M ${isNaN(mag) ? " " : mag.toFixed(1)}
            </strong>
            ${recent ? '<span style="color: #ef4444; font-weight: 600; margin-left: 8px;">● RECENT</span>' : ''}
            ${tsunami === 1 ? '<span style="margin-left: 8px; font-size: 18px;" title="Tsunami Warning">🌊</span>' : ''}
          </div>
          ${alertColor ? `<div style="width: 12px; height: 12px; border-radius: 50%; background: ${alertColor};" title="Alert: ${alert}"></div>` : ''}
        </div>
        <div style="margin-bottom: 6px; color: var(--text-secondary); font-size: 14px;">
          ${place || " "}
        </div>
        <div style="margin-bottom: 4px; color: var(--text-secondary); font-size: 13px;">
          <strong>Type:</strong> ${type}
        </div>
        <div style="margin-bottom: 4px; color: var(--text-secondary); font-size: 13px;">
          <strong>Depth:</strong> ${isNaN(depth) ? " " : depth.toFixed(0)} km
        </div>
        <div style="margin-bottom: 4px; color: var(--text-secondary); font-size: 13px;">
          <strong>Time:</strong> ${relativeTime} (${localTime})
        </div>
        ${felt ? `<div style="margin-bottom: 4px; color: var(--text-secondary); font-size: 13px;">
          <strong>Felt by:</strong> ${felt.toLocaleString()} ${felt === 1 ? 'person' : 'people'}
        </div>` : ''}
        ${alert ? `<div style="margin-bottom: 4px; color: var(--text-secondary); font-size: 13px;">
          <strong>Alert:</strong> <span style="color: ${alertColor}; text-transform: uppercase; font-weight: 600;">${alert}</span>
        </div>` : ''}
        ${url ? `<div style="margin-top: 8px;">
          <a href="${url}" target="_blank" rel="noopener noreferrer" style="color: #3b82f6; text-decoration: none; font-size: 13px;">
            More info on USGS →
          </a>
        </div>` : ''}
      </div>
    `;
  }

  // Fetch earthquake data from USGS API
  async function fetchQuakes() {
    mapEl.classList.add('loading');
    quakeCountEl.classList.add('updating');
    
    try {
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
            source: 'USGS',
            tsunami: props.tsunami || 0,
            alert: props.alert || null,
            felt: props.felt || null,
            url: props.url || null,
            type: props.type || 'earthquake'
          };
        })
        .filter(eq => eq.mag >= REGION.minMag);
      
      console.log(`✅ Loaded ${allQuakes.length} earthquakes (magnitude ${REGION.minMag}+)`);
      
      allQuakes.sort((a, b) => b.time - a.time);
      renderQuakes();
      
      console.log(`✅ Rendered earthquakes on map`);
      
    } catch (err) {
      console.error("❌ Failed to load earthquake data:", err);
      console.warn("⚠️  Falling back to mock data");
      
      allQuakes = generateMockData();
      allQuakes.sort((a, b) => b.time - a.time);
      renderQuakes();
      
      quakeCountEl.textContent = `${allQuakes.length}`;
    } finally {
      mapEl.classList.remove('loading');
      quakeCountEl.classList.remove('updating');
    }
  }
  
  // Generate mock data for testing
  function generateMockData() {
    const mockQuakes = [];
    const now = Date.now();
    
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
        time: now - (i * 3600000),
        place: loc.place,
        status: "automatic",
        source: "MOCK"
      });
    });
    
    return mockQuakes;
  }

  // Auto-refresh every 5 minutes
  function startAutoRefresh() {
    if (refreshTimer) clearInterval(refreshTimer);
    
    refreshTimer = setInterval(() => {
      console.log("Auto-refreshing earthquake data...");
      fetchQuakes();
    }, REFRESH_INTERVAL);
  }

  fetchQuakes();
  startAutoRefresh();

  // Refresh when user returns to tab
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      console.log("Tab visible again, refreshing data...");
      fetchQuakes();
    }
  });

}