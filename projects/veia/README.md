# Virtual Economy Integrity Agent (VEIA)

Immersive 3D visualization of anomaly detection in virtual marketplace transactions.

## 🎬 Features

### Immersive Experience (`immersive.html`)
Cinematic Three.js visualization with 5 interactive scenes:

1. **🌀 Dynamic Transaction Network** - 3D force-directed graph with glowing anomaly edges
2. **💥 Price Deviation Energy Field** - Particle system with solar flare effects for anomalies
3. **🌍 Global Integrity Flows** - Geographic flow visualization (placeholder)
4. **🔄 Wash Trade Ring** - Circular network showing collusion patterns
5. **💫 Marketplace Clusters** - Spatial separation of Prime/Shadow/Arcade platforms

### Dashboard (`index.html`)
Analytics dashboard with:
- Overview statistics
- Timeline chart
- Category heatmap
- Network graph (D3.js)
- Price deviation distribution
- Anomaly list

## 📊 Dataset

Synthetic dataset with 10,000 transactions:
- **8,650 normal** (86.5%)
- **1,350 anomalies** (13.5%) across 8 types:
  - Wash trade rings (400)
  - Mule accounts (200)
  - Layering bursts (150)
  - Shill bidding (120)
  - Arbitrage loops (120)
  - Duplicate payments (120)
  - Price spike manipulation (120)
  - RMT selling (120)

## 🛠️ Setup

### 1. Process Data
```bash
cd projects/veia
python process_data.py
```

This generates 7 JSON files in `data/`:
- `network.json` - 3D graph nodes and edges
- `timeline.json` - Temporal anomaly sequences
- `particles.json` - Price deviation field data
- `geo_flows.json` - Geographic flows
- `wash_ring.json` - Wash trade network
- `marketplaces.json` - Marketplace clusters
- `stats.json` - Overview statistics

### 2. Serve Locally
```bash
# From TomchNET root
python -m http.server 8080

# Visit:
# http://localhost:8080/projects/veia/index.html (Dashboard)
# http://localhost:8080/projects/veia/immersive.html (3D Experience)
```

## 🎨 Tech Stack

**Frontend:**
- Three.js - 3D graphics engine
- Chart.js - 2D charts
- D3.js - Network visualization
- Vanilla JavaScript

**Data Processing:**
- Python 3.12
- pandas & numpy

**Design:**
- Dark theme with high contrast
- 16:9 cinematic aspect ratio
- Gradient accents (#00d4ff / #ff3366)

## 🎯 Controls

**Immersive Experience:**
- **Mouse**: Rotate camera (drag)
- **Scroll**: Zoom
- **Arrows**: Navigate scenes
- **Play**: Auto-play mode (8s per scene)
- **Dots**: Jump to specific scene

**Dashboard:**
- Hover over visualizations for details
- Click anomalies for expanded info

## 📝 Notes

- Dataset is entirely synthetic (no real user data)
- Optimized for modern browsers (Chrome/Edge recommended)
- Auto-rotation enabled by default
- Anomalies highlighted with red (#ff3366)
- Normal transactions in blue (#00d4ff)

## 🚀 Future Enhancements

- [ ] Globe.gl integration for geographic scene
- [ ] Audio-reactive waveforms
- [ ] VR mode support
- [ ] Real-time data streaming
- [ ] Advanced camera choreography
- [ ] Temporal playback controls
