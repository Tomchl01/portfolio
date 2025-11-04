/**
 * EARTHQUAKE VISUALIZATION
 * Real-time global seismic activity from USGS
 */

// Debug flag: set to true for development, false for production
const DEBUG = false;

// Conditional logging utility
function debugLog(...args) {
  if (DEBUG) console.log(...args);
}

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

  // Get animation name and timing based on event type
  function getEventAnimation(type, mag, recent) {
    let animName = 'breathe';
    let animSpeed = '4s';
    let animTiming = 'ease-in-out';
    
    // Determine base animation by type
    switch(type) {
      case 'chemical explosion':
        animName = 'chemicalSpill';
        animSpeed = recent ? '2.0s' : '3.0s';
        animTiming = 'ease-out'; // Smooth organic spread
        break;
        
      case 'mining explosion':
        animName = 'miningExplosion';
        animSpeed = recent ? '1.0s' : '1.5s';
        animTiming = 'cubic-bezier(0.68, -0.55, 0.265, 1.55)'; // Aggressive cascading
        break;
        
      case 'quarry blast':
        animName = 'quarryBlast';
        animSpeed = recent ? '1.4s' : '2.0s';
        animTiming = 'cubic-bezier(0.34, 1.56, 0.64, 1)'; // Heavy percussive
        break;
        
      case 'sonic boom':
        animName = 'sonicBoom';
        animSpeed = recent ? '0.8s' : '1.2s';
        animTiming = 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'; // Sharp radiating
        break;
        
      case 'ice quake':
        animName = 'iceQuake';
        animSpeed = recent ? '2.2s' : '3.0s';
        animTiming = 'ease-in-out'; // Crystalline and smooth
        break;
        
      case 'rock burst':
        animName = 'rockBurst';
        animSpeed = recent ? '1.6s' : '2.2s';
        animTiming = 'cubic-bezier(0.68, -0.55, 0.265, 1.55)'; // Multiple pulses
        break;
        
      case 'explosion':
        animName = 'explosion';
        animSpeed = recent ? '1.2s' : '1.8s';
        animTiming = 'cubic-bezier(0.68, -0.55, 0.265, 1.55)'; // Sharp violent
        break;
      
      case 'earthquake':
      default:
        // Magnitude-based speed for earthquakes
        if (mag >= 6.5) animSpeed = recent ? '1.2s' : '1.5s';
        else if (mag >= 5.5) animSpeed = recent ? '1.8s' : '2s';
        else if (mag >= 4.0) animSpeed = recent ? '2.5s' : '3s';
        else animSpeed = recent ? '3s' : '4s';
        break;
    }
    
    return { animName, animSpeed, animTiming };
  }

  // Create marker based on event type
  function createEventMarker(lat, lon, type, mag, depth, recent) {
    const color = depthColor(depth);
    const radius = magRadius(mag);
    
    // Get animation for this marker
    const { animName, animSpeed, animTiming } = getEventAnimation(type, mag, recent);
    
    // Debug: Log what coordinates we're receiving
    if (type !== 'earthquake') {
      debugLog(`   🔧 createEventMarker received: lat=${lat}, lon=${lon}, type=${type}`);
      debugLog(`   🗺️ Creating marker at: [${lat}, ${lon}] with animation: ${animName}`);
    }
    
    // EARTHQUAKES: Use green circles (depth-based color)
    if (type === 'earthquake') {
      const marker = L.circleMarker([lat, lon], {
        radius: radius,
        color: color,
        weight: 2,
        fillColor: color,
        fillOpacity: 0.15,
        opacity: recent ? 0.95 : 0.7,
        'data-mag': mag,
        'data-recent': recent ? 'true' : 'false',
        'data-type': type,
        'data-anim-name': animName,
        'data-anim-speed': animSpeed,
        'data-anim-timing': animTiming
      });
      
      // Attach animation when marker is added to map
      marker.on('add', function() {
        const el = this.getElement();
        if (el) {
          el.style.animation = `${animName} ${animSpeed} ${animTiming} infinite`;
          el.style.transformOrigin = 'center';
          if (recent) {
            el.style.filter = 'drop-shadow(0 0 4px rgba(0,200,0,0.8))';
          }
          debugLog(`  ✨ earthquake → ${animName} (${animSpeed})`);
        }
      });
      
      return marker;
    }
    
    // CHEMICAL EXPLOSIONS: Simple L.circleMarker with concentric ripple circles
    if (type === 'chemical explosion') {
      // Create main marker (bright green core)
      const mainMarker = L.circleMarker([lat, lon], {
        radius: radius * 1.2,
        color: '#00ff00',
        weight: 2,
        fillColor: '#00ff00',
        fillOpacity: 0.8,
        opacity: 1.0,
        'data-mag': mag,
        'data-recent': recent ? 'true' : 'false',
        'data-type': type,
        'data-anim-name': animName,
        'data-anim-speed': animSpeed,
        'data-anim-timing': animTiming
      });
      
      mainMarker.on('add', function() {
        const el = this.getElement();
        if (el) {
          el.style.animation = `${animName} ${animSpeed} ${animTiming} infinite`;
          el.style.transformOrigin = 'center';
          el.style.filter = 'drop-shadow(0 0 4px #00ff00) drop-shadow(0 0 8px #00dd00)';
          debugLog(`  ✨ chemical explosion → green core at [${lat}, ${lon}]`);
        }
      });
      
      // Create ripple 1 (mid-range, slower)
      const ripple1 = L.circleMarker([lat, lon], {
        radius: radius * 2.0,
        color: '#00dd00',
        weight: 1,
        fillColor: 'transparent',
        fillOpacity: 0,
        opacity: 0.5,
        dashArray: '3,3',
        lineCap: 'round'
      });
      
      ripple1.on('add', function() {
        const el = this.getElement();
        if (el) {
          el.style.animation = 'ripple1 3s ease-out infinite';
          el.style.transformOrigin = 'center';
          debugLog(`  ✨ chemical explosion → ripple 1`);
        }
      });
      
      // Create ripple 2 (outer, faster decay)
      const ripple2 = L.circleMarker([lat, lon], {
        radius: radius * 3.0,
        color: '#00aa00',
        weight: 1,
        fillColor: 'transparent',
        fillOpacity: 0,
        opacity: 0.3,
        dashArray: '2,4',
        lineCap: 'round'
      });
      
      ripple2.on('add', function() {
        const el = this.getElement();
        if (el) {
          el.style.animation = 'ripple2 4s ease-out infinite';
          el.style.transformOrigin = 'center';
          debugLog(`  ✨ chemical explosion → ripple 2`);
        }
      });
      
      // Add all to layer
      mainMarker.addTo(quakeLayer);
      ripple1.addTo(quakeLayer);
      ripple2.addTo(quakeLayer);
      
      return mainMarker;
    }
    
    // EXPLOSIONS & OTHER EVENTS: Create distinctive animated markers
    const markerConfig = {
      'explosion': { color: '#ff3300', size: radius * 1.5, weight: 4, opacity: 0.7, glow: '#ff3300 0px 0px 8px, #ff6600 0px 0px 16px' },
      'mining explosion': { color: '#ff6600', size: radius * 1.4, weight: 4, opacity: 0.7, glow: '#ff6600 0px 0px 6px, #ff3300 0px 0px 12px' },
      'quarry blast': { color: '#ffaa00', size: radius * 1.35, weight: 4, opacity: 0.65, glow: '#ffaa00 0px 0px 5px, #ff6600 0px 0px 10px' },
      'sonic boom': { color: '#00ddff', size: radius * 1.3, weight: 4, opacity: 0.65, glow: '#00ddff 0px 0px 6px, #0099ff 0px 0px 12px' },
      'ice quake': { color: '#00aaff', size: radius * 1.25, weight: 3, opacity: 0.6, glow: '#00aaff 0px 0px 4px, #0077dd 0px 0px 8px' },
      'rock burst': { color: '#cc6600', size: radius * 1.3, weight: 4, opacity: 0.65, glow: '#cc6600 0px 0px 5px, #ff6600 0px 0px 10px' }
    };
    
    const config = markerConfig[type] || { color: '#ff9900', size: radius * 1.2, weight: 3, opacity: 0.6, glow: '#ff9900 0px 0px 5px' };
    
    // Create animated explosion marker
    const marker = L.circleMarker([lat, lon], {
      radius: config.size,
      color: config.color,
      weight: config.weight,
      fillColor: config.color,
      fillOpacity: config.opacity,
      opacity: 1.0,
      dashArray: '2,3',
      lineCap: 'round',
      'data-mag': mag,
      'data-recent': recent ? 'true' : 'false',
      'data-type': type,
      'data-anim-name': animName,
      'data-anim-speed': animSpeed,
      'data-anim-timing': animTiming
    });
    
    marker.on('add', function() {
      const el = this.getElement();
      if (el) {
        el.style.animation = `${animName} ${animSpeed} ${animTiming} infinite`;
        el.style.transformOrigin = 'center';
        el.style.filter = `drop-shadow(${config.glow})`;
        debugLog(`  ✨ ${type} → ${animName} (${animSpeed}) with glow`);
      }
    });
    
    return marker;
  }

  // Activate live indicator briefly after data update
  function flashLiveIndicator() {
    const indicator = document.getElementById('liveIndicator');
    const timeEl = document.getElementById('updateTime');
    if (!indicator) return;
    
    // Update time display
    if (timeEl) {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      timeEl.textContent = `${hours}:${minutes}`;
    }
    
    // Make it visible and pulse
    indicator.classList.add('active');
    
    // Fade out after 4 seconds
    setTimeout(() => {
      indicator.classList.remove('active');
    }, 4000);
  }

  // Update event label - clean, simple format
  function updateEventTypeLabel(typeCounts) {
    const labelEl = document.querySelector('.stat-item .stat-label');
    if (!labelEl) return;
    
    // Calculate total event count
    const totalCount = Object.values(typeCounts).reduce((sum, count) => sum + count, 0);
    
    // Get the live indicator HTML to preserve it
    const indicatorHTML = labelEl.querySelector('.live-indicator') 
      ? labelEl.querySelector('.live-indicator').outerHTML 
      : '';
    
    labelEl.innerHTML = `Events (${totalCount})${indicatorHTML}`;
  }

  // Animation Orchestrator - DEPRECATED: animations now attach per-marker via marker.on('add')
  // Kept for reference only; no longer called
  function applyEventAnimations() {
    debugLog('🎭 Animation Orchestrator (deprecated): animations are now per-marker');
  }

  // Render earthquake markers on map
  function renderQuakes() {
    // To be implemented
  }

  // Format time as relative string (e.g., "2 hours ago")
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
    const typeCounts = {};
    let filteredNonEarthquakes = 0;
    
    for (const quake of allQuakes) {
      const { lon, lat, depth, mag, time, place, tsunami, alert, felt, url, type } = quake;
      
      // Track event types
      typeCounts[type] = (typeCounts[type] || 0) + 1;
      
      if (!isNaN(minMag) && !isNaN(mag) && mag < minMag) {
        if (type !== 'earthquake') {
          filteredNonEarthquakes++;
        }
        continue;
      }
      
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
      
      // Get animation for this event type
      const { animName, animSpeed, animTiming } = getEventAnimation(type, mag, recent);
      
      // Debug log for non-earthquake events
      if (type !== 'earthquake') {
        debugLog(`🎬 Creating ${type} marker with ${animName} animation (${animSpeed})`);
        debugLog(`   📍 Coordinates from quake object: lat=${lat}, lon=${lon}`);
      }
      
      // Create marker based on event type (star burst for explosions, circle for earthquakes)
      const marker = createEventMarker(lat, lon, type, mag, depth, recent);
      
      const localTime = fmtLocal(time);
      const relativeTime = timeAgo(time);
      
      // Don't add separate pin marker - let the main animated marker do all the work
      // The main marker is already animated and visible
      
      const popupContent = createPopupContent(mag, place, depth, time, recent, relativeTime, localTime, tsunami, alert, felt, url, type);
      
      marker.bindPopup(popupContent, {
        maxWidth: 300,
        className: 'earthquake-popup'
      });
      
      marker.addTo(quakesLayer);
      
      // Debug: confirm marker was added
      if (type !== 'earthquake') {
        debugLog(`📍 ${type} marker added to map at [${lat}, ${lon}]`);
      }
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
    
    // Log event types for debugging
    debugLog('📊 Event types detected:', typeCounts);
    if (filteredNonEarthquakes > 0) {
      debugLog(`⚠️ ${filteredNonEarthquakes} non-earthquake events filtered out by magnitude slider (min: ${minMag})`);
    }
    
    // Update label to reflect event types
    updateEventTypeLabel(typeCounts);
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
      
      debugLog(`✅ Loaded ${allQuakes.length} earthquakes (magnitude ${REGION.minMag}+)`);
      
      allQuakes.sort((a, b) => b.time - a.time);
      renderQuakes();
      
      // Flash live indicator to show data refresh
      flashLiveIndicator();
      
      debugLog(`✅ Rendered earthquakes on map`);
      
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
      { lat: 35.5, lon: 139.7, place: "near Tokyo, Japan", mag: 4.2, depth: 35, type: 'earthquake' },
      { lat: -33.4, lon: -70.6, place: "Santiago, Chile", mag: 5.1, depth: 55, type: 'mining explosion' },
      { lat: 40.7, lon: -124.3, place: "off coast of California", mag: 3.8, depth: 12, type: 'quarry blast' },
      { lat: 61.2, lon: -149.9, place: "Alaska Peninsula", mag: 4.5, depth: 40, type: 'sonic boom' },
      { lat: 38.0, lon: 23.7, place: "Athens, Greece", mag: 3.2, depth: 18, type: 'explosion' },
      { lat: -6.2, lon: 130.5, place: "Banda Sea, Indonesia", mag: 5.3, depth: 120, type: 'ice quake' },
      { lat: 19.4, lon: -155.3, place: "Hawaii", mag: 2.9, depth: 8, type: 'rock burst' },
      { lat: 42.5, lon: 142.8, place: "Hokkaido, Japan", mag: 4.8, depth: 28, type: 'chemical explosion' },
      { lat: -15.8, lon: -173.3, place: "Tonga region", mag: 5.6, depth: 150, type: 'earthquake' },
      { lat: 10.2, lon: -84.1, place: "Costa Rica", mag: 3.4, depth: 15, type: 'mining explosion' },
      { lat: 0.0, lon: 0.0, place: "Prime Meridian Test", mag: 4.0, depth: 20, type: 'chemical explosion' },
      { lat: 51.5, lon: -0.1, place: "London, UK", mag: 2.8, depth: 10, type: 'quarry blast' },
      { lat: 48.8, lon: 2.3, place: "Paris, France", mag: 3.5, depth: 15, type: 'explosion' },
      { lat: -33.9, lon: 18.4, place: "Cape Town, South Africa", mag: 3.9, depth: 25, type: 'sonic boom' },
      { lat: 1.3, lon: 103.8, place: "Singapore", mag: 2.5, depth: 5, type: 'rock burst' }
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
        source: "MOCK",
        type: loc.type || 'earthquake'
      });
    });
    
    return mockQuakes;
  }

  // Auto-refresh every 5 minutes
  function startAutoRefresh() {
    if (refreshTimer) clearInterval(refreshTimer);
    
    refreshTimer = setInterval(() => {
      debugLog("Auto-refreshing earthquake data...");
      fetchQuakes();
    }, REFRESH_INTERVAL);
  }

  fetchQuakes();
  startAutoRefresh();

  // Refresh when user returns to tab
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      debugLog("Tab visible again, refreshing data...");
      fetchQuakes();
    }
  });

}