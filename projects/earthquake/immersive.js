/**
 * Immersive 3D Seismic Timeline
 * Real-time hyperspace visualization of the last 5 seismic events
 */

const DEBUG = false;
const debugLog = (msg) => DEBUG && console.log(`[3D Timeline] ${msg}`);

// ================================================
// Configuration
// ================================================

const CONFIG = {
  MAX_EVENTS: 5,
  SCENE: {
    width: 200,
    height: 150,
    depth: 300,
    fog: { near: 50, far: 500, color: 0x0a0a0a }
  },
  CAMERA: {
    fov: 60,
    near: 0.1,
    far: 1000,
    positionOverview: { x: 0, y: 60, z: 150 }
  },
  EVENT: {
    magMinRadius: 0.5,
    magMaxRadius: 3.5,
    magMinMag: 2.5,
    magMaxMag: 7.5
  },
  ANIMATION: {
    overviewDuration: 2000,
    detailDuration: 1500,
    spawnDuration: 800
  }
};

// ================================================
// Type Colors
// ================================================

const TYPE_COLORS = {
  'earthquake': 0x00ff00,
  'explosion': 0xff3300,
  'chemical explosion': 0xffdd00,
  'mining explosion': 0xff6600,
  'quarry blast': 0xffaa00,
  'sonic boom': 0x00ddff,
  'ice quake': 0x00aaff,
  'rock burst': 0xcc6600
};

// ================================================
// Global State
// ================================================

let scene, camera, renderer;
let timelineData = null;
let currentEventFocus = null;
let isPlayingTimeline = false;
let timelineProgress = 0;
let playbackSpeed = 1;
let eventMeshes = [];

// ================================================
// Initialization
// ================================================

window.addEventListener('DOMContentLoaded', async () => {
  try {
    debugLog('Initializing immersive timeline...');
    
    // Fetch seismic data
    await fetchSeismicData();
    
    // Initialize Three.js
    initThreeJS();
    
    // Setup events and listeners
    setupEventListeners();
    
    // Hide loading overlay
    const overlay = document.getElementById('loading-overlay');
    overlay.classList.add('hidden');
    
    // Start animation loop
    animate();
    
    debugLog('✅ Immersive timeline ready');
  } catch (err) {
    console.error('❌ Failed to initialize:', err);
    document.getElementById('loading-overlay').innerHTML = `
      <div class="loading-spinner">
        <p style="color: #ff3333;">Error loading timeline</p>
        <p style="font-size: 11px; margin-top: 8px;">${err.message}</p>
      </div>
    `;
  }
});

// ================================================
// Fetch Seismic Data
// ================================================

async function fetchSeismicData() {
  debugLog('Fetching seismic data from USGS...');
  
  try {
    // Use same endpoint as main app
    const response = await fetch(
      'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.geojson'
    );
    
    if (!response.ok) throw new Error(`USGS API error: ${response.status}`);
    
    const data = await response.json();
    const features = data.features || [];
    
    // Get most recent 5 events
    const recentEvents = features.slice(0, CONFIG.MAX_EVENTS).map(feature => {
      const props = feature.properties;
      const [lon, lat, depth] = feature.geometry.coordinates;
      
      return {
        id: feature.id,
        time: props.time,
        lat: lat,
        lon: lon,
        depth: depth || 0,
        mag: props.mag || 4.5,
        type: props.type || 'earthquake',
        place: props.place || 'Unknown location',
        url: props.url
      };
    });
    
    debugLog(`✅ Fetched ${recentEvents.length} events`);
    
    // Transform to 3D data
    timelineData = transformEventsTo3D(recentEvents);
    
    updateHUDStatus();
    
  } catch (err) {
    debugLog(`⚠️  USGS fetch failed, using mock data: ${err.message}`);
    timelineData = generateMockTimeline();
    updateHUDStatus();
  }
}

// ================================================
// Transform Events to 3D
// ================================================

