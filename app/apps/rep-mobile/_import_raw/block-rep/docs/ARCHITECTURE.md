# Block Rep Architecture Overview

This document provides a comprehensive overview of the Block Rep application architecture, including system design, data flow, and technical decisions.

## System Architecture

### High-Level Overview
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Mobile App    │    │   Supabase      │    │   External      │
│   (React Native)│────│   Backend       │────│   Services      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
    ┌────────┐              ┌────────┐              ┌────────┐
    │Mapbox  │              │Postgres│              │Twilio  │
    │Maps    │              │Database│              │SMS     │
    └────────┘              └────────┘              └────────┘
         │                       │                       │
         │                       │                       │
    ┌────────┐              ┌────────┐              ┌────────┐
    │Offline │              │Realtime│              │Firebase│
    │Storage │              │Updates │              │Push    │
    └────────┘              └────────┘              └────────┘
```

### Component Architecture

#### Frontend (React Native)
```
App
├── Navigation
│   ├── Authentication Flow
│   └── Main App Flow (Tab Navigator)
├── Screens
│   ├── MapScreen
│   ├── RouteScreen
│   ├── FollowUpsScreen
│   ├── StatsScreen
│   ├── HouseDetailScreen
│   ├── ContractScreen
│   └── ProfileScreen
├── Components
│   ├── ClockInButton
│   ├── SyncIndicator
│   ├── ClusterInfoSheet
│   └── Shared Components
├── Services
│   ├── LocationService
│   ├── OfflineSyncService
│   ├── TwilioService
│   └── NotificationService
├── Store (Zustand)
│   ├── AuthStore
│   ├── RepStore
│   ├── LocationStore
│   ├── MapStore
│   ├── RouteStore
│   ├── FollowUpStore
│   ├── StatsStore
│   └── OfflineStore
└── Types (TypeScript)
```

#### Backend (Supabase)
```
Supabase Platform
├── PostgreSQL Database
│   ├── Organizations
│   ├── Profiles
│   ├── Reps
│   ├── Clusters
│   ├── Properties
│   ├── Interactions
│   ├── Sales
│   ├── Followups
│   ├── Messages
│   ├── RepLocations
│   ├── Routes
│   ├── DailyStats
│   └── XPRecords
├── Authentication
├── Row Level Security (RLS)
├── Realtime Subscriptions
├── Storage Buckets
│   ├── photos
│   ├── contracts
│   └── documents
└── Edge Functions
    ├── send-sms
    ├── receive-sms
    └── location-update
```

## Data Flow

### User Authentication Flow
```
1. User enters credentials
2. Supabase Auth validates
3. JWT token stored locally
4. Profile and rep data fetched
5. App navigates to main flow
```

### Location Update Flow
```
1. Background location service triggers
2. Location data collected
3. Check if rep is clocked in
4. If clocked in:
   - Store location in database
   - Update rep's last location
   - Check current cluster
   - Broadcast to managers
5. If offline, queue for sync
```

### Interaction Logging Flow
```
1. Rep logs interaction outcome
2. Data validated locally
3. Photos captured (if any)
4. Data queued for sync
5. If online: immediate sync
6. If offline: stored locally
7. Update property statistics
8. Update cluster progress
9. Award XP points
```

### SMS Communication Flow
```
Outbound:
1. Rep sends message in app
2. App calls send-sms Edge Function
3. Function validates request
4. Twilio sends SMS
5. Message stored in database
6. Real-time update to UI

