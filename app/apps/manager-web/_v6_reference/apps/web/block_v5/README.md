# Block

A fully offline-first web application for managing door-to-door sales reps and generating sales territories (clusters) from property CSV data.

## Features

- **Dashboard**: KPI cards showing total revenue, average monthly sales, active reps, and clusters created. Interactive map showing rep locations.

- **Sales Rep Management**: Full CRUD operations for sales reps with name, email, phone, and customizable color.

- **Sales Tracking**: Record sales with amount, date, rep assignment, optional cluster, and notes. View sales history with rollups.

- **Cluster Creation**: Import property CSVs with lat/lng coordinates and generate DBSCAN clusters. Configure radius (miles), minimum houses, and price filters.

- **Cluster Assignment**: Assign generated clusters to sales reps. View rep summaries with cluster counts, house totals, and estimated values.

- **Export**: Export clusters and assignments as JSON or CSV.

## Getting Started

### Option 1: Open directly (file://)

Simply double-click `index.html` to open the application in your browser. All features work fully offline with no server required.

### Option 2: Serve locally (recommended for better performance)

```bash
# Using Python
python -m http.server 8000

# Using Node.js
npx serve .

# Using PHP
php -S localhost:8000
```

Then open `http://localhost:8000` in your browser.

## CSV Import Format

The application accepts CSV files with property data. Required columns:

| Column | Aliases Accepted |
|--------|------------------|
| Latitude | `latitude`, `lat`, `y` |
| Longitude | `longitude`, `lng`, `lon`, `x`, `long` |

Optional columns:

| Column | Aliases Accepted |
|--------|------------------|
| Address | `address`, `street`, `fulladdress`, `propertyaddress`, `location` |
| ID | `id`, `propertyid`, `houseid`, `parcelid`, `uid` |
| Price | `propertyValue`, `price`, `value`, `marketValue`, `assessedValue`, etc. |

### Example CSV

```csv
id,address,latitude,longitude,propertyValue
1,"123 Main St",40.7128,-74.0060,450000
2,"456 Oak Ave",40.7148,-74.0080,380000
3,"789 Elm Blvd",40.7108,-74.0040,520000
```

## Clustering Algorithm

The application uses DBSCAN (Density-Based Spatial Clustering of Applications with Noise) with:

- **Haversine distance** for accurate geographic calculations
- **Grid-based spatial indexing** for O(n log n) performance on large datasets
- **Convex hull computation** for territory visualization

### Parameters

- **Radius (miles)**: Distance threshold for grouping properties (default: 0.2)
- **Minimum Houses**: Minimum properties to form a cluster (default: 25)
- **Price Range**: Optional filter for property values

## Data Storage

All data is stored locally in the browser's LocalStorage under the key `salesRepManager.v1`. This includes:

- Reps
- Sales
- Properties (imported from CSV)
- Clusters (generated)
- Assignments (cluster → rep mappings)

## Browser Compatibility

Tested and working in:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Architecture

```
/
├── index.html                 # Dashboard/Home
├── cluster-creation.html      # Cluster generation page
├── cluster-assignment.html    # Cluster assignment page
├── sales-reps.html           # Rep list/management
├── sales.html                # Sales list/management
├── add-sale.html             # Add sale form
├── add-rep.html              # Add rep form
├── css/
│   └── styles.css            # All styles
├── js/
│   ├── utils.js              # Utility functions
│   ├── store.js              # Data persistence layer
│   ├── ui.js                 # Toast, modal, loading UI
│   ├── router.js             # Navigation helper
│   ├── app.js                # Main app initialization
│   ├── map/
│   │   ├── projection.js     # Web Mercator projection
│   │   ├── basemap.js        # Procedural basemap rendering
│   │   ├── overlay.js        # Cluster/point overlay rendering
│   │   └── MapView.js        # Main map component
│   ├── clustering/
│   │   ├── hull.js           # Convex hull algorithm
│   │   └── dbscan.js         # DBSCAN clustering
│   └── pages/
│       ├── home.js           # Home page logic
│       ├── clusterCreation.js
│       ├── clusterAssignment.js
│       ├── reps.js
│       ├── sales.js
│       ├── addSale.js
│       └── addRep.js
├── sw.js                     # Service worker (HTTP only)
└── README.md                 # This file
```

## Performance Notes

- The application samples up to 8,000 points for map rendering to maintain smooth performance
- Clustering uses a grid-based spatial index for efficient neighbor queries
- Large CSV files (50,000+ rows) may take a few seconds to import and cluster

## Known Limitations

- Service Worker only activates on HTTP/HTTPS (not file://)
- Price detection requires one of the recognized column name patterns
- Map basemap is procedurally generated (no real street data)

## License

MIT License - Free for personal and commercial use.
