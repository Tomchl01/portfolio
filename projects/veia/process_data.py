"""
Virtual Economy Integrity Agent - Data Processing Pipeline
Transforms raw CSV data into optimized JSON exports for cinematic web visualizations
"""

import pandas as pd
import numpy as np
import json
from pathlib import Path
from datetime import datetime
from collections import defaultdict

# Paths
DATA_PATH = Path('data')
OUTPUT_PATH = DATA_PATH

# Load datasets
print("📦 Loading datasets...")
transactions = pd.read_csv(DATA_PATH / 'veia_transactions.csv')
users = pd.read_csv(DATA_PATH / 'veia_users (1).csv')
items = pd.read_csv(DATA_PATH / 'veia_items (1).csv')
edges = pd.read_csv(DATA_PATH / 'veia_edges (1).csv')

# Convert timestamp
transactions['timestamp'] = pd.to_datetime(transactions['timestamp'])
transactions['is_anomaly'] = transactions['anomaly_label'] != 'normal'

print(f"✅ Loaded {len(transactions):,} transactions")
print(f"🔴 {transactions['is_anomaly'].sum():,} anomalies ({transactions['is_anomaly'].mean()*100:.1f}%)")

# ============================================================================
# 1. NETWORK GRAPH DATA (3D Force-Directed)
# ============================================================================
print("\n🌀 Building 3D network graph...")

# Select top active users for cleaner visualization
top_buyers = transactions['buyer_id'].value_counts().head(80).index
top_sellers = transactions['seller_id'].value_counts().head(80).index
active_users = list(set(top_buyers) | set(top_sellers))

# Calculate node metrics
node_data = []
for user_id in active_users:
    user_txns = transactions[
        (transactions['buyer_id'] == user_id) | (transactions['seller_id'] == user_id)
    ]
    user_info = users[users['user_id'] == user_id]
    
    # 3D position (spherical distribution)
    theta = np.random.uniform(0, 2 * np.pi)
    phi = np.random.uniform(0, np.pi)
    r = 50 + np.random.uniform(-10, 10)
    
    # Get region safely
    if len(user_info) > 0 and not pd.isna(user_info['region'].values[0]):
        region = str(user_info['region'].values[0])
    else:
        region = 'Unknown'
    
    # Get KYC safely
    if len(user_info) > 0 and not pd.isna(user_info['kyc_verified'].values[0]):
        kyc = bool(user_info['kyc_verified'].values[0])
    else:
        kyc = False
    
    node_data.append({
        'id': user_id,
        'x': float(r * np.sin(phi) * np.cos(theta)),
        'y': float(r * np.sin(phi) * np.sin(theta)),
        'z': float(r * np.cos(phi)),
        'tx_count': int(len(user_txns)),
        'anomaly_count': int(user_txns['is_anomaly'].sum()),
        'total_value': float(user_txns['price'].sum()),
        'region': region,
        'kyc': kyc
    })

# Build edges
network_txns = transactions[
    transactions['buyer_id'].isin(active_users) & 
    transactions['seller_id'].isin(active_users)
]

# Group edges by buyer-seller pair for cleaner visualization
edge_groups = network_txns.groupby(['buyer_id', 'seller_id']).agg({
    'transaction_id': 'count',
    'price': 'sum',
    'price_z': lambda x: float(x.abs().mean()),
    'is_anomaly': 'sum',
    'anomaly_label': lambda x: x.mode()[0] if len(x) > 0 else 'normal'
}).reset_index()

edge_data = []
for _, row in edge_groups.iterrows():
    edge_data.append({
        'source': row['buyer_id'],
        'target': row['seller_id'],
        'tx_count': int(row['transaction_id']),
        'total_value': float(row['price']),
        'avg_price_z': float(row['price_z']),
        'anomaly_count': int(row['is_anomaly']),
        'anomaly_type': row['anomaly_label'],
        'intensity': float(min(row['price_z'] / 2, 1.0))  # 0-1 for visualization
    })

network_export = {
    'nodes': node_data,
    'edges': edge_data,
    'metadata': {
        'total_nodes': len(node_data),
        'total_edges': len(edge_data),
        'date_generated': datetime.now().isoformat()
    }
}

with open(OUTPUT_PATH / 'network.json', 'w') as f:
    json.dump(network_export, f, indent=2)

print(f"  ✅ {len(node_data)} nodes, {len(edge_data)} edges")

# ============================================================================
# 2. ANOMALY TIMELINE DATA (Temporal Visualization)
# ============================================================================
print("\n⚡ Processing anomaly timeline...")

