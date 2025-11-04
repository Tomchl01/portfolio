/**
 * VEIA IMMERSIVE EXPERIENCE
 * Cinematic 3D visualization with Three.js
 * Wrapped in IIFE to avoid variable conflicts
 */

(function() {
  'use strict';

  // Three.js scene globals (scoped to this module)
  let scene, camera, renderer, controls;
  let currentScene = 0;
  let autoPlay = false;
  let autoPlayInterval;

  // Data stores
  let networkData, particleData, geoData, ringData, marketData, statsData;

  // Scene objects
  let networkObjects = [];
  let particleObjects = [];
  let currentObjects = [];

  // Configuration
  const SCENES = [
    { name: 'Network', title: '🌀 Dynamic Transaction Network', desc: 'Buyers and sellers orbit in 3D space, connected by glowing edges' },
    { name: 'Particles', title: '💥 Price Deviation Energy Field', desc: 'Anomalies flare like solar bursts when deviation exceeds threshold' },
    { name: 'Globe', title: '🌍 Global Integrity Flows', desc: 'Cross-region transaction paths reveal laundering networks' },
    { name: 'Ring', title: '🔄 Wash Trade Ring', desc: 'Colluding accounts repeatedly exchange assets in a circular pattern' },
    { name: 'Markets', title: '💫 Marketplace Clusters', desc: 'Prime, Shadow, and Arcade form distinct spatial regions' }
  ];

  // Initialize - exported for external call
  async function initImmersive() {
    // Load all data
    await loadAllData();
    
    // Setup Three.js
    setupScene();
    setupLights();
    setupCamera();
    setupRenderer();
    setupControls();
    
    // Build initial scene
    buildNetworkScene();
    
    // Show scene title
    showSceneTitle();
    
    // Start animation loop
    animate();
    
    console.log('🎬 Immersive experience ready');
  }

  // Expose functions to global scope
  window.initImmersive = initImmersive;
  window.goToScene = goToScene;
  window.nextScene = nextScene;
  window.prevScene = prevScene;
  window.toggleAutoPlay = toggleAutoPlay;

// Load data
async function loadAllData() {
  try {
    [networkData, particleData, ringData, marketData, statsData] = await Promise.all([
      fetch('data/network.json').then(r => r.json()),
      fetch('data/particles.json').then(r => r.json()),
      fetch('data/wash_ring.json').then(r => r.json()),
      fetch('data/marketplaces.json').then(r => r.json()),
      fetch('data/stats.json').then(r => r.json())
    ]);
    console.log('✅ Data loaded:', {
      nodes: networkData.nodes.length,
      particles: particleData.particles.length,
      ringMembers: ringData.nodes.length,
      marketplaces: marketData.marketplaces.length
    });
  } catch (err) {
    console.error('❌ Data load error:', err);
  }
}

// Setup scene
function setupScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a0a);
  scene.fog = new THREE.Fog(0x0a0a0a, 100, 300);
}

// Setup lights
function setupLights() {
  const ambient = new THREE.AmbientLight(0x404040, 0.5);
  scene.add(ambient);
  
  const point1 = new THREE.PointLight(0x00d4ff, 1, 200);
  point1.position.set(50, 50, 50);
  scene.add(point1);
  
  const point2 = new THREE.PointLight(0xff3366, 0.8, 200);
  point2.position.set(-50, -50, 50);
  scene.add(point2);
}

// Setup camera
function setupCamera() {
  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(100, 80, 100);
  camera.lookAt(0, 0, 0);
}

// Setup renderer
function setupRenderer() {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  document.getElementById('canvas-container').appendChild(renderer.domElement);
}

// Setup controls
function setupControls() {
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.minDistance = 20;
  controls.maxDistance = 300;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.5;
}

// ============================================================================
// SCENE 1: NETWORK
// ============================================================================
function buildNetworkScene() {
  clearScene();
  
  // Create nodes
  const nodeGeometry = new THREE.SphereGeometry(1, 16, 16);
  const nodeMaterial = new THREE.MeshStandardMaterial({
    color: 0x00d4ff,
    emissive: 0x00d4ff,
    emissiveIntensity: 0.3,
    metalness: 0.5,
    roughness: 0.5
  });
  
  networkData.nodes.forEach(node => {
    const mesh = new THREE.Mesh(nodeGeometry, nodeMaterial.clone());
    mesh.position.set(node.x, node.y, node.z);
    
    const scale = 0.5 + (node.tx_count / 100);
    mesh.scale.setScalar(scale);
    
    mesh.userData = node;
    scene.add(mesh);
    currentObjects.push(mesh);
  });
  
  // Create edges
  networkData.edges.forEach(edge => {
    const sourceNode = networkData.nodes.find(n => n.id === edge.source);
    const targetNode = networkData.nodes.find(n => n.id === edge.target);
    
    if (!sourceNode || !targetNode) return;
    
    const points = [
      new THREE.Vector3(sourceNode.x, sourceNode.y, sourceNode.z),
      new THREE.Vector3(targetNode.x, targetNode.y, targetNode.z)
    ];
    
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    
    const isAnomaly = edge.anomaly_type !== 'normal';
    const color = isAnomaly ? 0xff3366 : 0x00d4ff;
    const opacity = isAnomaly ? 0.6 + edge.intensity * 0.4 : 0.2;
    
    const material = new THREE.LineBasicMaterial({
      color: color,
      opacity: opacity,
      transparent: true,
      linewidth: 1
    });
    
    const line = new THREE.Line(geometry, material);
    line.userData = edge;
    scene.add(line);
    currentObjects.push(line);
  });
  
  console.log(`🌀 Network scene: ${networkData.nodes.length} nodes, ${networkData.edges.length} edges`);
}