Inbound:
1. Customer replies to SMS
2. Twilio webhook triggers
3. receive-sms function processes
4. Message stored in database
5. Push notification sent to rep
6. Real-time update to UI
```

## Database Schema Design

### Core Entities

#### Organizations
```sql
- id (UUID, PK)
- name (Text)
- created_at, updated_at
```

#### Profiles (extends auth.users)
```sql
- id (UUID, PK, FK to auth.users)
- organization_id (UUID, FK)
- first_name, last_name, phone
- role (rep | manager)
- avatar_url, push_token
```

#### Reps (extends profiles)
```sql
- id (UUID, PK, FK to profiles)
- home_base_lat, home_base_lng
- current_cluster_id (UUID, FK)
- is_clocked_in (Boolean)
- daily_goal_doors, daily_goal_leads
- total_xp, streak_days
```

#### Clusters (Territories)
```sql
- id (UUID, PK)
- name, organization_id
- assigned_rep_id (UUID, FK)
- polygon_coords (JSONB) - Geographic boundary
- center_lat, center_lng
- total_properties, completed_doors
- color, status
```

#### Properties (Addresses)
```sql
- id (UUID, PK)
- cluster_id (UUID, FK)
- address, lat, lng
- estimated_value, property_type
- last_visited, last_outcome
- visit_count, do_not_knock
```

### Interaction Tracking

#### Interactions (Visit Outcomes)
```sql
- id (UUID, PK)
- property_id, rep_id (FKs)
- outcome (enum: not_home, not_interested, interested, quote_given, sold, follow_up, do_not_knock)
- notes, photos (array)
- price, service_type
- customer_phone, customer_email
- duration_minutes
```

#### Sales
```sql
- id (UUID, PK)
- property_id, rep_id (FKs)
- price, service_type
- customer_phone, customer_email
- contract_url, payment_status
- status (pending, confirmed, cancelled)
```

#### Follow-ups
```sql
- id (UUID, PK)
- property_id, rep_id (FKs)
- scheduled_for (timestamp)
- completed_at, outcome
- reminder_sent
```

### Gamification

#### Daily Stats
```sql
- id (UUID, PK)
- rep_id, date
- doors_knocked, leads, sales
- hours_worked, doors_per_hour
- close_rate, lead_conversion_rate
- total_xp, streak_days
```

#### XP Records
```sql
- id (UUID, PK)
- rep_id, action, xp_value
- description
```

## Security Architecture

### Authentication & Authorization
- **Supabase Auth**: JWT-based authentication
- **Role-based Access**: Rep vs Manager permissions
- **Row Level Security**: Database-level access control
- **Organization Isolation**: Data segmented by organization

### Data Protection
- **Encryption at Rest**: Database encryption
- **Encryption in Transit**: HTTPS/TLS for all communications
- **API Key Management**: Secure storage of external service keys
- **Input Validation**: Server-side validation of all inputs

### Privacy Controls
- **Location Privacy**: Tracking only when clocked in
- **Data Retention**: Configurable retention policies
- **Customer Data Protection**: PII handling and encryption
- **Audit Logging**: All data access logged

## Performance Architecture

### Frontend Optimization
- **Lazy Loading**: Screens and components loaded on demand
- **Image Optimization**: Compressed images with caching
- **State Management**: Efficient re-renders with Zustand
- **Map Performance**: LOD rendering and viewport culling
- **Bundle Splitting**: Code splitting for faster startup

### Backend Optimization
- **Database Indexing**: Optimized queries with proper indexes
- **Connection Pooling**: Efficient database connections
- **Caching Strategy**: Redis caching for frequently accessed data
- **CDN Integration**: Static asset delivery optimization
- **Query Optimization**: Analyzed and optimized SQL queries

### Offline Strategy
- **Local Storage**: AsyncStorage for offline data
- **Sync Queue**: Automatic background synchronization
- **Conflict Resolution**: Last-write-wins with timestamps
- **Progressive Sync**: Prioritize critical data sync
- **Offline Indicators**: Clear UI for offline state

## Scalability Design

### Horizontal Scaling
- **Stateless Services**: Edge functions are stateless
- **Database Sharding**: Potential for org-based sharding
- **Load Balancing**: CDN and API gateway load balancing
- **Microservices Ready**: Services can be split if needed

### Vertical Scaling
- **Database Optimization**: Query optimization and indexing
- **Resource Monitoring**: CPU, memory, and I/O monitoring
- **Auto-scaling**: Supabase auto-scaling capabilities
- **Performance Monitoring**: Real-time performance metrics

### Data Growth Management
- **Archival Strategy**: Old data archival to cold storage
- **Data Partitioning**: Time-based partitioning for logs
- **Retention Policies**: Configurable data retention
- **Backup Strategy**: Automated backups with point-in-time recovery

## Monitoring & Observability

### Application Monitoring
- **Crash Reporting**: Crashlytics integration
- **Performance Tracking**: React Native performance monitoring
- **User Analytics**: Firebase Analytics for user behavior
- **Error Tracking**: Sentry for error monitoring

### Infrastructure Monitoring
- **Database Metrics**: Supabase dashboard monitoring
- **API Metrics**: Edge function performance tracking
- **Real-time Alerts**: Critical error notifications
- **Health Checks**: Endpoint health monitoring

### Business Intelligence
- **Usage Analytics**: Feature adoption tracking
- **Performance Metrics**: Doors per hour, conversion rates
- **User Engagement**: Session duration and frequency
- **Territory Analytics**: Cluster performance analysis

## Development Workflow

### Code Organization
- **Feature-based**: Code organized by feature/domain
- **Component Reuse**: Shared components in common directory
- **Service Layer**: API calls abstracted in service layer
- **Type Safety**: Full TypeScript coverage
- **Testing Strategy**: Unit, integration, and E2E tests

### Git Workflow
- **Branch Strategy**: Feature branches with main/develop
- **Code Review**: Pull request reviews required
- **CI/CD Pipeline**: Automated testing and deployment
- **Version Tagging**: Semantic versioning
- **Release Management**: Staged releases with rollback capability

### Environment Management
- **Development**: Local development with hot reload
- **Staging**: Production-like environment for testing
- **Production**: Live environment with monitoring
- **Feature Flags**: Gradual feature rollouts

## Technology Decisions

### Why React Native?
- **Cross-platform**: Single codebase for iOS and Android
- **Native Performance**: Near-native performance
- **Developer Experience**: Hot reload and rich ecosystem
- **Mature**: Stable and well-supported framework

### Why Supabase?
- **Backend as a Service**: Reduces backend development time
- **PostgreSQL**: Powerful and scalable database
- **Real-time**: Built-in real-time capabilities
- **Auth & Storage**: Integrated authentication and storage
- **Edge Functions**: Serverless function hosting

### Why Mapbox?
- **Custom Styling**: Google Maps-like styling
- **Offline Support**: Built-in offline map tiles
- **Performance**: Fast and smooth map rendering
- **Flexibility**: Custom layers and annotations

### Why Zustand?
- **Simplicity**: Minimal boilerplate
- **Performance**: Efficient re-renders
- **TypeScript**: Excellent TypeScript support
- **Persistence**: Easy state persistence

## Future Enhancements

### Planned Features
- **Advanced Analytics**: Machine learning insights
- **Team Management**: Manager dashboard improvements
- **Advanced Routing**: AI-powered route optimization
- **Integration APIs**: CRM and ERP integrations
- **Multi-language**: Internationalization support

### Technical Improvements
- **GraphQL API**: More flexible data fetching
- **Microservices**: Service decomposition
- **Advanced Caching**: Redis implementation
- **CDN Optimization**: Global asset delivery
- **Progressive Web App**: Web version

## Conclusion

The Block Rep architecture is designed for scalability, performance, and maintainability. It leverages modern cloud services and best practices to deliver a robust sales territory management solution.

Key strengths:
- **Modular Design**: Easy to extend and maintain
- **Performance Optimized**: Fast and responsive user experience
- **Security First**: Comprehensive security measures
- **Offline Ready**: Full offline functionality
- **Cloud Native**: Leverages modern cloud services

The architecture supports the current feature set while providing a solid foundation for future enhancements and scaling requirements.