anomalies = transactions[transactions['is_anomaly']].copy()
anomalies['hour'] = anomalies['timestamp'].dt.hour
anomalies['day'] = anomalies['timestamp'].dt.day
anomalies['date'] = anomalies['timestamp'].dt.date

# Temporal bursts (for layering_burst visualization)
temporal_data = []
for anomaly_type in anomalies['anomaly_label'].unique():
    type_data = anomalies[anomalies['anomaly_label'] == anomaly_type]
    
    # Daily counts
    daily = type_data.groupby('day').agg({
        'transaction_id': 'count',
        'price': 'sum',
        'price_z': lambda x: float(x.abs().mean())
    }).reset_index()
    
    temporal_data.append({
        'type': anomaly_type,
        'total_count': int(len(type_data)),
        'avg_price': float(type_data['price'].mean()),
        'avg_z_score': float(type_data['price_z'].abs().mean()),
        'daily_counts': [
            {
                'day': int(row['day']),
                'count': int(row['transaction_id']),
                'value': float(row['price']),
                'intensity': float(row['price_z'])
            }
            for _, row in daily.iterrows()
        ]
    })

timeline_export = {
    'anomaly_types': temporal_data,
    'metadata': {
        'timeframe': {
            'start': str(transactions['timestamp'].min()),
            'end': str(transactions['timestamp'].max())
        }
    }
}

with open(OUTPUT_PATH / 'timeline.json', 'w') as f:
    json.dump(timeline_export, f, indent=2)

print(f"  ✅ {len(temporal_data)} anomaly type timelines")

# ============================================================================
# 3. PARTICLE FIELD DATA (Price Deviation Energy)
# ============================================================================
print("\n💥 Generating particle field data...")

categories = transactions['category'].unique()
particle_data = []

# Sample transactions for performance (take high-intensity ones + random sample)
high_intensity = transactions[transactions['price_z'].abs() > 2]
normal_sample = transactions[transactions['price_z'].abs() <= 2].sample(n=min(2000, len(transactions)))
particle_txns = pd.concat([high_intensity, normal_sample])

for cat_idx, category in enumerate(categories):
    cat_txns = particle_txns[particle_txns['category'] == category]
    
    for _, txn in cat_txns.iterrows():
        # Position in 3D space (category clusters)
        base_x = cat_idx * 30
        jitter_x = np.random.normal(0, 5)
        jitter_y = np.random.normal(0, 5)
        z_position = float(txn['price_z']) * 3
        
        deviation_abs = abs(float(txn['price_z']))
        
        particle_data.append({
            'x': float(base_x + jitter_x),
            'y': float(jitter_y),
            'z': float(z_position),
            'size': float(2 + deviation_abs * 2),
            'intensity': float(min(deviation_abs / 4, 1.0)),
            'is_flare': bool(deviation_abs > 2),
            'category': category,
            'price': float(txn['price']),
            'z_score': float(txn['price_z']),
            'anomaly_type': txn['anomaly_label']
        })

particle_export = {
    'particles': particle_data,
    'categories': [
        {
            'name': cat,
            'center_x': float(idx * 30),
            'center_y': 0,
            'center_z': 0,
            'total': int(len(transactions[transactions['category'] == cat])),
            'anomalies': int(len(anomalies[anomalies['category'] == cat]))
        }
        for idx, cat in enumerate(categories)
    ],
    'metadata': {
        'total_particles': len(particle_data),
        'flare_count': sum(1 for p in particle_data if p['is_flare'])
    }
}

with open(OUTPUT_PATH / 'particles.json', 'w') as f:
    json.dump(particle_export, f, indent=2)

print(f"  ✅ {len(particle_data)} particles, {particle_export['metadata']['flare_count']} flares")

# ============================================================================
# 4. GEOGRAPHIC FLOWS (Region Arcs)
# ============================================================================
print("\n🌍 Building geographic flow arcs...")

region_coords = {
    'EU': {'lat': 50, 'lon': 10, 'name': 'Europe'},
    'SEA': {'lat': 10, 'lon': 105, 'name': 'Southeast Asia'},
    'EAST_ASIA': {'lat': 35, 'lon': 120, 'name': 'East Asia'},
    'OCE': {'lat': -25, 'lon': 135, 'name': 'Oceania'},
    'LATAM': {'lat': -10, 'lon': -60, 'name': 'Latin America'}
}

# Aggregate flows
flows = transactions.groupby(['buyer_region', 'seller_region', 'marketplace']).agg({
    'transaction_id': 'count',
    'price': 'sum',
    'is_anomaly': 'sum'
}).reset_index()
flows = flows[flows['buyer_region'] != flows['seller_region']]  # Remove self-loops