function transformEventsTo3D(events) {
  if (events.length === 0) {
    return { events: [], timeRange: { min: 0, max: 1 }, depthRange: { min: 0, max: 1 }, magRange: { min: 2.5, max: 5 } };
  }

  const times = events.map(e => e.time);
  const depths = events.map(e => e.depth);
  const mags = events.map(e => e.mag);

  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const maxDepth = Math.max(...depths);
  const minMag = Math.min(...mags);
  const maxMag = Math.max(...mags);

  const transformed = events.map((event, index) => {
    // 3D position
    const x = ((event.lon + 180) / 360) * CONFIG.SCENE.width - (CONFIG.SCENE.width / 2);
    const y = -(event.depth / (maxDepth || 1)) * CONFIG.SCENE.height;
    const z = ((event.time - minTime) / (maxTime - minTime || 1)) * CONFIG.SCENE.depth - (CONFIG.SCENE.depth / 2);

    // Visual properties
    const size = calculateSizeFromMagnitude(event.mag, minMag, maxMag);
    const color = getColorByType(event.type);
    const recencyFactor = (event.time - minTime) / (maxTime - minTime || 1);
    const opacity = 0.5 + (recencyFactor * 0.5); // 0.5 to 1.0

    return {
      id: event.id,
      index: index,
      original: event,
      position: { x, y, z },
      size: size,
      color: color,
      opacity: opacity,
      recencyFactor: recencyFactor,
      mesh: null // Will be set when mesh is created
    };
  });

  return {
    events: transformed,
    timeRange: { min: minTime, max: maxTime },
    depthRange: { min: 0, max: maxDepth || 1 },
    magRange: { min: minMag, max: maxMag }
  };
}

function calculateSizeFromMagnitude(mag, minMag = 2.5, maxMag = 7.5) {
  const normalized = (mag - minMag) / (maxMag - minMag);
  return CONFIG.EVENT.magMinRadius + (normalized * (CONFIG.EVENT.magMaxRadius - CONFIG.EVENT.magMinRadius));
}

function getColorByType(type) {
  return TYPE_COLORS[type] || TYPE_COLORS['earthquake'];
}

// ================================================
// Generate Mock Timeline
// ================================================

function generateMockTimeline() {
  const now = Date.now();
  const mockEvents = [
    { lat: 35.5, lon: 139.7, depth: 35, mag: 4.2, time: now - 6 * 3600000, type: 'earthquake', place: 'Tokyo, Japan' },
    { lat: -33.4, lon: -70.6, depth: 55, mag: 5.1, time: now - 4 * 3600000, type: 'mining explosion', place: 'Santiago, Chile' },
    { lat: 40.7, lon: -124.3, depth: 12, mag: 3.8, time: now - 2 * 3600000, type: 'quarry blast', place: 'California, USA' },
    { lat: 38.0, lon: 23.7, depth: 18, mag: 3.2, time: now - 1 * 3600000, type: 'explosion', place: 'Athens, Greece' },
    { lat: 42.5, lon: 142.8, depth: 28, mag: 4.8, time: now - 0.5 * 3600000, type: 'chemical explosion', place: 'Hokkaido, Japan' }
  ];

  return transformEventsTo3D(mockEvents);
}

// ================================================
// Three.js Initialization
// ================================================

function initThreeJS() {
  const container = document.getElementById('canvas-container');
  const width = window.innerWidth;
  const height = window.innerHeight;

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a0a);
  scene.fog = new THREE.Fog(
    CONFIG.SCENE.fog.color,
    CONFIG.SCENE.fog.near,
    CONFIG.SCENE.fog.far
  );

  // Camera
  camera = new THREE.PerspectiveCamera(CONFIG.CAMERA.fov, width / height, CONFIG.CAMERA.near, CONFIG.CAMERA.far);
  camera.position.copy(CONFIG.CAMERA.positionOverview);
  camera.lookAt(0, 30, 0);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setSize(width, height);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowShadowMap;
  container.appendChild(renderer.domElement);

  // Lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
  directionalLight.position.set(50, 100, 50);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 2048;
  directionalLight.shadow.mapSize.height = 2048;
  scene.add(directionalLight);

  // Point lights for event glow
  const pointLight1 = new THREE.PointLight(0x00ff00, 0.3, 500);
  pointLight1.position.set(100, 80, 0);
  scene.add(pointLight1);

  const pointLight2 = new THREE.PointLight(0x00ff00, 0.2, 500);
  pointLight2.position.set(-100, 80, 0);
  scene.add(pointLight2);

  // Reference grid (optional)
  const gridHelper = new THREE.GridHelper(
    CONFIG.SCENE.width,
    20,
    0x1a3a1a,
    0x0a1a0a
  );
  gridHelper.position.y = 0;
  gridHelper.position.z = 0;
  scene.add(gridHelper);

  // Create event meshes
  createEventMeshes();

  // Handle window resize
  window.addEventListener('resize', onWindowResize);

  debugLog('✅ Three.js initialized');
}

