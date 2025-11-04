/**
 * VIRTUAL ECONOMY INTEGRITY AGENT
 * Anomaly detection dashboard
 */

// View Management
function switchView(view) {
  const explorerView = document.getElementById('explorerView');
  const immersiveView = document.getElementById('immersiveView');
  const explorerBtn = document.getElementById('explorerBtn');
  const immersiveBtn = document.getElementById('immersiveBtn');
  
  if (view === 'explorer') {
    explorerView.style.display = 'block';
    immersiveView.style.display = 'none';
    explorerBtn.classList.add('active');
    immersiveBtn.classList.remove('active');
    document.body.style.overflow = 'auto';
  } else if (view === 'immersive') {
    explorerView.style.display = 'none';
    immersiveView.style.display = 'block';
    explorerBtn.classList.remove('active');
    immersiveBtn.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    // Initialize Three.js scene if not already initialized
    if (typeof initImmersive === 'function' && !window.immersiveInitialized) {
      initImmersive();
      window.immersiveInitialized = true;
    }
  }
}

// Make function global
window.switchView = switchView;

// State
let statsData = {};
let anomalyData = [];
let fraudTypes = {};

// Initialize explorer
document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  renderStats();
  renderFraudCards();
});

// Load processed data
async function loadData() {
  try {
    const [stats, timeline] = await Promise.all([
      fetch('data/stats.json').then(r => r.json()),
      fetch('data/timeline.json').then(r => r.json())
    ]);
    
    statsData = stats;
    anomalyData = timeline.anomaly_types || [];
    
    // Build fraud types object
    stats.anomaly_breakdown.forEach(type => {
      fraudTypes[type.type] = type;
    });
    
    console.log('✅ Data loaded:', statsData);
  } catch (err) {
    console.error('Data load error:', err);
  }
}

// Render stats cards
function renderStats() {
  if (!statsData.overview) return;
  
  const overview = statsData.overview;
  
  document.getElementById('totalTransactions').textContent = overview.total_transactions.toLocaleString();
  document.getElementById('totalAnomalies').textContent = overview.total_anomalies.toLocaleString();
  document.getElementById('detectionRate').textContent = `${(overview.detection_rate * 100).toFixed(1)}%`;
  document.getElementById('totalVolume').textContent = `${(overview.total_volume / 1000).toFixed(0)}K GEM`;
}

// Fraud pattern descriptions
const fraudPatterns = {
  'wash_trade_ring': {
    title: '🔄 Wash Trade Rings',
    desc: 'Colluding accounts repeatedly exchange assets to artificially inflate trading volume and manipulate market perception',
    icon: '🔄',
    color: '#ff3366'
  },
  'shill_bidding': {
    title: '🎭 Shill Bidding',
    desc: 'Seller-controlled fake accounts drive up auction prices before legitimate buyers enter, maximizing seller profit',
    icon: '🎭',
    color: '#fbbf24'
  },
  'layering_burst': {
    title: '⚡ Layering Bursts',
    desc: 'Rapid-fire transactions create artificial market activity to obscure manipulative trades and confuse detection systems',
    icon: '⚡',
    color: '#a855f7'
  },
  'arbitrage_loop': {
    title: '🔁 Arbitrage Loops',
    desc: 'Cyclic flows across marketplaces exploit price differentials for systematic profit extraction',
    icon: '🔁',
    color: '#06b6d4'
  },
  'mule_account': {
    title: '🎒 Mule Accounts',
    desc: 'Intermediary accounts layer and distribute illicit funds to obscure transaction trails and evade detection',
    icon: '🎒',
    color: '#f97316'
  },
  'price_spike_manipulation': {
    title: '📈 Price Spike Manipulation',
    desc: 'Coordinated buying creates artificial demand spikes to manipulate market perception and trigger FOMO buying',
    icon: '📈',
    color: '#ef4444'
  },
  'rmt_selling': {
    title: '💰 RMT Selling',
    desc: 'Real-money trading converts virtual assets to external currency, violating platform terms and destabilizing economies',
    icon: '💰',
    color: '#ec4899'
  },
  'duplicate_payment': {
    title: '💳 Duplicate Payments',
    desc: 'Reused payment identifiers indicate fraud, system exploitation, or payment processing vulnerabilities',
    icon: '💳',
    color: '#84cc16'
  }
};

// Render fraud pattern cards
function renderFraudCards() {
  const container = document.getElementById('fraudCards');
  if (!container) return;
  
  container.innerHTML = '';
  
  statsData.anomaly_breakdown.forEach(fraud => {
    const pattern = fraudPatterns[fraud.type];
    if (!pattern) return;
    
    const card = document.createElement('div');
    card.className = 'viz-card';
    card.style.borderLeft = `3px solid ${pattern.color}`;
    card.style.cursor = 'pointer';
    card.style.transition = 'all 0.3s ease';
    
    card.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
        <span style="font-size: 32px;">${pattern.icon}</span>
        <h3 style="margin: 0; font-size: 1.1rem;">${pattern.title.replace(pattern.icon + ' ', '')}</h3>
      </div>
      <p style="color: var(--text-secondary); font-size: 0.9rem; line-height: 1.6; margin-bottom: 16px;">
        ${pattern.desc}
      </p>
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-size: 1.8rem; font-weight: 700; color: ${pattern.color};">${fraud.count}</div>
          <div style="font-size: 0.85rem; color: var(--text-tertiary);">Detected Cases</div>
        </div>
        <div>
          <div style="font-size: 1rem; font-weight: 600; color: var(--text-secondary);">Avg ${fraud.avg_price.toFixed(0)} GEM</div>
          <div style="font-size: 0.85rem; color: var(--text-tertiary);">Z-score: ${fraud.avg_z_score.toFixed(2)}</div>
        </div>
      </div>
    `;
    
    card.addEventListener('mouseenter', () => {
      card.style.transform = 'translateY(-4px)';
      card.style.boxShadow = `0 8px 24px ${pattern.color}40`;
    });
    
    card.addEventListener('mouseleave', () => {
      card.style.transform = 'translateY(0)';
      card.style.boxShadow = 'none';
    });
    
    container.appendChild(card);
  });
  
  console.log(`✅ Rendered ${statsData.anomaly_breakdown.length} fraud pattern cards`);
}