flow_data = []
for _, row in flows.iterrows():
    flow_data.append({
        'source': row['buyer_region'],
        'target': row['seller_region'],
        'source_coords': region_coords[row['buyer_region']],
        'target_coords': region_coords[row['seller_region']],
        'marketplace': row['marketplace'],
        'tx_count': int(row['transaction_id']),
        'total_value': float(row['price']),
        'anomaly_count': int(row['is_anomaly']),
        'anomaly_rate': float(row['is_anomaly'] / row['transaction_id']),
        'intensity': float(min(row['is_anomaly'] / row['transaction_id'], 1.0))
    })

geo_export = {
    'flows': flow_data,
    'regions': [
        {
            'code': code,
            **coords,
            'total_transactions': int(len(transactions[
                (transactions['buyer_region'] == code) | (transactions['seller_region'] == code)
            ]))
        }
        for code, coords in region_coords.items()
    ]
}

with open(OUTPUT_PATH / 'geo_flows.json', 'w') as f:
    json.dump(geo_export, f, indent=2)

print(f"  ✅ {len(flow_data)} cross-region flows")

# ============================================================================
# 5. WASH TRADE RINGS (Network Storyline)
# ============================================================================
print("\n🔄 Detecting wash trade rings...")

wash_trades = transactions[transactions['anomaly_label'] == 'wash_trade_ring']
ring_users = pd.concat([wash_trades['buyer_id'], wash_trades['seller_id']]).value_counts().head(20).index

# Build ring network
ring_txns = transactions[
    transactions['buyer_id'].isin(ring_users) & 
    transactions['seller_id'].isin(ring_users)
]

# Circular layout for ring visualization
ring_nodes = []
for idx, user_id in enumerate(ring_users):
    angle = 2 * np.pi * idx / len(ring_users)
    ring_nodes.append({
        'id': user_id,
        'x': float(30 * np.cos(angle)),
        'y': float(30 * np.sin(angle)),
        'z': 0,
        'ring_position': idx,
        'wash_trade_count': int(len(wash_trades[
            (wash_trades['buyer_id'] == user_id) | (wash_trades['seller_id'] == user_id)
        ]))
    })

ring_edges = []
for _, txn in ring_txns.iterrows():
    if txn['buyer_id'] in ring_users and txn['seller_id'] in ring_users:
        ring_edges.append({
            'source': txn['buyer_id'],
            'target': txn['seller_id'],
            'is_wash_trade': bool(txn['anomaly_label'] == 'wash_trade_ring'),
            'price': float(txn['price']),
            'timestamp': str(txn['timestamp'])
        })

ring_export = {
    'nodes': ring_nodes,
    'edges': ring_edges[:200],  # Limit for performance
    'metadata': {
        'total_wash_trades': int(len(wash_trades)),
        'ring_size': len(ring_users)
    }
}

with open(OUTPUT_PATH / 'wash_ring.json', 'w') as f:
    json.dump(ring_export, f, indent=2)

print(f"  ✅ {len(ring_nodes)} ring members, {len(ring_edges)} transactions")

# ============================================================================
# 6. MARKETPLACE CLUSTERS (3D Spatial)
# ============================================================================
print("\n💫 Creating marketplace clusters...")

marketplace_centers = {
    'Prime': {'x': -40, 'y': 0, 'z': 0},
    'Shadow': {'x': 0, 'y': 0, 'z': 0},
    'Arcade': {'x': 40, 'y': 0, 'z': 0}
}

# Sample transactions per marketplace
marketplace_data = []
for marketplace, center in marketplace_centers.items():
    market_txns = transactions[transactions['marketplace'] == marketplace].sample(
        n=min(1000, len(transactions[transactions['marketplace'] == marketplace]))
    )
    
    market_points = []
    for _, txn in market_txns.iterrows():
        market_points.append({
            'x': float(center['x'] + np.random.normal(0, 8)),
            'y': float(center['y'] + np.random.normal(0, 8)),
            'z': float(center['z'] + np.random.normal(0, 8)),
            'is_anomaly': bool(txn['is_anomaly']),
            'price': float(txn['price']),
            'category': txn['category'],
            'anomaly_type': txn['anomaly_label']
        })
    
    market_stats = transactions[transactions['marketplace'] == marketplace]
    marketplace_data.append({
        'name': marketplace,
        'center': center,
        'points': market_points,
        'stats': {
            'total_transactions': int(len(market_stats)),
            'total_value': float(market_stats['price'].sum()),
            'anomaly_count': int(market_stats['is_anomaly'].sum()),
            'anomaly_rate': float(market_stats['is_anomaly'].mean())
        }
    })

marketplace_export = {
    'marketplaces': marketplace_data,
    'metadata': {
        'total_points': sum(len(m['points']) for m in marketplace_data)
    }
}