// ============================================================================
// SCENE 2: PARTICLES
// ============================================================================
function buildParticleScene() {
  clearScene();
  
  // Normal particles
  const normalParticles = particleData.particles.filter(p => !p.is_flare);
  const normalGeometry = new THREE.BufferGeometry();
  const normalPositions = [];
  const normalColors = [];
  const normalSizes = [];
  
  normalParticles.forEach(p => {
    normalPositions.push(p.x, p.y, p.z);
    
    const intensity = p.intensity;
    normalColors.push(0, 0.8 * intensity, 1 * intensity);
    normalSizes.push(p.size);
  });
  
  normalGeometry.setAttribute('position', new THREE.Float32BufferAttribute(normalPositions, 3));
  normalGeometry.setAttribute('color', new THREE.Float32BufferAttribute(normalColors, 3));
  normalGeometry.setAttribute('size', new THREE.Float32BufferAttribute(normalSizes, 1));
  
  const normalMaterial = new THREE.PointsMaterial({
    size: 2,
    vertexColors: true,
    transparent: true,
    opacity: 0.6,
    sizeAttenuation: true
  });
  
  const normalPoints = new THREE.Points(normalGeometry, normalMaterial);
  scene.add(normalPoints);
  currentObjects.push(normalPoints);
  
  // Flare particles (anomalies)
  const flares = particleData.particles.filter(p => p.is_flare);
  flares.forEach(p => {
    const geometry = new THREE.SphereGeometry(p.size * 0.5, 8, 8);
    const material = new THREE.MeshStandardMaterial({
      color: 0xff3366,
      emissive: 0xff3366,
      emissiveIntensity: p.intensity,
      metalness: 0.3,
      roughness: 0.7
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(p.x, p.y, p.z);
    mesh.userData = p;
    
    scene.add(mesh);
    currentObjects.push(mesh);
  });
  
  // Category labels
  particleData.categories.forEach(cat => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 64;
    context.fillStyle = '#00d4ff';
    context.font = 'Bold 24px Inter';
    context.textAlign = 'center';
    context.fillText(cat.name, 128, 40);
    
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(material);
    sprite.position.set(cat.center_x, -10, 0);
    sprite.scale.set(15, 4, 1);
    
    scene.add(sprite);
    currentObjects.push(sprite);
  });
  
  console.log(`💥 Particle scene: ${normalParticles.length} particles, ${flares.length} flares`);
}

// ============================================================================
// SCENE 3: GLOBE (Simplified 3D arcs)
// ============================================================================
function buildGlobeScene() {
  clearScene();
  
  // Create simple sphere for globe feel
  const globeGeometry = new THREE.SphereGeometry(30, 32, 32);
  const globeMaterial = new THREE.MeshBasicMaterial({
    color: 0x1a1a1a,
    wireframe: true,
    opacity: 0.2,
    transparent: true
  });
  const globe = new THREE.Mesh(globeGeometry, globeMaterial);
  scene.add(globe);
  currentObjects.push(globe);
  
  // For demo: show text
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.width = 512;
  canvas.height = 256;
  context.fillStyle = '#00d4ff';
  context.font = 'Bold 32px Inter';
  context.textAlign = 'center';
  context.fillText('🌍 Geographic visualization', 256, 100);
  context.fillStyle = '#999';
  context.font = '20px Inter';
  context.fillText('Integration with Mapbox or globe.gl', 256, 140);
  
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(40, 20, 1);
  
  scene.add(sprite);
  currentObjects.push(sprite);
  
  console.log('🌍 Globe scene (placeholder)');
}

// ============================================================================
// SCENE 4: WASH RING
// ============================================================================
function buildRingScene() {
  clearScene();
  
  // Ring nodes
  const nodeGeometry = new THREE.SphereGeometry(1.5, 16, 16);
  
  ringData.nodes.forEach(node => {
    const material = new THREE.MeshStandardMaterial({
      color: 0xff3366,
      emissive: 0xff3366,
      emissiveIntensity: 0.5
    });
    
    const mesh = new THREE.Mesh(nodeGeometry, material);
    mesh.position.set(node.x, node.y, node.z);
    mesh.userData = node;
    
    scene.add(mesh);
    currentObjects.push(mesh);
  });
  
  // Ring edges
  ringData.edges.forEach(edge => {
    const sourceNode = ringData.nodes.find(n => n.id === edge.source);
    const targetNode = ringData.nodes.find(n => n.id === edge.target);
    
    if (!sourceNode || !targetNode) return;
    
    const points = [
      new THREE.Vector3(sourceNode.x, sourceNode.y, sourceNode.z),
      new THREE.Vector3(targetNode.x, targetNode.y, targetNode.z)
    ];
    
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: edge.is_wash_trade ? 0xff3366 : 0x3b82f6,
      opacity: edge.is_wash_trade ? 0.8 : 0.3,
      transparent: true
    });
    
    const line = new THREE.Line(geometry, material);
    scene.add(line);
    currentObjects.push(line);
  });
  
  console.log(`🔄 Ring scene: ${ringData.nodes.length} members, ${ringData.edges.length} transactions`);
}