// ================================================
// Create Event Meshes
// ================================================

function createEventMeshes() {
  if (!timelineData || !timelineData.events) return;

  timelineData.events.forEach((eventData, index) => {
    // Main sphere
    const geometry = new THREE.SphereGeometry(eventData.size, 32, 32);
    const material = new THREE.MeshPhongMaterial({
      color: eventData.color,
      emissive: eventData.color,
      emissiveIntensity: 0.5,
      wireframe: false,
      side: THREE.FrontSide
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(eventData.position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // Store reference
    mesh.userData = {
      eventIndex: index,
      eventData: eventData
    };

    scene.add(mesh);
    eventData.mesh = mesh;
    eventMeshes.push(mesh);

    // Add hover effect
    mesh.userData.originalEmissiveIntensity = 0.5;

    // Animate spawn
    animateEventSpawn(mesh, index);

    debugLog(`Created event mesh ${index + 1}/${timelineData.events.length}`);
  });
}

function animateEventSpawn(mesh, index) {
  const delay = index * 200;
  const duration = CONFIG.ANIMATION.spawnDuration;

  setTimeout(() => {
    const startScale = 0;
    const startTime = Date.now();

    const spawn = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      mesh.scale.setScalar(progress);

      if (progress < 1) {
        requestAnimationFrame(spawn);
      }
    };

    spawn();
  }, delay);
}

// ================================================
// Update HUD
// ================================================

function updateHUDStatus() {
  if (!timelineData) return;

  const eventCount = timelineData.events.length;
  document.getElementById('event-count').textContent = `${eventCount} Event${eventCount !== 1 ? 's' : ''}`;

  const timeRange = timelineData.timeRange;
  if (timeRange.min && timeRange.max) {
    const minDate = new Date(timeRange.min);
    const maxDate = new Date(timeRange.max);
    const daysDiff = Math.ceil((maxDate - minDate) / (1000 * 3600 * 24));
    document.getElementById('time-range').textContent = `Last ${daysDiff} day${daysDiff !== 1 ? 's' : ''}`;
  }
}

// ================================================
// Event Listeners
// ================================================

function setupEventListeners() {
  // Canvas click to select event
  renderer.domElement.addEventListener('click', onCanvasClick);

  // Controls
  document.getElementById('play-btn').addEventListener('click', startPlayback);
  document.getElementById('pause-btn').addEventListener('click', pausePlayback);
  document.getElementById('reset-btn').addEventListener('click', resetView);
  document.getElementById('close-panel').addEventListener('click', closeEventPanel);
  document.getElementById('speed-select').addEventListener('change', (e) => {
    playbackSpeed = parseFloat(e.target.value);
  });

  // Scrubber
  document.getElementById('scrubber-input').addEventListener('input', onScrubberChange);

  debugLog('✅ Event listeners attached');
}

// ================================================
// Canvas Interaction
// ================================================

function onCanvasClick(event) {
  // Get mouse position
  const rect = renderer.domElement.getBoundingClientRect();
  const mouse = new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1
  );

  // Raycaster
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, camera);

  const intersects = raycaster.intersectObjects(eventMeshes);

  if (intersects.length > 0) {
    const mesh = intersects[0].object;
    focusEvent(mesh.userData.eventIndex);
  } else {
    resetView();
  }
}

// ================================================
// Event Focus
// ================================================

function focusEvent(eventIndex) {
  const eventData = timelineData.events[eventIndex];
  const mesh = eventData.mesh;

  currentEventFocus = eventIndex;

  // Animate camera to event
  const targetPos = {
    x: eventData.position.x,
    y: eventData.position.y + 40,
    z: eventData.position.z + 60
  };

  animateCamera(targetPos, CONFIG.ANIMATION.detailDuration);

  // Highlight mesh
  mesh.material.emissiveIntensity = 1.0;
  mesh.scale.setScalar(1.2);

  // Show details panel
  showEventPanel(eventData);

  debugLog(`Focused on event ${eventIndex}`);
}

function showEventPanel(eventData) {
  const panel = document.getElementById('event-panel');
  const event = eventData.original;

  document.getElementById('panel-title').textContent = `Event #${eventData.index + 1}`;
  document.getElementById('detail-mag').textContent = event.mag.toFixed(1);
  document.getElementById('detail-type').textContent = event.type;
  document.getElementById('detail-loc').textContent = `${event.lat.toFixed(2)}°, ${event.lon.toFixed(2)}°`;
  document.getElementById('detail-depth').textContent = `${event.depth.toFixed(0)} km`;
  document.getElementById('detail-time').textContent = new Date(event.time).toLocaleString();
  document.getElementById('detail-place').textContent = event.place;

  panel.style.display = 'block';
}