with open(OUTPUT_PATH / 'marketplaces.json', 'w') as f:
    json.dump(marketplace_export, f, indent=2)

print(f"  ✅ 3 marketplace clusters with {marketplace_export['metadata']['total_points']} points")

# ============================================================================
# 7. STATS SUMMARY
# ============================================================================
print("\n📊 Generating stats summary...")

stats_export = {
    'overview': {
        'total_transactions': int(len(transactions)),
        'total_anomalies': int(transactions['is_anomaly'].sum()),
        'detection_rate': float(transactions['is_anomaly'].mean()),
        'total_volume': float(transactions['price'].sum()),
        'timeframe': {
            'start': str(transactions['timestamp'].min()),
            'end': str(transactions['timestamp'].max())
        }
    },
    'anomaly_breakdown': [
        {
            'type': anom_type,
            'count': int(len(transactions[transactions['anomaly_label'] == anom_type])),
            'avg_price': float(transactions[transactions['anomaly_label'] == anom_type]['price'].mean()),
            'avg_z_score': float(transactions[transactions['anomaly_label'] == anom_type]['price_z'].abs().mean())
        }
        for anom_type in transactions[transactions['is_anomaly']]['anomaly_label'].unique()
    ],
    'marketplaces': [
        {
            'name': marketplace,
            'transactions': int(len(transactions[transactions['marketplace'] == marketplace])),
            'anomaly_rate': float(transactions[transactions['marketplace'] == marketplace]['is_anomaly'].mean()),
            'total_value': float(transactions[transactions['marketplace'] == marketplace]['price'].sum())
        }
        for marketplace in transactions['marketplace'].unique()
    ],
    'categories': {
        cat: {
            'total': int(len(transactions[transactions['category'] == cat])),
            'anomalies': int(transactions[transactions['category'] == cat]['is_anomaly'].sum()),
            'anomaly_rate': float(transactions[transactions['category'] == cat]['is_anomaly'].mean())
        }
        for cat in transactions['category'].unique()
    }
}

with open(OUTPUT_PATH / 'stats.json', 'w') as f:
    json.dump(stats_export, f, indent=2)

print(f"  ✅ Stats summary generated")

# ============================================================================
# 8. SIMPLE EXPORTS FOR DASHBOARD (transactions, anomalies, categories)
# ============================================================================
print("\n📦 Generating simple dashboard exports...")

# Sample transactions for frontend
sample_transactions = transactions.sample(n=min(500, len(transactions))).copy()
transactions_export = sample_transactions[[
    'transaction_id', 'timestamp', 'buyer_id', 'seller_id', 
    'category', 'price', 'marketplace', 'is_anomaly', 'anomaly_label'
]].to_dict('records')

# Convert timestamps to ISO strings
for t in transactions_export:
    t['timestamp'] = str(t['timestamp'])

with open(OUTPUT_PATH / 'transactions.json', 'w') as f:
    json.dump(transactions_export, f, indent=2)

# Top anomalies
anomalies['price_z_abs'] = anomalies['price_z'].abs()
top_anomalies = anomalies.nlargest(100, 'price_z_abs').copy()
anomalies_export = top_anomalies[[
    'transaction_id', 'timestamp', 'category', 'price', 
    'price_z', 'anomaly_label', 'anomaly_notes'
]].to_dict('records')

for a in anomalies_export:
    a['timestamp'] = str(a['timestamp'])

with open(OUTPUT_PATH / 'anomalies.json', 'w') as f:
    json.dump(anomalies_export, f, indent=2)

# Categories
categories_export = stats_export['categories']
with open(OUTPUT_PATH / 'categories.json', 'w') as f:
    json.dump(categories_export, f, indent=2)

print(f"  ✅ Dashboard exports: transactions, anomalies, categories")

# ============================================================================
# COMPLETE
# ============================================================================
print("\n" + "="*60)
print("✅ DATA PROCESSING COMPLETE")
print("="*60)
print("\n📦 Generated JSON files:")
print("  1. network.json        — 3D force-directed graph")
print("  2. timeline.json       — Temporal anomaly sequences")
print("  3. particles.json      — Price deviation energy field")
print("  4. geo_flows.json      — Geographic flow arcs")
print("  5. wash_ring.json      — Wash trade ring network")
print("  6. marketplaces.json   — 3D marketplace clusters")
print("  7. stats.json          — Overview statistics")
print("  8. transactions.json   — Sample transactions")
print("  9. anomalies.json      — Top 100 anomalies")
print(" 10. categories.json     — Category breakdowns")
print("\n🎬 Ready for cinematic web visualization!")