// ============================================================================
// SCENE 5: MARKETPLACES
// ============================================================================
function buildMarketplaceScene() {
  clearScene();
  
  marketData.marketplaces.forEach(market => {
    // Market center label
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 128;
    context.fillStyle = '#00d4ff';
    context.font = 'Bold 28px Inter';
    context.textAlign = 'center';
    context.fillText(market.name, 128, 50);
    context.fillStyle = '#999';
    context.font = '16px Inter';
    context.fillText(`${market.stats.total_transactions} txns`, 128, 80);
    context.fillText(`${(market.stats.anomaly_rate * 100).toFixed(1)}% anomaly`, 128, 100);
    
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(material);
    sprite.position.set(market.center.x, market.center.y - 15, market.center.z);
    sprite.scale.set(20, 10, 1);
    
    scene.add(sprite);
    currentObjects.push(sprite);
    
    // Transaction points
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const colors = [];
    
    market.points.forEach(p => {
      positions.push(p.x, p.y, p.z);
      
      if (p.is_anomaly) {
        colors.push(1, 0.2, 0.4);
      } else {
        colors.push(0, 0.8, 1);
      }
    });
    
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    
    const pointsMaterial = new THREE.PointsMaterial({
      size: 0.5,
      vertexColors: true,
      transparent: true,
      opacity: 0.6
    });
    
    const points = new THREE.Points(geometry, pointsMaterial);
    scene.add(points);
    currentObjects.push(points);
  });
  
  console.log(`💫 Marketplace scene: ${marketData.marketplaces.length} markets`);
}

// ============================================================================
// SCENE MANAGEMENT
// ============================================================================
function clearScene() {
  currentObjects.forEach(obj => {
    scene.remove(obj);
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) obj.material.dispose();
  });
  currentObjects = [];
}

function showSceneTitle() {
  const sceneInfo = SCENES[currentScene];
  const titleEl = document.getElementById('sceneTitle');
  
  if (!titleEl) return;
  
  const h2 = titleEl.querySelector('h2');
  const p = titleEl.querySelector('p');
  
  if (h2) h2.textContent = sceneInfo.title;
  if (p) p.textContent = sceneInfo.desc;
  
  titleEl.style.opacity = '1';
  setTimeout(() => titleEl.style.opacity = '0', 3000);
}

function goToScene(index) {
  if (index === currentScene) return;
  
  currentScene = index;
  
  // Update indicators
  document.querySelectorAll('.scene-dot').forEach((dot, i) => {
    dot.classList.toggle('active', i === index);
  });
  
  // Build scene
  switch (index) {
    case 0: buildNetworkScene(); break;
    case 1: buildParticleScene(); break;
    case 2: buildGlobeScene(); break;
    case 3: buildRingScene(); break;
    case 4: buildMarketplaceScene(); break;
  }
  
  showSceneTitle();
  
  // Reset camera
  animateCameraTo(100, 80, 100);
}

function nextScene() {
  goToScene((currentScene + 1) % SCENES.length);
}

function prevScene() {
  goToScene((currentScene - 1 + SCENES.length) % SCENES.length);
}

function toggleAutoPlay() {
  autoPlay = !autoPlay;
  const btn = document.getElementById('playBtn');
  btn.textContent = autoPlay ? '⏸' : '▶';
  
  if (autoPlay) {
    autoPlayInterval = setInterval(nextScene, 8000);
  } else {
    clearInterval(autoPlayInterval);
  }
}

function animateCameraTo(x, y, z) {
  const duration = 1000;
  const start = Date.now();
  const startPos = camera.position.clone();
  const targetPos = new THREE.Vector3(x, y, z);
  
  function updateCamera() {
    const elapsed = Date.now() - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    
    camera.position.lerpVectors(startPos, targetPos, eased);
    
    if (progress < 1) {
      requestAnimationFrame(updateCamera);
    }
  }
  
  updateCamera();
}

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  
  controls.update();
  renderer.render(scene, camera);
}

  // Window resize
  window.addEventListener('resize', () => {
    if (camera && renderer) {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }
  });

})(); // End IIFE