function closeEventPanel() {
  document.getElementById('event-panel').style.display = 'none';
  
  if (currentEventFocus !== null) {
    const eventData = timelineData.events[currentEventFocus];
    const mesh = eventData.mesh;
    mesh.material.emissiveIntensity = 0.5;
    mesh.scale.setScalar(1.0);
    currentEventFocus = null;
  }

  resetView();
}

// ================================================
// Timeline Playback
// ================================================

function startPlayback() {
  if (!timelineData || timelineData.events.length === 0) return;

  isPlayingTimeline = true;
  timelineProgress = 0;

  document.getElementById('play-btn').style.display = 'none';
  document.getElementById('pause-btn').style.display = 'inline-block';
  document.getElementById('timeline-scrubber').style.display = 'block';
  document.getElementById('event-panel').style.display = 'none';

  debugLog('▶ Timeline playback started');
}

function pausePlayback() {
  isPlayingTimeline = false;

  document.getElementById('play-btn').style.display = 'inline-block';
  document.getElementById('pause-btn').style.display = 'none';

  debugLog('⏸ Timeline paused');
}

function resetView() {
  isPlayingTimeline = false;
  timelineProgress = 0;
  currentEventFocus = null;

  document.getElementById('play-btn').style.display = 'inline-block';
  document.getElementById('pause-btn').style.display = 'none';
  document.getElementById('timeline-scrubber').style.display = 'none';
  document.getElementById('event-panel').style.display = 'none';

  // Reset all meshes
  timelineData.events.forEach(eventData => {
    if (eventData.mesh) {
      eventData.mesh.material.emissiveIntensity = 0.5;
      eventData.mesh.scale.setScalar(1.0);
    }
  });

  // Reset camera
  animateCamera(CONFIG.CAMERA.positionOverview, CONFIG.ANIMATION.overviewDuration);

  debugLog('↺ View reset');
}

// ================================================
// Scrubber Control
// ================================================

function onScrubberChange(event) {
  timelineProgress = parseFloat(event.target.value) / 100;
  updateScrubberDisplay();
}

function updateScrubberDisplay() {
  const input = document.getElementById('scrubber-input');
  const progress = document.getElementById('scrubber-progress');
  const currentTime = document.getElementById('current-time');
  const totalTime = document.getElementById('total-time');

  input.value = timelineProgress * 100;
  progress.style.width = (timelineProgress * 100) + '%';

  const duration = (timelineData.timeRange.max - timelineData.timeRange.min) / 1000; // seconds
  const currentSeconds = Math.floor(duration * timelineProgress);
  const totalSeconds = Math.floor(duration);

  currentTime.textContent = formatTime(currentSeconds);
  totalTime.textContent = formatTime(totalSeconds);
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// ================================================
// Camera Animation
// ================================================

function animateCamera(targetPos, duration) {
  const startTime = Date.now();
  const startPos = {
    x: camera.position.x,
    y: camera.position.y,
    z: camera.position.z
  };

  const animate = () => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Ease-in-out cubic
    const easeProgress = progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;

    camera.position.x = startPos.x + (targetPos.x - startPos.x) * easeProgress;
    camera.position.y = startPos.y + (targetPos.y - startPos.y) * easeProgress;
    camera.position.z = startPos.z + (targetPos.z - startPos.z) * easeProgress;

    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  };

  animate();
}

// ================================================
// Animation Loop
// ================================================

function animate() {
  requestAnimationFrame(animate);

  // Update timeline playback
  if (isPlayingTimeline) {
    const speed = playbackSpeed / 1000; // Convert to per-millisecond
    timelineProgress += speed / 60; // Assuming 60 FPS

    if (timelineProgress >= 1) {
      pausePlayback();
    }

    updateScrubberDisplay();
  }

  // Rotate meshes slightly for visual interest
  timelineData.events.forEach((eventData, i) => {
    if (eventData.mesh) {
      eventData.mesh.rotation.x += 0.002;
      eventData.mesh.rotation.y += 0.003;
    }
  });

  // Render
  renderer.render(scene, camera);
}

// ================================================
// Window Resize
// ================================================

function onWindowResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  renderer.setSize(width, height);
}
